export type PhotoDate = { timestamp: number; source: "exif" | "filename" | "file" };
export type SortMode = "oldest" | "newest" | "name" | "manual";

function dateParts(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(timestamp);
  return year >= 1900 && year <= 2200 && date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 && date.getUTCDate() === day && hour < 24 && minute < 60 && second < 60
    ? timestamp : null;
}

export function dateFromFilename(name: string): number | null {
  const match = name.match(/(?:^|\D)((?:19|20|21)\d{2})[-_]?([01]\d)[-_]?([0-3]\d)(?:[T_ -]?(\d{2})[:_-]?(\d{2})[:_-]?(\d{2}))?/);
  if (!match) return null;
  return dateParts(Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0));
}

// Baca hanya APP1/TIFF JPEG. Semua offset dibatasi agar file rusak tidak menggagalkan impor.
export function readExifDate(buffer: ArrayBuffer): number | null {
  try {
    const view = new DataView(buffer);
    if (view.getUint16(0) !== 0xffd8) return null;
    let cursor = 2;
    while (cursor + 4 <= view.byteLength) {
      const marker = view.getUint16(cursor);
      if (marker === 0xffda || marker === 0xffd9) break;
      const length = view.getUint16(cursor + 2);
      if (length < 2 || cursor + 2 + length > view.byteLength) break;
      if (marker === 0xffe1 && view.getUint32(cursor + 4) === 0x45786966) {
        const base = cursor + 10;
        const end = cursor + 2 + length;
        const endian = view.getUint16(base);
        if (endian !== 0x4949 && endian !== 0x4d4d) return null;
        const little = endian === 0x4949;
        if (view.getUint16(base + 2, little) !== 42) return null;
        const scan = (offset: number, depth: number): number | null => {
          if (depth > 1 || offset < base || offset + 2 > end) return null;
          const count = Math.min(view.getUint16(offset, little), 512);
          let fallback: number | null = null;
          for (let i = 0; i < count; i++) {
            const entry = offset + 2 + i * 12;
            if (entry + 12 > end) break;
            const tag = view.getUint16(entry, little);
            if (tag === 0x8769) {
              const nested = scan(base + view.getUint32(entry + 8, little), depth + 1);
              if (nested !== null) return nested;
            }
            if (![0x9003, 0x9004, 0x0132].includes(tag) || view.getUint16(entry + 2, little) !== 2) continue;
            const size = view.getUint32(entry + 4, little);
            const value = size <= 4 ? entry + 8 : base + view.getUint32(entry + 8, little);
            if (size < 19 || size > 64 || value < base || value + size > end) continue;
            const str = String.fromCharCode(...new Uint8Array(buffer, value, 19));
            const match = str.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
            if (!match) continue;
            const date = dateParts(...match.slice(1).map(Number) as [number, number, number, number, number, number]);
            if (tag === 0x9003 && date !== null) return date;
            fallback = date ?? fallback;
          }
          return fallback;
        };
        return scan(base + view.getUint32(base + 4, little), 0);
      }
      cursor += 2 + length;
    }
  } catch { /* Metadata rusak: gunakan nama/tanggal file. */ }
  return null;
}

export function resolvePhotoDate(name: string, lastModified: number, exifDate: number | null): PhotoDate {
  if (exifDate !== null && Number.isFinite(exifDate)) return { timestamp: exifDate, source: "exif" };
  const filenameDate = dateFromFilename(name);
  if (filenameDate !== null) return { timestamp: filenameDate, source: "filename" };
  return { timestamp: Number.isFinite(lastModified) && lastModified > 0 ? lastModified : 0, source: "file" };
}

export function sortPhotos<T extends { name: string; timestamp: number }>(photos: readonly T[], mode: SortMode): T[] {
  if (mode === "manual") return [...photos];
  return photos.map((photo, index) => ({ photo, index })).sort((a, b) => {
    const byName = a.photo.name.localeCompare(b.photo.name, "id", { numeric: true, sensitivity: "base" });
    const byDate = mode === "name" ? 0 : (a.photo.timestamp - b.photo.timestamp) * (mode === "newest" ? -1 : 1);
    return byDate || byName || a.index - b.index;
  }).map(({ photo }) => photo);
}
