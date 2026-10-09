export const PRINT_SIZES = [
  { id: "3r", name: "3R", width: 88.9, height: 127 },
  { id: "4r", name: "4R", width: 101.6, height: 152.4 },
  { id: "5r", name: "5R", width: 127, height: 177.8 },
  { id: "6r", name: "6R", width: 152.4, height: 203.2 },
  { id: "8r", name: "8R", width: 203.2, height: 254 },
  { id: "10r", name: "10R", width: 254, height: 304.8 },
  { id: "12r", name: "12R", width: 304.8, height: 381 },
];

export type PrintSlot = { x: number; y: number; width: number; height: number; rotated: boolean };
export type PrintSettings = {
  sizeId: string; customWidth: number; customHeight: number; copies: number;
  gap: number; marks: "none" | "border" | "cuts"; landscape: boolean;
};
export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  sizeId: "4r", customWidth: 100, customHeight: 150, copies: 1,
  gap: 3, marks: "cuts", landscape: false,
};

export function packPrintSheet(width: number, height: number, gap: number, landscape = false) {
  if (![width, height, gap].every(Number.isFinite) || width <= 0 || height <= 0 || gap < 0) {
    throw new Error("Ukuran foto dan jarak tidak valid.");
  }
  const sheet = landscape ? { width: 483, height: 329 } : { width: 329, height: 483 };
  const safe = landscape ? { width: 470, height: 310 } : { width: 310, height: 470 };
  const insetX = (sheet.width - safe.width) / 2;
  const insetY = (sheet.height - safe.height) / 2;
  // Kombinasikan baris biasa dan baris yang diputar untuk kapasitas lebih baik.
  let best: PrintSlot[] = [];
  for (let normalRows = 0; normalRows <= Math.floor((safe.height + gap) / (height + gap)); normalRows++) {
    const usedHeight = normalRows ? normalRows * (height + gap) : 0;
    const rotatedRows = Math.max(0, Math.floor((safe.height - usedHeight + gap) / (width + gap)));
    const slots: PrintSlot[] = [];
    let y = insetY;
    for (let row = 0; row < normalRows + rotatedRows; row++) {
      const rotated = row >= normalRows;
      const w = rotated ? height : width;
      const h = rotated ? width : height;
      const columns = Math.floor((safe.width + gap) / (w + gap));
      for (let col = 0; col < columns; col++) {
        slots.push({ x: insetX + col * (w + gap), y, width: w, height: h, rotated });
      }
      y += h + gap;
    }
    if (slots.length > best.length) best = slots;
  }
  return { sheet, safe, insetX, insetY, slots: best, capacity: best.length };
}

export function buildPrintPages<T>(photos: readonly T[], copies: number, capacity: number) {
  if (!Number.isInteger(copies) || copies < 1 || copies > 50) throw new Error("Jumlah salinan harus 1–50.");
  if (capacity < 1) return [];
  if (!Number.isInteger(capacity)) throw new Error("Kapasitas lembar harus berupa bilangan bulat.");
  const expanded = photos.flatMap((photo) => Array.from({ length: copies }, () => photo));
  const pages: T[][] = [];
  for (let cursor = 0; cursor < expanded.length; cursor += capacity) pages.push(expanded.slice(cursor, cursor + capacity));
  return pages;
}
