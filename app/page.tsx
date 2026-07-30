"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  applyPageTemplateOverrides,
  buildAlbumPages,
  calculateCoverPlacement,
  calculateResizedDimensions,
  createBindingMargins,
  createPdfFilename,
  DEFAULT_MAX_FILE_SIZE,
  normalizePhotoTransform,
  OPTIMIZATION_PRESETS,
  PAPER_SIZES,
  TEMPLATES,
  formatFileSize,
  moveItem,
  validateImageFile,
} from "@/lib/album";
import type { BindingSide } from "@/lib/album";

type PhotoFit = "cover" | "contain";

type AlbumPhoto = {
  id: string;
  name: string;
  url: string;
  rotation: number;
  fit: PhotoFit;
  originalSize: number;
  optimizedSize: number;
  positionX: number;
  positionY: number;
  scale: number;
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
  const [albumTitle, setAlbumTitle] = useState(DEFAULT_TITLE);
  const [subtitle, setSubtitle] = useState("Kumpulan momen terbaik");
  const [brandName, setBrandName] = useState("AlbumKu");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const automaticPages = useMemo(
    () => buildAlbumPages(contentPhotos, selectedTemplate.id, useVariety),
    [contentPhotos, selectedTemplate.id, useVariety],
  );
  const pages = useMemo(
    () => applyPageTemplateOverrides(automaticPages, pageTemplateOverrides),
    [automaticPages, pageTemplateOverrides],
  );
  const displayPages = pages.length
    ? pages
    : [{ templateId: selectedTemplate.id, items: [] as AlbumPhoto[] }];
  const contentPageCount = pages.length || 1;
  const totalPageCount = contentPageCount + (includeCover ? 1 : 0);
  const coverPhotos = coverPhoto
    ? [coverPhoto, ...photos.filter((photo) => photo.id !== coverPhoto.id)].slice(0, 3)
    : [];
  const selectedPhoto = photos.find((photo) => photo.id === selectedPhotoId);
  const currentContentPageIndex = currentPage - (includeCover ? 1 : 0);
  const currentContentPage =
    currentContentPageIndex >= 0 ? displayPages[currentContentPageIndex] : null;
  const currentTemplate = currentContentPage
    ? TEMPLATES.find((template) => template.id === currentContentPage.templateId)
    : null;
  const currentAvailableTemplates = currentContentPage
    ? TEMPLATES.filter((template) => template.slots >= currentContentPage.items.length)
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
    orientation === "portrait" ? selectedPaper.widthMm : selectedPaper.heightMm;
  const pageHeight =
    orientation === "portrait" ? selectedPaper.heightMm : selectedPaper.widthMm;

  useEffect(() => {
    const saved = window.localStorage.getItem("albumku-pengaturan");
    if (!saved) return;
    try {
      const preferences = JSON.parse(saved);
      if (preferences.templateId) setTemplateId(preferences.templateId);
      if (typeof preferences.useVariety === "boolean") setUseVariety(preferences.useVariety);
      if (typeof preferences.includeCover === "boolean")
        setIncludeCover(preferences.includeCover);
      if (typeof preferences.excludeCoverFromContent === "boolean")
        setExcludeCoverFromContent(preferences.excludeCoverFromContent);
      if (preferences.coverTemplateId) setCoverTemplateId(preferences.coverTemplateId);
      if (preferences.coverTransform) setCoverTransform(preferences.coverTransform);
      if (preferences.optimizationPresetId)
        setOptimizationPresetId(preferences.optimizationPresetId);
      if (preferences.paperId) setPaperId(preferences.paperId);
      if (preferences.orientation) setOrientation(preferences.orientation);
      if (preferences.margins) {
        setMargins(preferences.margins);
      } else if (typeof preferences.margin === "number") {
        setMargins({
          top: preferences.margin,
          right: preferences.margin,
          bottom: preferences.margin,
          left: preferences.margin,
        });
      }
      if (preferences.bindingSide) setBindingSide(preferences.bindingSide);
      if (typeof preferences.gap === "number") setGap(preferences.gap);
      if (preferences.background) setBackground(preferences.background);
      if (typeof preferences.showNames === "boolean") setShowNames(preferences.showNames);
      if (preferences.albumTitle) setAlbumTitle(preferences.albumTitle);
      if (typeof preferences.subtitle === "string") setSubtitle(preferences.subtitle);
      if (preferences.brandName) setBrandName(preferences.brandName);
    } catch {
      window.localStorage.removeItem("albumku-pengaturan");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "albumku-pengaturan",
      JSON.stringify({
        templateId,
        useVariety,
        includeCover,
        excludeCoverFromContent,
        coverTemplateId,
        coverTransform,
        optimizationPresetId,
        paperId,
        orientation,
        margins,
        bindingSide,
        gap,
        background,
        showNames,
        albumTitle,
        subtitle,
        brandName,
      }),
    );
  }, [
    templateId,
    useVariety,
    includeCover,
    excludeCoverFromContent,
    coverTemplateId,
    coverTransform,
    optimizationPresetId,
    paperId,
    orientation,
    margins,
    bindingSide,
    gap,
    background,
    showNames,
    albumTitle,
    subtitle,
    brandName,
  ]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPageCount - 1));
  }, [totalPageCount]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  async function addFiles(files: FileList | File[]) {
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
        const optimized = await optimizeImage(
          file,
          optimizationPreset.maxDimension,
          optimizationPreset.quality,
        );
        accepted.push({
          id: makeId(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          url: URL.createObjectURL(optimized),
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
      setPhotos((current) => [...current, ...accepted]);
      setCoverPhotoId((current) => current ?? accepted[0].id);
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
    setPhotos((current) => {
      const from = current.findIndex((photo) => photo.id === id);
      const to = from + direction;
      return moveItem(current, from, to);
    });
  }

  function dropPhotoOn(targetId: string) {
    if (!draggedPhotoId || draggedPhotoId === targetId) return;
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
    if (!photos.length) {
      setToast({ tone: "warning", message: "Tambahkan foto sebelum mencetak album." });
      return;
    }
    window.print();
  }

  async function savePdf() {
    if (!photos.length || isSavingPdf) {
      if (!photos.length) {
        setToast({ tone: "warning", message: "Tambahkan foto sebelum menyimpan PDF." });
      }
      return;
    }

    setIsSavingPdf(true);
    setPdfProgress(0);
    try {
      await document.fonts.ready;
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const pageElements = Array.from(
        document.querySelectorAll<HTMLElement>(".screen-pages .album-page"),
      );
      const orientationName = pageWidth > pageHeight ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation: orientationName,
        unit: "mm",
        format: [pageWidth, pageHeight],
        compress: true,
      });
      const visiblePage =
        pageElements.find((element) => element.classList.contains("is-current")) ??
        pageElements[0];
      const previewBounds = visiblePage.getBoundingClientRect();
      const captureWidth = Math.max(1, Math.round(previewBounds.width));
      const captureHeight = Math.max(1, Math.round(previewBounds.height));
      const captureScale = Math.min(3, Math.max(2, 1800 / captureWidth));

      for (let index = 0; index < pageElements.length; index += 1) {
        const element = pageElements[index];
        element.style.setProperty("--capture-width", `${captureWidth}px`);
        element.style.setProperty("--capture-height", `${captureHeight}px`);
        element.classList.add("pdf-capture");
        await Promise.all(
          Array.from(element.querySelectorAll("img")).map(
            (image) =>
              new Promise<void>((resolve) => {
                if (image.complete) {
                  resolve();
                  return;
                }
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
              }),
          ),
        );
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );

        const canvas = await html2canvas(element, {
          scale: captureScale,
          useCORS: true,
          logging: false,
          backgroundColor: background,
          width: captureWidth,
          height: captureHeight,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
        });
        element.classList.remove("pdf-capture");
        ["--capture-width", "--capture-height"].forEach((property) =>
          element.style.removeProperty(property),
        );

        if (index > 0) pdf.addPage([pageWidth, pageHeight], orientationName);
        const placement = calculateCoverPlacement(
          canvas.width,
          canvas.height,
          pageWidth,
          pageHeight,
        );
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.9),
          "JPEG",
          placement.x,
          placement.y,
          placement.width,
          placement.height,
          undefined,
          "FAST",
        );
        setPdfProgress(Math.round(((index + 1) / pageElements.length) * 100));
      }

      pdf.save(createPdfFilename(albumTitle, brandName));
      setToast({
        tone: "success",
        message: `PDF berhasil dibuat dan diunduh (${pageElements.length} halaman).`,
      });
    } catch {
      document.querySelectorAll(".pdf-capture").forEach((element) => {
        element.classList.remove("pdf-capture");
      });
      setToast({
        tone: "warning",
        message: "PDF belum berhasil dibuat. Gunakan tombol Cetak sebagai alternatif.",
      });
    } finally {
      setIsSavingPdf(false);
      setPdfProgress(0);
    }
  }

  const pageStyle = {
    "--page-ratio": `${pageWidth} / ${pageHeight}`,
    "--page-margin-top": `${(margins.top / pageHeight) * 100}%`,
    "--page-margin-right": `${(margins.right / pageWidth) * 100}%`,
    "--page-margin-bottom": `${(margins.bottom / pageHeight) * 100}%`,
    "--page-margin-left": `${(margins.left / pageWidth) * 100}%`,
    "--print-margin-top": `${margins.top}mm`,
    "--print-margin-right": `${margins.right}mm`,
    "--print-margin-bottom": `${margins.bottom}mm`,
    "--print-margin-left": `${margins.left}mm`,
    "--photo-gap": `${Math.max(gap * 0.38, 1)}px`,
    "--paper-background": background,
  } as React.CSSProperties;

  return (
    <main className="app-shell">
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
          <button className="button ghost print-button" onClick={printAlbum}>
            <span aria-hidden="true">⌘</span>
            Cetak
          </button>
          <button
            className="button primary"
            onClick={() => void savePdf()}
            disabled={isSavingPdf}
          >
            <span aria-hidden="true">{isSavingPdf ? "…" : "↓"}</span>
            {isSavingPdf ? `Membuat PDF ${pdfProgress}%` : "Simpan PDF"}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="control-panel" aria-label="Pengaturan album">
          <nav className="steps" aria-label="Tahapan membuat album">
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
          </nav>

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

          <section className="panel-section">
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
                  onClick={() => setTemplateId(template.id)}
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
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">04 · TAMPILAN</span>
                <h2>Pengaturan cetak</h2>
              </div>
            </div>

            <div className="form-grid">
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

            <label className="switch-row">
              <span>
                <strong>Tampilkan nama foto</strong>
                <small>Nama file muncul di bawah foto</small>
              </span>
              <input
                type="checkbox"
                checked={showNames}
                onChange={(event) => setShowNames(event.target.checked)}
              />
            </label>
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
                <strong>{selectedPaper.name}</strong> {orientation === "portrait" ? "berdiri" : "mendatar"}
              </span>
            </div>
          </div>

          <div
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

            <div className="screen-pages">
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
              ))}
            </div>

            <div className="page-navigation">
              <button
                onClick={() => setCurrentPage((page) => Math.max(0, page - 1))}
                disabled={currentPage === 0}
                aria-label="Halaman sebelumnya"
              >
                ←
              </button>
              <span>
                {includeCover && currentPage === 0 ? (
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
                  setCurrentPage((page) => Math.min(totalPageCount - 1, page + 1))
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
              {includeCover && currentPage === 0 && coverPhoto ? (
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
                      min="100"
                      max="250"
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
                  <button
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
                  </button>
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
                    <span>Zoom</span>
                    <input
                      type="range"
                      min="100"
                      max="250"
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
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      style={{
                        objectFit: photo.fit,
                        objectPosition: `${50 + (photo.positionX || 0)}% ${50 + (photo.positionY || 0)}%`,
                        transform: `rotate(${photo.rotation}deg) scale(${photo.scale || 1})`,
                      }}
                    />
                    <span>{index + 1}</span>
                    {coverPhoto?.id === photo.id && includeCover && (
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
                  <img src={photo.url} alt={photo.name} style={{ objectFit: "cover" }} />
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
