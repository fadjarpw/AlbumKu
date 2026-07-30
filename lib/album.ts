export const DEFAULT_MAX_FILE_SIZE = 40 * 1024 * 1024;

export type AlbumTemplate = {
  id: string;
  name: string;
  slots: number;
};

export type PaperSize = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
};

export type AlbumPage<T> = {
  templateId: string;
  items: T[];
};

export type OptimizationPreset = {
  id: string;
  name: string;
  description: string;
  maxDimension: number;
  quality: number;
};

export type BindingSide = "none" | "top" | "right" | "left";

export type PageMargins = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const TEMPLATES: AlbumTemplate[] = [
  { id: "single", name: "Satu Besar", slots: 1 },
  { id: "duo", name: "Dua Sejajar", slots: 2 },
  { id: "duo-stack", name: "Dua Bertumpuk", slots: 2 },
  { id: "trio-feature", name: "Trio Sorotan", slots: 3 },
  { id: "trio-row", name: "Trio Sejajar", slots: 3 },
  { id: "grid-4", name: "Grid Rapi", slots: 4 },
  { id: "focus-4", name: "Fokus Empat", slots: 4 },
  { id: "strip-4", name: "Strip Empat", slots: 4 },
  { id: "feature-5", name: "Sorotan", slots: 5 },
  { id: "film-5", name: "Film Strip", slots: 5 },
  { id: "grid-6", name: "Hemat", slots: 6 },
  { id: "mosaic-6", name: "Mozaik Enam", slots: 6 },
  { id: "grid-8", name: "Maksimal", slots: 8 },
];

export const PAPER_SIZES: PaperSize[] = [
  { id: "a4", name: "A4", widthMm: 210, heightMm: 297 },
  { id: "a3", name: "A3", widthMm: 297, heightMm: 420 },
  { id: "letter", name: "Letter", widthMm: 215.9, heightMm: 279.4 },
];

export const OPTIMIZATION_PRESETS: OptimizationPreset[] = [
  {
    id: "compact",
    name: "PDF kecil",
    description: "Cocok untuk kirim WhatsApp atau arsip",
    maxDimension: 1600,
    quality: 0.76,
  },
  {
    id: "balanced",
    name: "Seimbang",
    description: "Disarankan untuk cetak album biasa",
    maxDimension: 2400,
    quality: 0.84,
  },
  {
    id: "high",
    name: "Kualitas tinggi",
    description: "Untuk cetak besar; ukuran PDF lebih besar",
    maxDimension: 3600,
    quality: 0.9,
  },
];

export function calculatePageCount(itemCount: number, slotsPerPage: number) {
  if (!Number.isFinite(itemCount) || itemCount <= 0) return 0;
  if (!Number.isInteger(slotsPerPage) || slotsPerPage <= 0) {
    throw new Error("Jumlah slot per halaman harus lebih dari 0.");
  }
  return Math.ceil(itemCount / slotsPerPage);
}

export function paginateItems<T>(items: readonly T[], slotsPerPage: number): T[][] {
  if (!Number.isInteger(slotsPerPage) || slotsPerPage <= 0) {
    throw new Error("Jumlah slot per halaman harus lebih dari 0.");
  }
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += slotsPerPage) {
    pages.push(items.slice(index, index + slotsPerPage));
  }
  return pages;
}

export function buildAlbumPages<T>(
  items: readonly T[],
  templateId: string,
  useVariety: boolean,
): AlbumPage<T>[] {
  const baseTemplate = TEMPLATES.find((template) => template.id === templateId);
  if (!baseTemplate) throw new Error("Template album tidak ditemukan.");

  if (!useVariety) {
    return paginateItems(items, baseTemplate.slots).map((pageItems) => ({
      templateId: baseTemplate.id,
      items: pageItems,
    }));
  }

  const sequence = ["feature-5", "strip-4", "mosaic-6", "duo-stack", "grid-8"];
  const pages: AlbumPage<T>[] = [];
  let cursor = 0;
  let sequenceIndex = 0;

  while (cursor < items.length) {
    const remaining = items.length - cursor;
    let template =
      remaining <= 8
        ? TEMPLATES.find((candidate) => candidate.slots >= remaining)
        : TEMPLATES.find((candidate) => candidate.id === sequence[sequenceIndex]);

    template ??= baseTemplate;
    pages.push({
      templateId: template.id,
      items: items.slice(cursor, cursor + template.slots),
    });
    cursor += template.slots;
    sequenceIndex = (sequenceIndex + 1) % sequence.length;
  }

  return pages;
}

export function applyPageTemplateOverrides<T>(
  pages: readonly AlbumPage<T>[],
  overrides: Readonly<Record<number, string>>,
): AlbumPage<T>[] {
  return pages.map((page, index) => {
    const requestedId = overrides[index];
    if (!requestedId) return { ...page, items: [...page.items] };
    const requestedTemplate = TEMPLATES.find((template) => template.id === requestedId);
    if (!requestedTemplate || requestedTemplate.slots < page.items.length) {
      return { ...page, items: [...page.items] };
    }
    return {
      templateId: requestedTemplate.id,
      items: [...page.items],
    };
  });
}

export function calculateResizedDimensions(
  width: number,
  height: number,
  maxDimension: number,
) {
  if (width <= 0 || height <= 0 || maxDimension <= 0) {
    throw new Error("Ukuran gambar harus lebih dari 0.");
  }
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function createBindingMargins(
  side: BindingSide,
  regularMargin = 10,
  bindingMargin = 22,
): PageMargins {
  const margins = {
    top: regularMargin,
    right: regularMargin,
    bottom: regularMargin,
    left: regularMargin,
  };
  if (side !== "none") margins[side] = bindingMargin;
  return margins;
}

export function normalizePhotoTransform(positionX: number, positionY: number, scale: number) {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  return {
    positionX: clamp(positionX, -50, 50),
    positionY: clamp(positionY, -50, 50),
    scale: clamp(scale, 1, 2.5),
  };
}

export function createPdfFilename(title: string, brand: string) {
  const base = `${title.trim() || "album-foto"}-${brand.trim() || "albumku"}`
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "album-foto"}.pdf`;
}

export function calculateCoverPlacement(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new Error("Ukuran sumber dan halaman harus lebih dari 0.");
  }
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const round = (value: number) => Number(value.toFixed(6));
  return {
    x: round((targetWidth - width) / 2),
    y: round((targetHeight - height) / 2),
    width: round(width),
    height: round(height),
  };
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = [...items];
  if (
    from < 0 ||
    to < 0 ||
    from >= result.length ||
    to >= result.length ||
    from === to
  ) {
    return result;
  }
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

type FileMetadata = {
  name: string;
  type: string;
  size: number;
};

export function validateImageFile(
  file: FileMetadata,
  maxSize = DEFAULT_MAX_FILE_SIZE,
): { valid: true } | { valid: false; reason: string } {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    return { valid: false, reason: "format tidak didukung" };
  }
  if (file.size <= 0) {
    return { valid: false, reason: "file kosong" };
  }
  if (file.size > maxSize) {
    return { valid: false, reason: `ukuran melebihi ${formatFileSize(maxSize)}` };
  }
  return { valid: true };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${Number(megabytes.toFixed(megabytes >= 10 ? 0 : 1))} MB`;
}
