import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import test from "node:test";
import { exportProject, importProject, listProjects, loadProject, saveProject } from "../lib/projects.ts";

const photo = { id: "foto-a", name: "20240101", blob: new Blob(["piksel-uji"], { type: "image/jpeg" }),
  rotation: 90, fit: "cover", originalSize: 10, optimizedSize: 10, positionX: 12, positionY: -8, scale: 0.8, timestamp: 100, dateSource: "exif" };

test("proyek menyimpan piksel Blob, urutan, posisi, dan seluruh pengaturan", async () => {
  const project = { id: "simpan-uji", name: "Liburan", updatedAt: 100, photos: [photo],
    settings: { coverPhotoId: photo.id, pageTemplateOverrides: { 0: "feature-5" }, sortMode: "oldest", printSettings: { sizeId: "4r" } } };
  await saveProject(project);
  const restored = await loadProject(project.id);
  assert.equal(await restored.photos[0].blob.text(), "piksel-uji");
  assert.deepEqual(restored.settings, project.settings);
  assert.equal(restored.photos[0].positionX, 12);
  assert.equal(restored.photos[0].scale, 0.8);
  assert.ok((await listProjects()).some((p) => p.id === project.id && p.photoCount === 1));
});
test("mengedit proyek yang sama tidak membuat duplikat atau merusak proyek lain", async () => {
  const make = (id, name, updatedAt) => ({ id, name, updatedAt, photos: [photo], settings: {} });
  await saveProject(make("proyek-a", "Awal", 1));
  await saveProject(make("proyek-b", "Lain", 2));
  await saveProject(make("proyek-a", "Edit", 3));
  assert.equal((await loadProject("proyek-a")).name, "Edit");
  assert.equal((await loadProject("proyek-b")).name, "Lain");
  assert.equal((await listProjects()).filter((p) => p.id === "proyek-a").length, 1);
  assert.equal(await loadProject("tidak-ada"), undefined);
});
test("cadangan portable memulihkan foto dan mendapat id baru agar tidak menimpa", async () => {
  // FileReader adalah API browser; adaptasi minimal untuk menguji serialisasi di Node.
  globalThis.FileReader = class {
    readAsDataURL(blob) {
      void blob.arrayBuffer().then((buffer) => { this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`; this.onload(); });
    }
  };
  const project = { id: "asal", name: "Cadangan", updatedAt: 1, photos: [photo], settings: { title: "Judul", includeCover: true } };
  const blob = await exportProject(project);
  const restored = await importProject(new File([blob], "cadangan.albumku"));
  assert.notEqual(restored.id, "asal");
  assert.equal(await restored.photos[0].blob.text(), await photo.blob.text());
  assert.equal(restored.photos[0].blob.type, "image/jpeg");
  assert.deepEqual(restored.settings, project.settings);
});
test("berkas salah, data foto rusak, dan id duplikat ditolak sebelum membuka proyek", async () => {
  await assert.rejects(importProject(new File(["{}"], "salah.albumku")), /bukan cadangan/);
  const value = { format: "albumku", version: 1, name: "Rusak", settings: {}, photos: [{ ...photo, data: "data:image/jpeg;base64,cGlrc2Vs", blob: undefined }] };
  value.photos[0].scale = 99;
  await assert.rejects(importProject(new File([JSON.stringify(value)], "rusak.albumku")), /tidak valid/);
  value.photos[0].scale = 1; value.photos.push(value.photos[0]);
  await assert.rejects(importProject(new File([JSON.stringify(value)], "duplikat.albumku")), /tidak valid/);
});
