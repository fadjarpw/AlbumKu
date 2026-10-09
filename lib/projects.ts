export type StoredPhoto = {
  id: string; name: string; blob: Blob; rotation: number; fit: "cover" | "contain";
  originalSize: number; optimizedSize: number; positionX: number; positionY: number;
  scale: number; timestamp: number; dateSource: "exif" | "filename" | "file";
};
export type Project<S = Record<string, unknown>> = {
  id: string; name: string; updatedAt: number; photos: StoredPhoto[]; settings: S;
};
export type ProjectSummary = Pick<Project, "id" | "name" | "updatedAt"> & { photoCount: number };
export const ACTIVE_PROJECT_KEY = "albumku-proyek-aktif";
export function newProjectId() {
  return globalThis.crypto?.randomUUID?.() ?? `proyek-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("albumku-projects", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("projects", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Tutup tab AlbumKu lain lalu coba lagi."));
  });
}

async function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = database.transaction("projects", mode);
      const request = run(tx.objectStore("projects"));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? new Error("Penyimpanan proyek dibatalkan."));
      tx.onerror = () => reject(tx.error);
    });
  } finally { database.close(); }
}
export function saveProject<S>(project: Project<S>) {
  return transaction("readwrite", (store) => store.put(project));
}
export function loadProject<S>(id: string) {
  return transaction<Project<S> | undefined>("readonly", (store) => store.get(id));
}
export async function listProjects(): Promise<ProjectSummary[]> {
  const projects = await transaction<Project[]>("readonly", (store) => store.getAll());
  return projects.map(({ id, name, updatedAt, photos }) => ({ id, name, updatedAt, photoCount: photos.length }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
export async function exportProject<S>(project: Project<S>) {
  const photos = await Promise.all(project.photos.map(async ({ blob, ...metadata }) => ({
    ...metadata, data: await blobToDataUrl(blob),
  })));
  return new Blob([JSON.stringify({ format: "albumku", version: 1, ...project, photos })], { type: "application/json" });
}

export async function importProject<S>(file: File): Promise<Project<S>> {
  if (file.size > 500 * 1024 * 1024) throw new Error("Cadangan terlalu besar (maksimal 500 MB).");
  const value = JSON.parse(await file.text());
  if (value.format !== "albumku" || value.version !== 1 || !Array.isArray(value.photos) ||
    value.photos.length > 5000 || !value.settings || typeof value.settings !== "object" || Array.isArray(value.settings)) {
    throw new Error("Berkas bukan cadangan proyek AlbumKu yang valid.");
  }
  const ids = new Set<string>();
  let total = 0;
  const photos: StoredPhoto[] = value.photos.map((photo: Record<string, unknown>) => {
    if (typeof photo.id !== "string" || ids.has(photo.id) || typeof photo.name !== "string" ||
      typeof photo.data !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo.data) ||
      !["cover", "contain"].includes(String(photo.fit)) ||
      ![photo.rotation, photo.positionX, photo.positionY, photo.scale, photo.timestamp].every((n) => typeof n === "number" && Number.isFinite(n)) ||
      Number(photo.scale) < 0.5 || Number(photo.scale) > 3 || Math.abs(Number(photo.positionX)) > 50 || Math.abs(Number(photo.positionY)) > 50) {
      throw new Error("Data foto pada cadangan tidak valid.");
    }
    ids.add(photo.id);
    const [header, data] = photo.data.split(",");
    const binary = atob(data);
    total += binary.length;
    if (binary.length > 40 * 1024 * 1024 || total > 400 * 1024 * 1024) throw new Error("Data foto terlalu besar.");
    const blob = new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], { type: header.slice(5, -7) });
    return {
      id: photo.id, name: photo.name.slice(0, 250), blob, fit: photo.fit as StoredPhoto["fit"],
      rotation: Number(photo.rotation), positionX: Number(photo.positionX), positionY: Number(photo.positionY),
      scale: Number(photo.scale), timestamp: Number(photo.timestamp),
      dateSource: ["exif", "filename", "file"].includes(String(photo.dateSource)) ? photo.dateSource as StoredPhoto["dateSource"] : "file",
      originalSize: Number.isFinite(photo.originalSize) ? Math.max(0, Number(photo.originalSize)) : blob.size,
      optimizedSize: blob.size,
    };
  });
  return { id: newProjectId(), name: String(value.name || "Proyek impor").slice(0, 80), updatedAt: Date.now(), photos, settings: value.settings };
}
