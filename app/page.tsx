"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAlbumPages,
  calculateResizedDimensions,
  createBindingMargins,
  createPhotoAdjustmentFilter,
  createPdfFilename,
  DEFAULT_PHOTO_ADJUSTMENTS,
  DEFAULT_MAX_FILE_SIZE,
  normalizePhotoTransform,
  OPTIMIZATION_PRESETS,
  PAPER_SIZES,
  TEMPLATES,
  formatFileSize,
  moveItem,
  normalizePhotoAdjustments,
  validateImageFile,
} from "@/lib/album";
import type { BindingSide, PhotoAdjustments } from "@/lib/album";
import { readExifDate, resolvePhotoDate, sortPhotos } from "@/lib/photo-dates";
import type { SortMode } from "@/lib/photo-dates";
import { buildPrintPages, DEFAULT_PRINT_SETTINGS, packPrintSheet, PRINT_SIZES } from "@/lib/photo-print";
import type { PrintSettings } from "@/lib/photo-print";
import type { Project, StoredPhoto } from "@/lib/projects";
import { useProjects } from "@/lib/use-projects";
import { capturePage } from "@/lib/export-pdf";

type AlbumPhoto = StoredPhoto & {
  url: string;
};

type Toast = {
  tone: "success" | "warning";
  message: string;
};

type CoverTransform = {
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
};

const BACKGROUNDS = [
  { value: "#ffffff", label: "Putih" },
  { value: "#f6f1e8", label: "Krem" },
  { value: "#17221c", label: "Hijau gelap" },
  { value: "#171717", label: "Hitam" },
];

const DEFAULT_TITLE = "Album Kenangan";
const DEFAULT_COVER_TRANSFORM: CoverTransform = {
  positionX: 0,
  positionY: 0,
  scale: 1,
  rotation: 0,
};

const COVER_TEMPLATES = [
  { id: "full", name: "Penuh", description: "Foto memenuhi cover" },
  { id: "editorial", name: "Editorial", description: "Teks dan foto seimbang" },
  { id: "classic", name: "Klasik", description: "Rapi dan elegan" },
  { id: "collage", name: "Kolase", description: "Tiga momen pilihan" },
];

const PHOTO_ADJUSTMENT_PRESETS = [
  {
    id: "original",
    name: "Asli",
    description: "Tanpa koreksi warna",
    adjustments: { brightness: 100, contrast: 100, saturation: 100 },
  },
  {
    id: "print-bright",
    name: "Cerah untuk cetak",
    description: "Disarankan agar hasil kertas tidak terlalu gelap",
    adjustments: DEFAULT_PHOTO_ADJUSTMENTS,
  },
  {
    id: "vivid",
    name: "Cerah & hidup",
    description: "Lebih terang dengan warna lebih kuat",
    adjustments: { brightness: 118, contrast: 103, saturation: 112 },
  },
] as const;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function optimizeImage(file: File, maxDimension: number, quality: number) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const dimensions = calculateResizedDimensions(bitmap.width, bitmap.height, maxDimension);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Browser tidak dapat memproses gambar ini.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) throw new Error("Gambar gagal dioptimalkan.");
  return blob;
}

export default function Home() {
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [templateId, setTemplateId] = useState("grid-4");
  const [useVariety, setUseVariety] = useState(true);
  const [pageTemplateOverrides, setPageTemplateOverrides] = useState<
    Record<number, string>
  >({});
  const [includeCover, setIncludeCover] = useState(true);
  const [excludeCoverFromContent, setExcludeCoverFromContent] = useState(true);
  const [coverTemplateId, setCoverTemplateId] = useState("full");
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [coverTransform, setCoverTransform] =
    useState<CoverTransform>(DEFAULT_COVER_TRANSFORM);
  const [optimizationPresetId, setOptimizationPresetId] = useState("balanced");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [paperId, setPaperId] = useState("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margins, setMargins] = useState(() => createBindingMargins("none"));
  const [bindingSide, setBindingSide] = useState<BindingSide | "custom">("none");
  const [gap, setGap] = useState(4);
  const [background, setBackground] = useState("#ffffff");
  const [showNames, setShowNames] = useState(false);
  const [photoAdjustments, setPhotoAdjustments] = useState<PhotoAdjustments>(
    DEFAULT_PHOTO_ADJUSTMENTS,
  );
  const [albumTitle, setAlbumTitle] = useState(DEFAULT_TITLE);
  const [subtitle, setSubtitle] = useState("Kumpulan momen terbaik");
  const [brandName, setBrandName] = useState("AlbumKu");
  const [pageIndex, setCurrentPage] = useState(0);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [sortMode, setSortMode] = useState<SortMode>("oldest");
  const [mode, setMode] = useState<"album" | "print">("album");
  const [previewZoom, setPreviewZoom] = useState(100);
  const [previewWidth, setPreviewWidth] = useState(360);
  const stageRef = useRef<HTMLDivElement>(null);
  const [printSettings, setPrintSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);

  const selectedTemplate =
    TEMPLATES.find((template) => template.id === templateId) ?? TEMPLATES[0];
  const optimizationPreset =
    OPTIMIZATION_PRESETS.find((preset) => preset.id === optimizationPresetId) ??
    OPTIMIZATION_PRESETS[1];
  const selectedPaper =
    PAPER_SIZES.find((paper) => paper.id === paperId) ?? PAPER_SIZES[0];
  const coverPhoto = photos.find((photo) => photo.id === coverPhotoId) ?? photos[0];
  const contentPhotos = useMemo(
    () =>
      includeCover && excludeCoverFromContent && coverPhoto
        ? photos.filter((photo) => photo.id !== coverPhoto.id)
        : photos,
    [photos, includeCover, excludeCoverFromContent, coverPhoto],
  );
  const pages = useMemo(
    () => buildAlbumPages(contentPhotos, selectedTemplate.id, useVariety, pageTemplateOverrides),
    [contentPhotos, selectedTemplate.id, useVariety, pageTemplateOverrides],
  );
  const displayPages = pages.length
    ? pages
    : [{ templateId: selectedTemplate.id, items: [] as AlbumPhoto[] }];
  const contentPageCount = pages.length || 1;
  const printSize = PRINT_SIZES.find((size) => size.id === printSettings.sizeId);
  const printLayout = useMemo(() => packPrintSheet(printSize?.width ?? printSettings.customWidth,
    printSize?.height ?? printSettings.customHeight, printSettings.gap, printSettings.landscape), [printSize, printSettings]);
  const printPages = useMemo(() => buildPrintPages(photos, printSettings.copies, printLayout.capacity), [photos, printSettings.copies, printLayout.capacity]);
  const totalPageCount = mode === "print" ? Math.max(1, printPages.length) : contentPageCount + (includeCover ? 1 : 0);
  const currentPage = Math.min(pageIndex, totalPageCount - 1);
  const coverPhotos = coverPhoto
    ? [coverPhoto, ...photos.filter((photo) => photo.id !== coverPhoto.id)].slice(0, 3)
    : [];
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId);
  const currentContentPageIndex = currentPage - (includeCover ? 1 : 0);
  const currentContentPage =
    mode === "album" && currentContentPageIndex >= 0 ? displayPages[currentContentPageIndex] : null;
  const currentTemplate = currentContentPage
    ? TEMPLATES.find((template) => template.id === currentContentPage.templateId)
    : null;
  const currentAvailableTemplates = currentContentPage
    ? TEMPLATES
    : [];
  const totalOriginalSize = photos.reduce(
    (sum, photo) => sum + (photo.originalSize || 0),
    0,
  );
  const totalOptimizedSize = photos.reduce(
    (sum, photo) => sum + (photo.optimizedSize || 0),
    0,
  );
  const pageWidth =
    mode === "print" ? printLayout.sheet.width : orientation === "portrait" ? selectedPaper.widthMm : selectedPaper.heightMm;
  const pageHeight =
    mode === "print" ? printLayout.sheet.height : orientation === "portrait" ? selectedPaper.heightMm : selectedPaper.widthMm;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const resize = () => {
      const availableWidth = Math.max(160, stage.clientWidth - (window.innerWidth < 760 ? 50 : 130));
      const availableHeight = Math.max(240, Math.min(window.innerHeight * 0.53, 620));
      setPreviewWidth(Math.min(availableWidth, availableHeight * pageWidth / pageHeight));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(stage); window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [pageWidth, pageHeight]);

  const settings = useMemo(() => ({
    templateId, useVariety, pageTemplateOverrides, includeCover, excludeCoverFromContent,
    coverTemplateId, coverPhotoId, coverTransform, optimizationPresetId, paperId, orientation,
    margins, bindingSide, gap, background, showNames, photoAdjustments, albumTitle, subtitle,
    brandName, sortMode, mode, printSettings, previewZoom, currentPage,
  }), [templateId, useVariety, pageTemplateOverrides, includeCover, excludeCoverFromContent,
    coverTemplateId, coverPhotoId, coverTransform, optimizationPresetId, paperId, orientation,
    margins, bindingSide, gap, background, showNames, photoAdjustments, albumTitle, subtitle,
    brandName, sortMode, mode, printSettings, previewZoom, currentPage]);
  const snapshot = useMemo(() => ({
    photos: photos.map((photo) => {
      const stored = { ...photo } as Partial<AlbumPhoto>;
      delete stored.url;
      return stored as StoredPhoto;
    }), settings,
  }), [photos, settings]);

  function applyProject(savedProject: Project<typeof settings>) {
    const preferences = savedProject.settings;
    const number = (value: unknown, fallback: number, min: number, max: number) =>
      typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
    const string = (value: unknown, fallback: string, limit: number) =>
      typeof value === "string" ? value.slice(0, limit) : fallback;
    const nextPhotos = savedProject.photos.map((photo) => ({ ...photo, url: URL.createObjectURL(photo.blob) }));
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos(nextPhotos);
    setSelectedPhotoId(null);
    setTemplateId(TEMPLATES.some((t) => t.id === preferences.templateId) ? preferences.templateId : "grid-4");
    setUseVariety(preferences.useVariety === true);
    const overrides: Record<number, string> = {};
    if (preferences.pageTemplateOverrides && typeof preferences.pageTemplateOverrides === "object") {
      for (const [index, value] of Object.entries(preferences.pageTemplateOverrides)) {
        if (/^\d+$/.test(index) && Number(index) < 5000 && TEMPLATES.some((t) => t.id === value)) overrides[Number(index)] = value;
      }
    }
    setPageTemplateOverrides(overrides);
    setIncludeCover(preferences.includeCover !== false);
    setExcludeCoverFromContent(preferences.excludeCoverFromContent !== false);
    setCoverTemplateId(COVER_TEMPLATES.some((t) => t.id === preferences.coverTemplateId) ? preferences.coverTemplateId : "full");
    setCoverPhotoId(nextPhotos.some((photo) => photo.id === preferences.coverPhotoId) ? preferences.coverPhotoId : nextPhotos[0]?.id ?? null);
    const transform = preferences.coverTransform ?? DEFAULT_COVER_TRANSFORM;
    setCoverTransform({ ...normalizePhotoTransform(number(transform.positionX, 0, -50, 50), number(transform.positionY, 0, -50, 50), number(transform.scale, 1, 0.5, 3)), rotation: number(transform.rotation, 0, 0, 360) });
    setOptimizationPresetId(OPTIMIZATION_PRESETS.some((p) => p.id === preferences.optimizationPresetId) ? preferences.optimizationPresetId : "balanced");
    setPaperId(PAPER_SIZES.some((p) => p.id === preferences.paperId) ? preferences.paperId : "a4");
    setOrientation(preferences.orientation === "landscape" ? "landscape" : "portrait");
    const savedMargins = preferences.margins ?? createBindingMargins("none");
    setMargins({ top: number(savedMargins.top, 10, 0, 40), right: number(savedMargins.right, 10, 0, 40), bottom: number(savedMargins.bottom, 10, 0, 40), left: number(savedMargins.left, 10, 0, 40) });
    setBindingSide(["none", "left", "right", "top", "custom"].includes(preferences.bindingSide) ? preferences.bindingSide : "none");
    setGap(number(preferences.gap, 4, 0, 15));
    setBackground(/^#[0-9a-f]{6}$/i.test(preferences.background) ? preferences.background : "#ffffff");
    setShowNames(preferences.showNames === true);
    const adjustment = preferences.photoAdjustments ?? DEFAULT_PHOTO_ADJUSTMENTS;
    setPhotoAdjustments(normalizePhotoAdjustments(adjustment.brightness, adjustment.contrast, adjustment.saturation));
    setAlbumTitle(string(preferences.albumTitle, DEFAULT_TITLE, 60));
    setSubtitle(string(preferences.subtitle, "", 80));
    setBrandName(string(preferences.brandName, "AlbumKu", 28));
    setSortMode(["oldest", "newest", "name", "manual"].includes(preferences.sortMode) ? preferences.sortMode : "oldest");
    setMode(preferences.mode === "print" ? "print" : "album");
    const print = preferences.printSettings ?? DEFAULT_PRINT_SETTINGS;
    setPrintSettings({
      sizeId: print.sizeId === "custom" || PRINT_SIZES.some((s) => s.id === print.sizeId) ? print.sizeId : "4r",
      customWidth: number(print.customWidth, 100, 10, 470), customHeight: number(print.customHeight, 150, 10, 470),
      copies: Math.round(number(print.copies, 1, 1, 50)), gap: number(print.gap, 3, 0, 10),
      marks: ["none", "border", "cuts"].includes(print.marks) ? print.marks : "cuts", landscape: print.landscape === true,
    });
    setPreviewZoom(number(preferences.previewZoom, 100, 50, 200));
    setCurrentPage(Math.round(number(preferences.currentPage, 0, 0, 5000)));
  }
  const project = useProjects(snapshot, applyProject);
  const locked = !project.ready || project.busy || isProcessing || isSavingPdf;

  async function projectAction(action: () => Promise<unknown>) {
    try { await action(); }
    catch (error) { setToast({ tone: "warning", message: error instanceof Error ? error.message : "Operasi proyek belum berhasil." }); }
  }
  async function downloadBackup() {
    const blob = await project.backup();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `${project.name.replace(/[^a-z0-9-]/gi, "-") || "proyek"}.albumku`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function addFiles(files: FileList | File[]) {
    if (locked) return;
    const accepted: AlbumPhoto[] = [];
    const errors: string[] = [];
    const validFiles = Array.from(files).filter((file) => {
      const validation = validateImageFile(file, DEFAULT_MAX_FILE_SIZE);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.reason}`);
        return false;
      }
      return true;
    });

    setIsProcessing(validFiles.length > 0);
    for (const file of validFiles) {
      try {
        const date = resolvePhotoDate(file.name, file.lastModified,
          file.type === "image/jpeg" ? readExifDate(await file.slice(0, 256 * 1024).arrayBuffer()) : null);
        const optimized = await optimizeImage(
          file,
          optimizationPreset.maxDimension,
          optimizationPreset.quality,
        );
        accepted.push({
          id: makeId(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          url: URL.createObjectURL(optimized),
          blob: optimized,
          timestamp: date.timestamp,
          dateSource: date.source,
          rotation: 0,
          fit: "cover",
          originalSize: file.size,
          optimizedSize: optimized.size,
          positionX: 0,
          positionY: 0,
          scale: 1,
        });
      } catch {
        errors.push(`${file.name}: gagal diproses`);
      }
    }
    setIsProcessing(false);

    if (accepted.length) {
      setPhotos((current) => sortPhotos([...current, ...accepted], sortMode));
      setCoverPhotoId((current) => current ?? sortPhotos(accepted, sortMode)[0].id);
      const originalBytes = accepted.reduce((sum, photo) => sum + photo.originalSize, 0);
      const optimizedBytes = accepted.reduce((sum, photo) => sum + photo.optimizedSize, 0);
      setToast({
        tone: "success",
        message: `${accepted.length} foto siap · ${formatFileSize(originalBytes)} diperkecil menjadi ${formatFileSize(optimizedBytes)}.`,
      });
    }
    if (errors.length) {
      setToast({
        tone: "warning",
        message: `${errors.length} file dilewati. Gunakan JPG, PNG, atau WebP maks. ${formatFileSize(DEFAULT_MAX_FILE_SIZE)}.`,
      });
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void addFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setIsDropActive(false);
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  }

  function updatePhoto(id: string, patch: Partial<AlbumPhoto>) {
    setPhotos((current) =>
      current.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)),
    );
  }

  function updatePhotoTransform(
    id: string,
    positionX: number,
    positionY: number,
    scale: number,
  ) {
    updatePhoto(id, normalizePhotoTransform(positionX, positionY, scale));
  }

  function updateCoverTransform(positionX: number, positionY: number, scale: number) {
    const normalized = normalizePhotoTransform(positionX, positionY, scale);
    setCoverTransform((current) => ({ ...current, ...normalized }));
  }

  function applyBindingPreset(side: BindingSide | "custom") {
    setBindingSide(side);
    if (side !== "custom") setMargins(createBindingMargins(side));
  }

  function updateMargin(side: keyof typeof margins, value: number) {
    const safeValue = Math.min(40, Math.max(0, value || 0));
    setMargins((current) => ({ ...current, [side]: safeValue }));
    setBindingSide("custom");
  }

  function applyPhotoAdjustmentPreset(presetId: string) {
    const preset = PHOTO_ADJUSTMENT_PRESETS.find((candidate) => candidate.id === presetId);
    if (preset) setPhotoAdjustments({ ...preset.adjustments });
  }

  function updatePhotoAdjustment(
    property: keyof PhotoAdjustments,
    value: number,
  ) {
    setPhotoAdjustments((current) =>
      normalizePhotoAdjustments(
        property === "brightness" ? value : current.brightness,
        property === "contrast" ? value : current.contrast,
        property === "saturation" ? value : current.saturation,
      ),
    );
  }

  function setCurrentPageTemplate(templateIdForPage: string) {
    if (currentContentPageIndex < 0) return;
    setPageTemplateOverrides((current) => ({
      ...current,
      [currentContentPageIndex]: templateIdForPage,
    }));
  }

  function cycleCurrentPageTemplate() {
    if (!currentContentPage || !currentTemplate) return;
    const sameCapacity = currentAvailableTemplates.filter(
      (template) => template.slots === currentTemplate.slots,
    );
    const candidates = sameCapacity.length > 1 ? sameCapacity : currentAvailableTemplates;
    const currentIndex = candidates.findIndex(
      (template) => template.id === currentTemplate.id,
    );
    const nextTemplate = candidates[(currentIndex + 1) % candidates.length];
    if (nextTemplate) setCurrentPageTemplate(nextTemplate.id);
  }

  function resetCurrentPageTemplate() {
    if (currentContentPageIndex < 0) return;
    setPageTemplateOverrides((current) => {
      const next = { ...current };
      delete next[currentContentPageIndex];
      return next;
    });
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const photo = current.find((item) => item.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return current.filter((item) => item.id !== id);
    });
    if (selectedPhotoId === id) setSelectedPhotoId(null);
    if (coverPhotoId === id) setCoverPhotoId(null);
  }

  function movePhoto(id: string, direction: -1 | 1) {
    setSortMode("manual");
    setPhotos((current) => {
      const from = current.findIndex((photo) => photo.id === id);
      const to = from + direction;
      return moveItem(current, from, to);
    });
  }

  function dropPhotoOn(targetId: string) {
    if (!draggedPhotoId || draggedPhotoId === targetId) return;
    setSortMode("manual");
    setPhotos((current) => {
      const from = current.findIndex((photo) => photo.id === draggedPhotoId);
      const to = current.findIndex((photo) => photo.id === targetId);
      return moveItem(current, from, to);
    });
    setDraggedPhotoId(null);
  }

  function clearAlbum() {
    if (!photos.length) return;
    const confirmed = window.confirm(
      "Hapus semua foto dari album? File asli di komputer tidak akan terhapus.",
    );
    if (!confirmed) return;
    photos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setPhotos([]);
    setSelectedPhotoId(null);
    setCoverPhotoId(null);
    setPageTemplateOverrides({});
    setCurrentPage(0);
  }

  function printAlbum() {
    if (locked || (mode === "print" && !printLayout.capacity)) return;
    if (!photos.length) {
      setToast({ tone: "warning", message: "Tambahkan foto sebelum mencetak album." });
      return;
    }
    window.print();
  }

  async function savePdf() {
    if (!photos.length || locked || (mode === "print" && !printLayout.capacity)) {
      if (!photos.length) setToast({ tone: "warning", message: "Tambahkan foto sebelum menyimpan PDF." });
      return;
    }
    setIsSavingPdf(true); setPdfProgress(0);
    try {
      await document.fonts.ready;
      const { jsPDF } = await import("jspdf");
      const pageElements = Array.from(document.querySelectorAll<HTMLElement>(".screen-pages .album-page"));
      const orientationName = pageWidth > pageHeight ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation: orientationName, unit: "mm", format: [pageWidth, pageHeight], compress: true });
      const visible = pageElements.find((element) => element.classList.contains("is-current")) ?? pageElements[0];
      // offsetWidth tidak terpengaruh zoom pratinjau; ukuran tangkapan selalu mengikuti rasio kertas.
      const captureWidth = Math.max(1, visible.offsetWidth);
      const captureHeight = captureWidth * pageHeight / pageWidth;
      const targetPixels = mode === "print" ? 3600 : optimizationPresetId === "high" ? 3000 : 2200;
      const captureScale = Math.min(32, targetPixels / captureHeight);
      for (let index = 0; index < pageElements.length; index++) {
        const canvas = await capturePage(pageElements[index], captureWidth, captureHeight, captureScale, photoAdjustments, mode === "print" ? "#ffffff" : background);
        if (index > 0) pdf.addPage([pageWidth, pageHeight], orientationName);
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
        canvas.width = 0; canvas.height = 0;
        setPdfProgress(Math.round((index + 1) / pageElements.length * 100));
      }
      pdf.save(createPdfFilename(mode === "print" ? `${albumTitle}-cetak-${printSize?.name ?? "custom"}` : albumTitle, brandName));
      setToast({ tone: "success", message: `PDF diunduh (${pageElements.length} halaman), termasuk foto dan koreksi warna.` });
    } catch (error) {
      console.error("Ekspor PDF gagal:", error);
      setToast({ tone: "warning", message: "PDF belum berhasil dibuat. Foto gagal dibaca atau memori browser penuh. Coba kualitas Seimbang atau tombol Cetak." });
    } finally { setIsSavingPdf(false); setPdfProgress(0); }
  }

  const pageStyle = {
    width: `${previewWidth}px`,
    height: `${previewWidth * pageHeight / pageWidth}px`,
    "--page-ratio": `${pageWidth} / ${pageHeight}`,
    "--render-width": `${previewWidth}px`,
    "--print-page-width": `${pageWidth}mm`,
    "--page-margin-top": `${margins.top / pageWidth * previewWidth}px`,
    "--page-margin-right": `${margins.right / pageWidth * previewWidth}px`,
    "--page-margin-bottom": `${margins.bottom / pageWidth * previewWidth}px`,
    "--page-margin-left": `${margins.left / pageWidth * previewWidth}px`,
    "--print-margin-top": `${margins.top}mm`,
    "--print-margin-right": `${margins.right}mm`,
    "--print-margin-bottom": `${margins.bottom}mm`,
    "--print-margin-left": `${margins.left}mm`,
    "--photo-gap": `calc(var(--render-width) * ${gap / pageWidth})`,
    "--paper-background": background,
    "--photo-filter": createPhotoAdjustmentFilter(photoAdjustments),
  } as React.CSSProperties;

  return (
    <main className={`app-shell mode-${mode}`} style={{ "--photo-filter": createPhotoAdjustmentFilter(photoAdjustments) } as React.CSSProperties}>
      <style>{`@page { size: ${pageWidth}mm ${pageHeight}mm; margin: 0; }`}</style>

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            {brandName.trim().charAt(0).toUpperCase() || "A"}
          </div>
          <div>
            <strong>{brandName || "AlbumKu"}</strong>
            <span>Studio cetak foto</span>
          </div>
        </div>
        <div className="topbar-center">
          <span className="privacy-dot" aria-hidden="true" />
          <span>100% lokal · foto tidak diunggah</span>
        </div>
        <div className="topbar-actions">
          <button className="button ghost compact" onClick={() => setShowHelp(true)}>
            Bantuan
          </button>
          <button className="button ghost print-button" onClick={printAlbum} disabled={locked || !photos.length || (mode === "print" && !printLayout.capacity)}>
            <span aria-hidden="true">⌘</span>
            Cetak
          </button>
          <button
            className="button primary"
            onClick={() => void savePdf()}
            disabled={locked || !photos.length || (mode === "print" && !printLayout.capacity)}
          >
            <span aria-hidden="true">{isSavingPdf ? "…" : "↓"}</span>
            {isSavingPdf ? `Membuat PDF ${pdfProgress}%` : "Simpan PDF"}
          </button>
        </div>
      </header>

      <div className="workspace" inert={!project.ready || project.busy || isSavingPdf ? true : undefined}>
        <aside className="control-panel" aria-label="Pengaturan album">
          <section className="panel-section project-panel">
            <div className="section-heading"><h2>Proyek saya</h2><small role="status">{project.status}</small></div>
            <label className="brand-field"><span>Nama proyek</span><input aria-label="Nama proyek" value={project.name} maxLength={80} onChange={(event) => project.setName(event.target.value)} /></label>
            <label className="brand-field"><span>Buka proyek tersimpan</span>
              <select value={project.id} onChange={(event) => void projectAction(() => project.open(event.target.value))} disabled={locked}>
                {!project.projects.some((p) => p.id === project.id) && <option value={project.id}>{project.name}</option>}
                {project.projects.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.photoCount} foto</option>)}
              </select>
            </label>
            <div className="project-actions">
              <button disabled={locked} onClick={() => void projectAction(() => project.create({ ...settings, albumTitle: DEFAULT_TITLE, pageTemplateOverrides: {}, coverPhotoId: null, coverTransform: DEFAULT_COVER_TRANSFORM, currentPage: 0 }))}>＋ Proyek baru</button>
              <button disabled={locked} onClick={() => void projectAction(project.persist)}>Simpan sekarang</button>
              <button disabled={locked} onClick={() => void projectAction(downloadBackup)}>↓ Cadangan proyek</button>
              <button disabled={locked} onClick={() => projectInputRef.current?.click()}>Buka cadangan</button>
            </div>
            <input ref={projectInputRef} type="file" accept=".albumku,application/json" className="visually-hidden" aria-label="Buka berkas proyek AlbumKu" onChange={(event) => {
              const file = event.target.files?.[0]; if (file) void projectAction(() => project.restore(file)); event.target.value = "";
            }} />
            <p className="panel-hint">Foto dan edit tersimpan di browser ini. Tunggu “Tersimpan otomatis” sebelum refresh. Unduh cadangan untuk pindah browser/komputer.</p>
            {project.error && <p className="project-error" role="alert">{project.error}</p>}
          </section>
          <section className="panel-section">
            <div className="layout-mode" role="group" aria-label="Jenis pekerjaan">
              <button className={mode === "album" ? "selected" : ""} aria-pressed={mode === "album"} onClick={() => { setMode("album"); setCurrentPage(0); }}>Album foto</button>
              <button className={mode === "print" ? "selected" : ""} aria-pressed={mode === "print"} onClick={() => { setMode("print"); setCurrentPage(0); }}>Cetak foto A3+</button>
            </div>
          </section>
          {mode === "album" && <nav className="steps" aria-label="Tahapan membuat album">
            <div className={`step ${photos.length ? "complete" : "active"}`}>
              <span>1</span>
              <div>
                <strong>Pilih foto</strong>
                <small>{photos.length ? `${photos.length} foto siap` : "Mulai di sini"}</small>
              </div>
            </div>
            <div className={`step ${photos.length ? "active" : ""}`}>
              <span>2</span>
              <div>
                <strong>Buat cover</strong>
                <small>{includeCover ? "Cover aktif" : "Tanpa cover"}</small>
              </div>
            </div>
            <div className="step">
              <span>3</span>
              <div>
                <strong>Atur isi</strong>
                <small>{useVariety ? "Variasi otomatis" : selectedTemplate.name}</small>
              </div>
            </div>
            <div className="step">
              <span>4</span>
              <div>
                <strong>Cetak</strong>
                <small>PDF atau printer</small>
              </div>
            </div>
          </nav>}

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">01 · FOTO</span>
                <h2>Koleksi foto</h2>
              </div>
              {photos.length > 0 && (
                <button className="text-button danger" onClick={clearAlbum}>
                  Kosongkan
                </button>
              )}
            </div>

            <button
              className={`upload-zone ${isDropActive ? "is-dragging" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDropActive(true);
              }}
              onDragLeave={() => setIsDropActive(false)}
              onDrop={handleDrop}
            >
              <span className="upload-symbol" aria-hidden="true">
                ＋
              </span>
              <span>
                <strong>{isProcessing ? "Mengoptimalkan foto…" : "Pilih banyak foto"}</strong>
                <small>
                  {isProcessing
                    ? "Tunggu sebentar, file asli tetap aman"
                    : "atau tarik ke sini · JPG, PNG, WebP"}
                </small>
              </span>
            </button>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={handleInputChange}
              aria-label="Pilih foto dari komputer"
            />
            <label className="brand-field"><span>Urutkan foto otomatis</span>
              <select aria-label="Urutan foto" value={sortMode} onChange={(event) => {
                const next = event.target.value as SortMode; setSortMode(next); setPhotos((current) => sortPhotos(current, next));
              }}>
                <option value="oldest">Terlama → terbaru</option><option value="newest">Terbaru → terlama</option>
                <option value="name">Nama file (1, 2, 10)</option><option value="manual">Manual / urutan saya</option>
              </select>
            </label>
            <button className="text-button" onClick={() => { setSortMode("oldest"); setPhotos((current) => sortPhotos(current, "oldest")); }}>↻ Auto sort terlama dahulu</button>
            <p className="panel-hint">Tanggal pengambilan → tanggal pada nama file → tanggal file. Foto unduhan tanpa informasi tanggal asli tidak dapat ditebak. Menggeser foto beralih ke Manual.</p>
            <label className="optimization-field">
              <span>
                <strong>Ukuran hasil PDF</strong>
                <small>Foto baru akan diperkecil saat masuk</small>
              </span>
              <select
                value={optimizationPresetId}
                onChange={(event) => setOptimizationPresetId(event.target.value)}
                disabled={isProcessing}
              >
                {OPTIMIZATION_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            {photos.length > 0 && totalOriginalSize > 0 && (
              <div className="size-saving">
                <span>Penghematan sesi ini</span>
                <strong>
                  {formatFileSize(totalOriginalSize)} → {formatFileSize(totalOptimizedSize)}
                </strong>
              </div>
            )}
          </section>

          {mode === "album" && <><section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">02 · COVER</span>
                <h2>Halaman pembuka</h2>
              </div>
              <label className="tiny-switch">
                <input
                  type="checkbox"
                  checked={includeCover}
                  onChange={(event) => setIncludeCover(event.target.checked)}
                />
                <span>{includeCover ? "Aktif" : "Mati"}</span>
              </label>
            </div>
            <div className={`cover-options ${includeCover ? "" : "disabled"}`}>
              {COVER_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  className={`cover-option ${coverTemplateId === template.id ? "selected" : ""}`}
                  onClick={() => setCoverTemplateId(template.id)}
                  aria-pressed={coverTemplateId === template.id}
                  disabled={!includeCover}
                >
                  <span className={`cover-mini cover-mini-${template.id}`} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="panel-hint">
              Klik foto di bawah lalu pilih “Jadikan cover” untuk mengganti foto utama.
            </p>
            <label className="cover-separate-toggle">
              <span>
                <strong>Pisahkan foto cover dari halaman isi</strong>
                <small>Foto cover tidak diulang pada halaman 1</small>
              </span>
              <input
                type="checkbox"
                checked={excludeCoverFromContent}
                onChange={(event) => setExcludeCoverFromContent(event.target.checked)}
                disabled={!includeCover}
              />
            </label>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">03 · TEMPLATE ISI</span>
                <h2>Susunan halaman</h2>
              </div>
              <span className="section-value">
                {useVariety ? "Campuran" : `${selectedTemplate.slots} foto`}
              </span>
            </div>
            <div className="layout-mode" role="group" aria-label="Mode susunan halaman">
              <button
                className={!useVariety ? "selected" : ""}
                onClick={() => setUseVariety(false)}
                aria-pressed={!useVariety}
              >
                Seragam
              </button>
              <button
                className={useVariety ? "selected" : ""}
                onClick={() => setUseVariety(true)}
                aria-pressed={useVariety}
              >
                Variasi otomatis
              </button>
            </div>
            <p className="panel-hint">
              Variasi otomatis memadukan halaman sorotan, grid rapi, dan halaman hemat.
            </p>
            <div className="template-grid">
              {TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  className={`template-card ${template.id === templateId ? "selected" : ""}`}
                  onClick={() => { setTemplateId(template.id); setPageTemplateOverrides({}); }}
                  aria-pressed={template.id === templateId}
                >
                  <span className={`mini-layout mini-${template.id}`} aria-hidden="true">
                    {Array.from({ length: template.slots }).map((_, index) => (
                      <i key={index} />
                    ))}
                  </span>
                  <span>{template.name}</span>
                </button>
              ))}
            </div>
          </section></>}

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">04 · TAMPILAN</span>
                <h2>Pengaturan cetak</h2>
              </div>
            </div>

            {mode === "album" ? <><div className="form-grid">
              <label>
                <span>Ukuran kertas</span>
                <select value={paperId} onChange={(event) => setPaperId(event.target.value)}>
                  {PAPER_SIZES.map((paper) => (
                    <option key={paper.id} value={paper.id}>
                      {paper.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Orientasi</span>
                <select
                  value={orientation}
                  onChange={(event) =>
                    setOrientation(event.target.value as "portrait" | "landscape")
                  }
                >
                  <option value="portrait">Berdiri</option>
                  <option value="landscape">Mendatar</option>
                </select>
              </label>
            </div>

            <label className="brand-field">
              <span>Nama merek pada album</span>
              <input
                value={brandName}
                onChange={(event) => setBrandName(event.target.value)}
                maxLength={28}
                placeholder="Contoh: Studio Foto Wina"
              />
            </label>

            <div className="margin-editor">
              <div className="margin-heading">
                <span>
                  <strong>Margin & area jilid</strong>
                  <small>Ruang kosong aman dari potongan dan jilid</small>
                </span>
                <select
                  value={bindingSide}
                  onChange={(event) =>
                    applyBindingPreset(event.target.value as BindingSide | "custom")
                  }
                  aria-label="Pilih sisi jilid"
                >
                  <option value="none">Tanpa jilid</option>
                  <option value="left">Jilid kiri</option>
                  <option value="right">Jilid kanan</option>
                  <option value="top">Jilid atas</option>
                  <option value="custom">Manual</option>
                </select>
              </div>
              <div className="margin-grid">
                {(
                  [
                    ["top", "Atas"],
                    ["right", "Kanan"],
                    ["bottom", "Bawah"],
                    ["left", "Kiri"],
                  ] as const
                ).map(([side, label]) => (
                  <label key={side}>
                    <span>{label}</span>
                    <span className="number-suffix">
                      <input
                        type="number"
                        min="0"
                        max="40"
                        value={margins[side]}
                        onChange={(event) => updateMargin(side, Number(event.target.value))}
                      />
                      <i>mm</i>
                    </span>
                  </label>
                ))}
              </div>
              <p>
                Preset jilid memberi ruang 22 mm pada sisi jilid dan 10 mm pada sisi lainnya.
              </p>
            </div>

            <label className="range-field">
              <span>
                Jarak antar foto <strong>{gap} mm</strong>
              </span>
              <input
                type="range"
                min="0"
                max="15"
                value={gap}
                onChange={(event) => setGap(Number(event.target.value))}
              />
            </label>

            <div className="color-field">
              <span>Warna halaman</span>
              <div className="swatches">
                {BACKGROUNDS.map((color) => (
                  <button
                    key={color.value}
                    className={background === color.value ? "selected" : ""}
                    style={{ background: color.value }}
                    onClick={() => setBackground(color.value)}
                    aria-label={`Warna ${color.label}`}
                    aria-pressed={background === color.value}
                  />
                ))}
                <label className="custom-color" title="Pilih warna lain">
                  <input
                    type="color"
                    value={background}
                    onChange={(event) => setBackground(event.target.value)}
                  />
                  <span aria-hidden="true">＋</span>
                </label>
              </div>
            </div>

            </> : <>
              <div className="print-summary"><strong>A3+ · 329 × 483 mm</strong><span>Area aman {printLayout.safe.width} × {printLayout.safe.height} mm</span><span>{printLayout.capacity} foto per lembar · {printPages.length} lembar</span></div>
              <div className="form-grid">
                <label><span>Ukuran foto</span><select aria-label="Ukuran cetak foto" value={printSettings.sizeId} onChange={(event) => setPrintSettings((s) => ({ ...s, sizeId: event.target.value }))}>
                  {PRINT_SIZES.map((s) => <option value={s.id} key={s.id}>{s.name} · {s.width} × {s.height} mm</option>)}<option value="custom">Ukuran sendiri</option>
                </select></label>
                <label><span>Salinan tiap foto</span><input aria-label="Salinan tiap foto" type="number" min={1} max={50} value={printSettings.copies} onChange={(event) => setPrintSettings((s) => ({ ...s, copies: Math.min(50, Math.max(1, Math.round(Number(event.target.value) || 1))) }))} /></label>
              </div>
              {printSettings.sizeId === "custom" && <div className="form-grid">
                {([ ["customWidth", "Lebar foto (mm)"], ["customHeight", "Tinggi foto (mm)"] ] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min={10} max={470} value={printSettings[key]} onChange={(event) => setPrintSettings((s) => ({ ...s, [key]: Math.min(470, Math.max(10, Number(event.target.value) || 10)) }))} /></label>)}
              </div>}
              <label className="brand-field"><span>Orientasi lembar</span><select value={printSettings.landscape ? "landscape" : "portrait"} onChange={(event) => setPrintSettings((s) => ({ ...s, landscape: event.target.value === "landscape" }))}><option value="portrait">Berdiri</option><option value="landscape">Mendatar</option></select></label>
              <label className="range-field"><span>Jarak antar foto <strong>{printSettings.gap} mm</strong></span><input type="range" min={0} max={10} step={0.5} value={printSettings.gap} onChange={(event) => setPrintSettings((s) => ({ ...s, gap: Number(event.target.value) }))} /></label>
              <label className="brand-field"><span>Penanda potongan</span><select aria-label="Penanda potongan" value={printSettings.marks} onChange={(event) => setPrintSettings((s) => ({ ...s, marks: event.target.value as PrintSettings["marks"] }))}><option value="cuts">Garis potong pendek</option><option value="border">Border tipis 0,15 mm</option><option value="none">Tanpa penanda</option></select></label>
              <p className="panel-hint">Foto diputar otomatis bila menambah kapasitas; foto sisanya masuk lembar berikutnya. Garis putus-putus area aman hanya untuk pratinjau.</p>
              <p className="print-warning">Cetak dengan ukuran sebenarnya / skala 100%, kertas A3+ 329 × 483 mm, tanpa “Fit to page”. Ukuran R dapat berbeda di tiap lab; gunakan ukuran sendiri bila diperlukan.</p>
              {!printLayout.capacity && <p role="alert" className="project-error">Ukuran ini tidak muat dalam area aman. Perkecil ukuran foto.</p>}
            </>}
            <div className="print-adjustment-editor">
              <div className="adjustment-heading">
                <span>
                  <strong>Koreksi hasil cetak</strong>
                  <small>Mencerahkan foto tanpa mengubah file asli</small>
                </span>
                <select
                  value={
                    PHOTO_ADJUSTMENT_PRESETS.find(
                      (preset) =>
                        preset.adjustments.brightness === photoAdjustments.brightness &&
                        preset.adjustments.contrast === photoAdjustments.contrast &&
                        preset.adjustments.saturation === photoAdjustments.saturation,
                    )?.id ?? "custom"
                  }
                  onChange={(event) => applyPhotoAdjustmentPreset(event.target.value)}
                  aria-label="Preset koreksi hasil cetak"
                >
                  {PHOTO_ADJUSTMENT_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                  <option value="custom" disabled>
                    Manual
                  </option>
                </select>
              </div>
              <p>
                Foto di kertas biasanya terlihat lebih gelap daripada layar. Preset cerah
                menaikkan terang secara halus dan ikut diterapkan pada Cetak serta PDF.
              </p>
              <div className="adjustment-sliders">
                <label>
                  <span>
                    Terang <strong>{photoAdjustments.brightness}%</strong>
                  </span>
                  <input
                    type="range"
                    min="80"
                    max="140"
                    value={photoAdjustments.brightness}
                    onChange={(event) =>
                      updatePhotoAdjustment("brightness", Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  <span>
                    Kontras <strong>{photoAdjustments.contrast}%</strong>
                  </span>
                  <input
                    type="range"
                    min="80"
                    max="125"
                    value={photoAdjustments.contrast}
                    onChange={(event) =>
                      updatePhotoAdjustment("contrast", Number(event.target.value))
                    }
                  />
                </label>
                <label>
                  <span>
                    Warna <strong>{photoAdjustments.saturation}%</strong>
                  </span>
                  <input
                    type="range"
                    min="70"
                    max="140"
                    value={photoAdjustments.saturation}
                    onChange={(event) =>
                      updatePhotoAdjustment("saturation", Number(event.target.value))
                    }
                  />
                </label>
              </div>
            </div>

            {mode === "album" && <label className="switch-row">
              <span>
                <strong>Tampilkan nama foto</strong>
                <small>Nama file muncul di bawah foto</small>
              </span>
              <input
                type="checkbox"
                checked={showNames}
                onChange={(event) => setShowNames(event.target.checked)}
              />
            </label>}
          </section>
        </aside>

        <section className="canvas-area">
          <div className="canvas-toolbar">
            <div className="title-fields">
              <input
                value={albumTitle}
                onChange={(event) => setAlbumTitle(event.target.value)}
                aria-label="Judul album"
                maxLength={60}
              />
              <input
                value={subtitle}
                onChange={(event) => setSubtitle(event.target.value)}
                aria-label="Subjudul album"
                maxLength={80}
              />
            </div>
            <div className="album-stats">
              <span>
                <strong>{photos.length}</strong> foto
              </span>
              <i />
              <span>
                <strong>{totalPageCount}</strong> halaman
              </span>
              <i />
              <span>
                <strong>{mode === "print" ? "A3+" : selectedPaper.name}</strong> {pageWidth > pageHeight ? "mendatar" : "berdiri"}
              </span>
            </div>
          </div>

          <div
            ref={stageRef}
            className="page-stage"
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) {
                event.preventDefault();
                setIsDropActive(true);
              }
            }}
            onDrop={handleDrop}
          >
            {!photos.length && (
              <div className="first-use-tip">
                <span aria-hidden="true">←</span>
                <div>
                  <strong>Mulai dengan foto Anda</strong>
                  <small>Pilih sekaligus, AlbumKu akan membaginya ke setiap halaman.</small>
                </div>
              </div>
            )}

            <div className="preview-zoom" role="group" aria-label="Zoom pratinjau">
              <button aria-label="Perkecil pratinjau" onClick={() => setPreviewZoom((z) => Math.max(50, z - 10))} disabled={previewZoom <= 50}>−</button>
              <input aria-label="Skala pratinjau" type="range" min={50} max={200} step={10} value={previewZoom} onChange={(event) => setPreviewZoom(Number(event.target.value))} />
              <strong>{previewZoom}%</strong>
              <button aria-label="Perbesar pratinjau" onClick={() => setPreviewZoom((z) => Math.min(200, z + 10))} disabled={previewZoom >= 200}>＋</button>
              <button onClick={() => setPreviewZoom(100)}>Reset</button><small>Hanya tampilan, bukan ukuran cetak</small>
            </div>
            <div className="preview-viewport"><div className="screen-pages" style={{ zoom: previewZoom / 100 }}>
              {mode === "print" ? (printPages.length ? printPages : [[]]).map((items, index) => <PhotoPrintPage key={index} photos={items} layout={printLayout} marks={printSettings.marks} active={currentPage === index} pageStyle={pageStyle} onSelect={setSelectedPhotoId} onTransform={updatePhotoTransform} selectedPhotoId={selectedPhotoId} />) : <>
              {includeCover && (
                <CoverPage
                  active={currentPage === 0}
                  templateId={coverTemplateId}
                  photos={coverPhotos}
                  pageStyle={pageStyle}
                  title={albumTitle}
                  subtitle={subtitle}
                  brandName={brandName}
                  transform={coverTransform}
                  onTransform={updateCoverTransform}
                />
              )}
              {displayPages.map((page, pageIndex) => (
                <AlbumPage
                  key={pageIndex}
                  pageIndex={pageIndex}
                  photos={page.items}
                  templateId={page.templateId}
                  slotCount={
                    TEMPLATES.find((template) => template.id === page.templateId)?.slots ?? 1
                  }
                  active={pageIndex + (includeCover ? 1 : 0) === currentPage}
                  pageStyle={pageStyle}
                  title={albumTitle}
                  subtitle={subtitle}
                  showNames={showNames}
                  brandName={brandName}
                  selectedPhotoId={selectedPhotoId}
                  onSelect={setSelectedPhotoId}
                  onTransform={updatePhotoTransform}
                />
              ))}</>}
            </div></div>

            <div className="page-navigation">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                aria-label="Halaman sebelumnya"
              >
                ←
              </button>
              <span>
                {mode === "album" && includeCover && currentPage === 0 ? (
                  <strong>Cover</strong>
                ) : (
                  <>
                    Halaman <strong>{currentPage + 1}</strong>
                  </>
                )}{" "}
                dari {totalPageCount}
              </span>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPageCount - 1, currentPage + 1))
                }
                disabled={currentPage === totalPageCount - 1}
                aria-label="Halaman berikutnya"
              >
                →
              </button>
            </div>
            {currentContentPage && currentTemplate && (
              <div className="page-template-editor">
                <span>
                  <small>Susunan halaman ini</small>
                  <strong>Halaman isi {currentContentPageIndex + 1}</strong>
                </span>
                <select
                  value={currentTemplate.id}
                  onChange={(event) => setCurrentPageTemplate(event.target.value)}
                  aria-label={`Template halaman isi ${currentContentPageIndex + 1}`}
                >
                  {currentAvailableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} · {template.slots} area
                    </option>
                  ))}
                </select>
                <button onClick={cycleCurrentPageTemplate}>↻ Varian lain</button>
                {pageTemplateOverrides[currentContentPageIndex] && (
                  <button className="reset-page-layout" onClick={resetCurrentPageTemplate}>
                    Ikuti otomatis
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="photo-tray">
            <div className="tray-heading">
              <div>
                <strong>Urutan foto</strong>
                <span>Tarik thumbnail untuk urutan · tarik foto besar untuk posisi</span>
              </div>
              {mode === "album" && includeCover && currentPage === 0 && coverPhoto ? (
                <div className="photo-tools cover-edit-tools">
                  <span className="selected-name">Cover: {coverPhoto.name}</span>
                  <span className="drag-hint">Tarik foto cover untuk menggeser</span>
                  <button
                    onClick={() =>
                      setCoverTransform((current) => ({
                        ...current,
                        rotation: (current.rotation + 90) % 360,
                      }))
                    }
                  >
                    ↻ Putar cover
                  </button>
                  <label className="zoom-control">
                    <span>Zoom cover</span>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      value={Math.round(coverTransform.scale * 100)}
                      onChange={(event) =>
                        updateCoverTransform(
                          coverTransform.positionX,
                          coverTransform.positionY,
                          Number(event.target.value) / 100,
                        )
                      }
                      aria-label="Perbesar foto cover"
                    />
                    <strong>{Math.round(coverTransform.scale * 100)}%</strong>
                  </label>
                  <button onClick={() => setCoverTransform(DEFAULT_COVER_TRANSFORM)}>
                    Reset cover
                  </button>
                </div>
              ) : selectedPhoto ? (
                <div className="photo-tools">
                  <span className="selected-name">{selectedPhoto.name}</span>
                  {mode === "album" && <button
                    className={coverPhoto?.id === selectedPhoto.id ? "is-cover" : ""}
                    onClick={() => {
                      setCoverPhotoId(selectedPhoto.id);
                      setCoverTransform(DEFAULT_COVER_TRANSFORM);
                      setIncludeCover(true);
                      setCurrentPage(0);
                    }}
                    title="Gunakan foto ini sebagai cover"
                  >
                    {coverPhoto?.id === selectedPhoto.id ? "✓ Cover" : "Jadikan cover"}
                  </button>}
                  <button
                    onClick={() =>
                      updatePhoto(selectedPhoto.id, {
                        rotation: (selectedPhoto.rotation + 90) % 360,
                      })
                    }
                    title="Putar foto"
                  >
                    ↻ Putar
                  </button>
                  <button
                    onClick={() =>
                      updatePhoto(selectedPhoto.id, {
                        fit: selectedPhoto.fit === "cover" ? "contain" : "cover",
                      })
                    }
                    title="Ubah cara foto memenuhi bingkai"
                  >
                    {selectedPhoto.fit === "cover" ? "Penuh" : "Utuh"}
                  </button>
                  <label className="zoom-control">
                    <span>Zoom foto</span>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      value={Math.round((selectedPhoto.scale || 1) * 100)}
                      onChange={(event) =>
                        updatePhotoTransform(
                          selectedPhoto.id,
                          selectedPhoto.positionX || 0,
                          selectedPhoto.positionY || 0,
                          Number(event.target.value) / 100,
                        )
                      }
                      aria-label={`Perbesar foto ${selectedPhoto.name}`}
                    />
                    <strong>{Math.round((selectedPhoto.scale || 1) * 100)}%</strong>
                  </label>
                  <button
                    onClick={() => updatePhotoTransform(selectedPhoto.id, 0, 0, 1)}
                    title="Kembalikan posisi dan ukuran"
                  >
                    Reset posisi
                  </button>
                  <button
                    className="danger"
                    onClick={() => removePhoto(selectedPhoto.id)}
                    title="Hapus dari album"
                  >
                    Hapus
                  </button>
                </div>
              ) : null}
            </div>

            <div className="photo-strip">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className={`photo-thumb ${photo.id === selectedPhotoId ? "selected" : ""}`}
                  draggable
                  onDragStart={() => setDraggedPhotoId(photo.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    dropPhotoOn(photo.id);
                  }}
                >
                  <button
                    className="thumb-main"
                    onClick={() => {
                      setSelectedPhotoId(photo.id);
                      if (mode === "print") { setCurrentPage(Math.max(0, printPages.findIndex((p) => p.some((item) => item.id === photo.id)))); return; }
                      if (
                        includeCover &&
                        excludeCoverFromContent &&
                        coverPhoto?.id === photo.id
                      ) {
                        setCurrentPage(0);
                        return;
                      }
                      const contentPage = pages.findIndex((page) =>
                        page.items.some((item) => item.id === photo.id),
                      );
                      setCurrentPage(
                        Math.max(0, contentPage) + (includeCover ? 1 : 0),
                      );
                    }}
                    aria-label={`Pilih foto ${photo.name}`}
                    title={`${photo.name} · ${photo.timestamp ? new Date(photo.timestamp).toLocaleString("id-ID", { timeZone: "UTC" }) : "Tanggal tidak tersedia"} (${photo.dateSource === "exif" ? "tanggal pengambilan" : photo.dateSource === "filename" ? "nama file" : "tanggal file"})`}
                  >
                    <img
                      src={photo.url}
                      data-photo-url={photo.url}
                      alt={photo.name}
                      style={{
                        objectFit: photo.fit,
                        objectPosition: `${50 + (photo.positionX || 0)}% ${50 + (photo.positionY || 0)}%`,
                        transform: `rotate(${photo.rotation}deg) scale(${photo.scale || 1})`,
                      }}
                    />
                    <span>{index + 1}</span>
                    {mode === "album" && coverPhoto?.id === photo.id && includeCover && (
                      <em className="cover-badge">Cover</em>
                    )}
                  </button>
                  <div className="thumb-movers">
                    <button
                      onClick={() => movePhoto(photo.id, -1)}
                      disabled={index === 0}
                      aria-label={`Geser ${photo.name} ke kiri`}
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => movePhoto(photo.id, 1)}
                      disabled={index === photos.length - 1}
                      aria-label={`Geser ${photo.name} ke kanan`}
                    >
                      ›
                    </button>
                  </div>
                </div>
              ))}
              <button className="add-thumb" onClick={() => fileInputRef.current?.click()}>
                <span>＋</span>
                Tambah foto
              </button>
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div className={`toast ${toast.tone}`} role="status">
          <span aria-hidden="true">{toast.tone === "success" ? "✓" : "!"}</span>
          {toast.message}
        </div>
      )}

      {showHelp && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowHelp(false)}>
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowHelp(false)}
              aria-label="Tutup bantuan"
            >
              ×
            </button>
            <span className="eyebrow">PANDUAN SINGKAT</span>
            <h2 id="help-title">Dari folder foto ke album yang tidak monoton</h2>
            <ol className="help-steps">
              <li>
                <span>1</span>
                <div>
                  <strong>Pilih seluruh foto</strong>
                  <p>Klik “Pilih banyak foto”, lalu tekan Ctrl+A di folder foto.</p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <strong>Tentukan cover</strong>
                  <p>Pilih gaya cover, lalu jadikan salah satu foto sebagai foto utama.</p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <strong>Aktifkan variasi otomatis</strong>
                  <p>AlbumKu memadukan halaman sorotan, grid, dan halaman hemat secara bergantian.</p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <strong>Rapikan bila perlu</strong>
                  <p>Tarik foto besar untuk menggeser fokus, lalu gunakan Zoom untuk memperbesar.</p>
                </div>
              </li>
              <li>
                <span>5</span>
                <div>
                  <strong>Cetak atau simpan PDF</strong>
                  <p>“Cetak” membuka printer. “Simpan PDF” langsung mengunduh berkas PDF.</p>
                </div>
              </li>
            </ol>
            <div className="help-note">
              Foto hanya dibaca oleh browser ini. Tidak ada foto yang dikirim ke internet.
              Proyek tersimpan otomatis beserta foto; unduh cadangan untuk berjaga-jaga.
              Di mode Cetak Foto A3+, gunakan skala cetak 100% agar ukuran R tidak berubah.
              Nama merek dan margin empat sisi dapat diatur pada bagian “Pengaturan cetak”.
              Preset jilid memakai ruang 22 mm pada sisi yang dipilih.
            </div>
            <button className="button primary full" onClick={() => setShowHelp(false)}>
              Mengerti, mulai membuat album
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

type CoverPageProps = {
  active: boolean;
  templateId: string;
  photos: AlbumPhoto[];
  pageStyle: React.CSSProperties;
  title: string;
  subtitle: string;
  brandName: string;
  transform: CoverTransform;
  onTransform: (positionX: number, positionY: number, scale: number) => void;
};

function PhotoPrintPage({ photos, layout, marks, active, pageStyle, onSelect, onTransform, selectedPhotoId }: {
  photos: AlbumPhoto[]; layout: ReturnType<typeof packPrintSheet>; marks: PrintSettings["marks"];
  active: boolean; pageStyle: React.CSSProperties; onSelect: (id: string) => void; selectedPhotoId: string | null;
  onTransform: AlbumPageProps["onTransform"];
}) {
  const drag = useRef<{ pointer: number; id: string; x: number; y: number; width: number; height: number; angle: number; photo: AlbumPhoto } | null>(null);
  const slots = layout.slots.slice(0, photos.length);
  return <article className={`album-page print-sheet ${active ? "is-current" : ""}`} style={pageStyle} aria-label="Pratinjau lembar cetak foto A3+">
    <div className="safe-area-guide" data-html2canvas-ignore="true" style={{ left: `${layout.insetX / layout.sheet.width * 100}%`, top: `${layout.insetY / layout.sheet.height * 100}%`, width: `${layout.safe.width / layout.sheet.width * 100}%`, height: `${layout.safe.height / layout.sheet.height * 100}%` }} />
    {slots.map((slot, index) => {
      const photo = photos[index];
      return <div key={`${photo.id}-${index}`} className={`print-photo photo-slot ${photo.id === selectedPhotoId ? "selected" : ""}`} style={{ left: `${slot.x / layout.sheet.width * 100}%`, top: `${slot.y / layout.sheet.height * 100}%`, width: `${slot.width / layout.sheet.width * 100}%`, height: `${slot.height / layout.sheet.height * 100}%` }}>
        <button onClick={() => onSelect(photo.id)} aria-label={`Atur cetak foto ${photo.name}`}
          onPointerDown={(event) => {
            onSelect(photo.id);
            const bounds = event.currentTarget.getBoundingClientRect();
            drag.current = { pointer: event.pointerId, id: photo.id, x: event.clientX, y: event.clientY,
              width: slot.rotated ? bounds.height : bounds.width, height: slot.rotated ? bounds.width : bounds.height,
              angle: (photo.rotation + (slot.rotated ? 90 : 0)) * Math.PI / 180, photo };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const value = drag.current;
            if (!value || value.pointer !== event.pointerId || value.id !== photo.id) return;
            const dx = event.clientX - value.x, dy = event.clientY - value.y;
            const x = (dx * Math.cos(value.angle) + dy * Math.sin(value.angle)) / Math.max(1, value.width) * 100;
            const y = (-dx * Math.sin(value.angle) + dy * Math.cos(value.angle)) / Math.max(1, value.height) * 100;
            onTransform(photo.id, value.photo.positionX - x / value.photo.scale, value.photo.positionY - y / value.photo.scale, value.photo.scale);
          }}
          onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
          onPointerCancel={() => { drag.current = null; }}>
          <img src={photo.url} data-photo-url={photo.url} alt={photo.name} draggable={false} style={{ objectFit: photo.fit,
            objectPosition: `${50 + photo.positionX}% ${50 + photo.positionY}%`,
            width: slot.rotated ? `${slot.height / slot.width * 100}%` : "100%",
            height: slot.rotated ? `${slot.width / slot.height * 100}%` : "100%",
            transform: `translate(-50%, -50%) rotate(${photo.rotation + (slot.rotated ? 90 : 0)}deg) scale(${photo.scale})`,
          }} />
        </button>
      </div>;
    })}
    {marks !== "none" && <svg className="cut-marks" viewBox={`0 0 ${layout.sheet.width} ${layout.sheet.height}`} preserveAspectRatio="none" aria-hidden="true">
      {slots.map((slot, index) => marks === "border" ? <rect key={index} x={slot.x + 0.075} y={slot.y + 0.075} width={slot.width - 0.15} height={slot.height - 0.15} fill="none" stroke="#222" strokeWidth="0.15" /> : (
        // Marka berada di dalam area aman, tidak mengurangi ukuran foto.
        <g key={index} fill="none" stroke="#222" strokeWidth="0.15">{[slot.x, slot.x + slot.width].flatMap((x) => [slot.y, slot.y + slot.height].map((y) => {
          const left = Math.max(layout.insetX, x - 1.2), right = Math.min(layout.insetX + layout.safe.width, x + 1.2);
          const top = Math.max(layout.insetY, y - 1.2), bottom = Math.min(layout.insetY + layout.safe.height, y + 1.2);
          return <path key={`${x}-${y}`} d={`M${left},${y} H${right} M${x},${top} V${bottom}`} />;
        }))}</g>
      ))}
    </svg>}
  </article>;
}

function CoverPage({
  active,
  templateId,
  photos,
  pageStyle,
  title,
  subtitle,
  brandName,
  transform,
  onTransform,
}: CoverPageProps) {
  const dragState = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPositionX: number;
    startPositionY: number;
    width: number;
    height: number;
  } | null>(null);

  return (
    <article
      className={`album-page cover-page cover-${templateId} ${active ? "is-current" : ""}`}
      style={pageStyle}
      aria-label="Pratinjau cover album"
    >
      <div className="cover-visuals">
        {Array.from({ length: 3 }).map((_, index) => {
          const photo = photos[index];
          return (
            <div className={`cover-photo cover-photo-${index + 1}`} key={photo?.id ?? index}>
              {photo ? (
                index === 0 ? (
                  <button
                    className="cover-drag-control"
                    onPointerDown={(event) => {
                      const bounds = event.currentTarget.getBoundingClientRect();
                      dragState.current = {
                        pointerId: event.pointerId,
                        startClientX: event.clientX,
                        startClientY: event.clientY,
                        startPositionX: transform.positionX,
                        startPositionY: transform.positionY,
                        width: bounds.width,
                        height: bounds.height,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      const drag = dragState.current;
                      if (!drag || drag.pointerId !== event.pointerId) return;
                      const deltaX =
                        ((event.clientX - drag.startClientX) / Math.max(drag.width, 1)) *
                        100;
                      const deltaY =
                        ((event.clientY - drag.startClientY) / Math.max(drag.height, 1)) *
                        100;
                      onTransform(
                        drag.startPositionX - deltaX / transform.scale,
                        drag.startPositionY - deltaY / transform.scale,
                        transform.scale,
                      );
                    }}
                    onPointerUp={(event) => {
                      dragState.current = null;
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }}
                    onPointerCancel={() => {
                      dragState.current = null;
                    }}
                    aria-label={`Geser posisi foto cover ${photo.name}`}
                  >
                    <img
                      src={photo.url}
                      data-photo-url={photo.url}
                      alt={photo.name}
                      draggable={false}
                      style={{
                        objectFit: "cover",
                        objectPosition: `${50 + transform.positionX}% ${50 + transform.positionY}%`,
                        transform: `rotate(${transform.rotation}deg) scale(${transform.scale})`,
                      }}
                    />
                  </button>
                ) : (
                  <img
                    src={photo.url}
                    data-photo-url={photo.url}
                    alt={photo.name}
                    style={{ objectFit: "cover" }}
                  />
                )
              ) : (
                <span>Foto cover</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="cover-copy">
        <span>Album foto</span>
        <h1>{title || DEFAULT_TITLE}</h1>
        <i />
        <p>{subtitle}</p>
      </div>
      <footer className="cover-footer">
        <span>Koleksi pribadi</span>
        <span>{brandName || "AlbumKu"}</span>
      </footer>
    </article>
  );
}

type AlbumPageProps = {
  pageIndex: number;
  photos: AlbumPhoto[];
  templateId: string;
  slotCount: number;
  active: boolean;
  pageStyle: React.CSSProperties;
  title: string;
  subtitle: string;
  showNames: boolean;
  brandName: string;
  selectedPhotoId: string | null;
  onSelect: (id: string) => void;
  onTransform: (id: string, positionX: number, positionY: number, scale: number) => void;
};

function AlbumPage({
  pageIndex,
  photos,
  templateId,
  slotCount,
  active,
  pageStyle,
  title,
  subtitle,
  showNames,
  brandName,
  selectedPhotoId,
  onSelect,
  onTransform,
}: AlbumPageProps) {
  const dragState = useRef<{
    id: string;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startPositionX: number;
    startPositionY: number;
    width: number;
    height: number;
    scale: number;
  } | null>(null);

  return (
    <article
      className={`album-page layout-${templateId} ${active ? "is-current" : ""}`}
      style={pageStyle}
      aria-label={`Pratinjau halaman ${pageIndex + 1}`}
    >
      <header className="print-page-title">
        <strong>{title || DEFAULT_TITLE}</strong>
        <span>{subtitle}</span>
      </header>
      <div className="photo-layout">
        {Array.from({ length: slotCount }).map((_, slotIndex) => {
          const photo = photos[slotIndex];
          return (
            <div
              className={`photo-slot slot-${slotIndex + 1} ${
                photo?.id === selectedPhotoId ? "selected" : ""
              }`}
              key={photo?.id ?? `empty-${slotIndex}`}
            >
              {photo ? (
                <button
                  onClick={() => onSelect(photo.id)}
                  onPointerDown={(event) => {
                    onSelect(photo.id);
                    const bounds = event.currentTarget.getBoundingClientRect();
                    dragState.current = {
                      id: photo.id,
                      pointerId: event.pointerId,
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                      startPositionX: photo.positionX || 0,
                      startPositionY: photo.positionY || 0,
                      width: bounds.width,
                      height: bounds.height,
                      scale: photo.scale || 1,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    const drag = dragState.current;
                    if (!drag || drag.id !== photo.id || drag.pointerId !== event.pointerId) return;
                    const deltaX =
                      ((event.clientX - drag.startClientX) / Math.max(drag.width, 1)) * 100;
                    const deltaY =
                      ((event.clientY - drag.startClientY) / Math.max(drag.height, 1)) * 100;
                    onTransform(
                      photo.id,
                      drag.startPositionX - deltaX / drag.scale,
                      drag.startPositionY - deltaY / drag.scale,
                      drag.scale,
                    );
                  }}
                  onPointerUp={(event) => {
                    if (dragState.current?.pointerId === event.pointerId) {
                      dragState.current = null;
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                  }}
                  onPointerCancel={() => {
                    dragState.current = null;
                  }}
                  aria-label={`Atur dan geser foto ${photo.name}`}
                >
                  <img
                    src={photo.url}
                    data-photo-url={photo.url}
                    alt={photo.name}
                    draggable={false}
                    style={{
                      objectFit: photo.fit,
                      objectPosition: `${50 + (photo.positionX || 0)}% ${50 + (photo.positionY || 0)}%`,
                      transform: `rotate(${photo.rotation}deg) scale(${photo.scale || 1})`,
                    }}
                  />
                  {showNames && <span className="photo-name">{photo.name}</span>}
                </button>
              ) : (
                <div className="empty-slot">
                  <span>{slotIndex + 1}</span>
                  <small>Foto</small>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <footer className="page-footer">
        <span>{String(pageIndex + 1).padStart(2, "0")}</span>
        <i />
        <span>{brandName || "AlbumKu"}</span>
      </footer>
    </article>
  );
}
