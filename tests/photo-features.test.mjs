import assert from "node:assert/strict";
import test from "node:test";
import { dateFromFilename, readExifDate, resolvePhotoDate, sortPhotos } from "../lib/photo-dates.ts";
import { buildPrintPages, packPrintSheet, PRINT_SIZES } from "../lib/photo-print.ts";
import { fitImageBox } from "../lib/image-geometry.ts";

test("tanggal pada nama file WhatsApp, kamera, dan ISO terdeteksi", () => {
  assert.equal(dateFromFilename("IMG-20240131-WA0001.jpg"), Date.UTC(2024, 0, 31));
  assert.equal(dateFromFilename("IMG_20240131_123456.jpg"), Date.UTC(2024, 0, 31, 12, 34, 56));
  assert.equal(dateFromFilename("2024-01-31 12-34-56.png"), Date.UTC(2024, 0, 31, 12, 34, 56));
  assert.equal(dateFromFilename("20240231.jpg"), null);
  assert.equal(dateFromFilename("foto.jpg"), null);
});
function exifFixture(little) {
  const buffer = new ArrayBuffer(70), v = new DataView(buffer);
  v.setUint16(0, 0xffd8); v.setUint16(2, 0xffe1); v.setUint16(4, 64);
  v.setUint32(6, 0x45786966); v.setUint16(10, 0);
  v.setUint16(12, little ? 0x4949 : 0x4d4d); v.setUint16(14, 42, little); v.setUint32(16, 8, little);
  v.setUint16(20, 1, little); v.setUint16(22, 0x9003, little); v.setUint16(24, 2, little);
  v.setUint32(26, 20, little); v.setUint32(30, 26, little);
  new Uint8Array(buffer, 38, 20).set(new TextEncoder().encode("2023:05:17 13:14:15\0"));
  return buffer;
}
test("EXIF tanggal pengambilan terbaca pada kedua urutan byte", () => {
  for (const little of [true, false]) assert.equal(readExifDate(exifFixture(little)), Date.UTC(2023, 4, 17, 13, 14, 15));
  assert.equal(readExifDate(new ArrayBuffer(0)), null);
  assert.equal(readExifDate(exifFixture(true).slice(0, 25)), null);
});
test("prioritas tanggal asli, nama, kemudian waktu file", () => {
  assert.deepEqual(resolvePhotoDate("20240101.jpg", 200, 100), { timestamp: 100, source: "exif" });
  assert.equal(resolvePhotoDate("20240101.jpg", 200, null).source, "filename");
  assert.deepEqual(resolvePhotoDate("foto.jpg", 200, null), { timestamp: 200, source: "file" });
});
test("auto sort stabil dan nama numerik tidak mengacak 1, 2, 10", () => {
  const photos = [{ name: "foto10", timestamp: 10 }, { name: "foto2", timestamp: 10 }, { name: "foto1", timestamp: 1 }];
  assert.deepEqual(sortPhotos(photos, "oldest").map((p) => p.name), ["foto1", "foto2", "foto10"]);
  assert.deepEqual(sortPhotos(photos, "newest").map((p) => p.name), ["foto2", "foto10", "foto1"]);
  assert.deepEqual(sortPhotos(photos, "manual"), photos);
  assert.notEqual(sortPhotos(photos, "manual"), photos);
  assert.equal(photos[0].name, "foto10");
});
test("kapasitas 4R memperhitungkan jarak agar tetap dalam 310 mm", () => {
  const layout = packPrintSheet(101.6, 152.4, 3);
  assert.equal(layout.capacity, 8);
  assert.equal(packPrintSheet(101.6, 152.4, 2).capacity, 9);
  assert.deepEqual(layout.safe, { width: 310, height: 470 });
  assert.deepEqual(layout.sheet, { width: 329, height: 483 });
});
test("seluruh ukuran R dan orientasi tidak keluar area aman atau saling menimpa", () => {
  for (const size of PRINT_SIZES) for (const landscape of [false, true]) for (const gap of [0, 3, 10]) {
    const l = packPrintSheet(size.width, size.height, gap, landscape);
    for (const slot of l.slots) {
      assert.ok(slot.x >= l.insetX && slot.y >= l.insetY);
      assert.ok(slot.x + slot.width <= l.insetX + l.safe.width + 1e-8);
      assert.ok(slot.y + slot.height <= l.insetY + l.safe.height + 1e-8);
      assert.equal(slot.width, slot.rotated ? size.height : size.width);
      assert.equal(slot.height, slot.rotated ? size.width : size.height);
    }
    for (let i = 0; i < l.slots.length; i++) for (let j = i + 1; j < l.slots.length; j++) {
      const a = l.slots[i], b = l.slots[j];
      assert.ok(a.x + a.width <= b.x + 1e-8 || b.x + b.width <= a.x + 1e-8 || a.y + a.height <= b.y + 1e-8 || b.y + b.height <= a.y + 1e-8);
    }
  }
});
test("salinan foto dibagi tanpa ada foto yang hilang", () => {
  assert.deepEqual(buildPrintPages(["a", "b", "c"], 2, 4), [["a", "a", "b", "b"], ["c", "c"]]);
  assert.equal(packPrintSheet(500, 500, 3).capacity, 0);
  assert.deepEqual(buildPrintPages(["a"], 1, 0), []);
  assert.throws(() => buildPrintPages(["a"], 0, 9));
  assert.throws(() => packPrintSheet(Number.NaN, 100, 3));
});
test("raster foto mengikuti object-fit dan posisi tanpa meregang", () => {
  assert.deepEqual(fitImageBox(200, 100, 100, 100, "cover", 50, 50), { x: -50, y: 0, width: 200, height: 100 });
  assert.deepEqual(fitImageBox(200, 100, 100, 100, "contain", 50, 50), { x: 0, y: 25, width: 100, height: 50 });
  assert.equal(fitImageBox(200, 100, 100, 100, "cover", 100, 50).x, -100);
});
