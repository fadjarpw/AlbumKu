import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPageTemplateOverrides,
  buildAlbumPages,
  calculateCoverPlacement,
  calculateResizedDimensions,
  calculatePageCount,
  createBindingMargins,
  createPdfFilename,
  formatFileSize,
  moveItem,
  normalizePhotoTransform,
  paginateItems,
  TEMPLATES,
  validateImageFile,
} from "../lib/album.ts";

test("menghitung jumlah halaman sesuai kapasitas template", () => {
  assert.equal(calculatePageCount(0, 4), 0);
  assert.equal(calculatePageCount(4, 4), 1);
  assert.equal(calculatePageCount(5, 4), 2);
  assert.equal(calculatePageCount(17, 6), 3);
});

test("menolak kapasitas template yang tidak masuk akal", () => {
  assert.throws(() => calculatePageCount(5, 0), /lebih dari 0/);
  assert.throws(() => paginateItems(["a"], -2), /lebih dari 0/);
});

test("membagi foto tanpa mengubah urutan", () => {
  const photos = ["a", "b", "c", "d", "e"];
  assert.deepEqual(paginateItems(photos, 2), [["a", "b"], ["c", "d"], ["e"]]);
  assert.deepEqual(photos, ["a", "b", "c", "d", "e"]);
});

test("memindahkan foto dan tetap menjaga data asal", () => {
  const original = ["a", "b", "c", "d"];
  assert.deepEqual(moveItem(original, 1, 3), ["a", "c", "d", "b"]);
  assert.deepEqual(moveItem(original, 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(original, 10, 0), original);
  assert.deepEqual(original, ["a", "b", "c", "d"]);
});

test("menerima hanya format gambar yang didukung dan ukuran aman", () => {
  assert.deepEqual(
    validateImageFile({ name: "foto.jpg", type: "image/jpeg", size: 2_000_000 }),
    { valid: true },
  );
  assert.equal(
    validateImageFile({ name: "foto.gif", type: "image/gif", size: 20_000 }).valid,
    false,
  );
  assert.equal(
    validateImageFile({ name: "besar.png", type: "image/png", size: 50_000_000 }, 1_000_000)
      .valid,
    false,
  );
  assert.equal(
    validateImageFile({ name: "kosong.webp", type: "image/webp", size: 0 }).valid,
    false,
  );
});

test("menampilkan ukuran file yang mudah dibaca", () => {
  assert.equal(formatFileSize(500), "500 B");
  assert.equal(formatFileSize(2048), "2 KB");
  assert.equal(formatFileSize(1.5 * 1024 * 1024), "1.5 MB");
  assert.equal(formatFileSize(40 * 1024 * 1024), "40 MB");
});

test("variasi otomatis memakai beberapa template tanpa kehilangan foto", () => {
  const photos = Array.from({ length: 15 }, (_, index) => `foto-${index + 1}`);
  const pages = buildAlbumPages(photos, "grid-4", true);

  assert.deepEqual(
    pages.map((page) => page.templateId),
    ["feature-5", "strip-4", "grid-6"],
  );
  assert.deepEqual(
    pages.flatMap((page) => page.items),
    photos,
  );
});

test("mode seragam selalu mengikuti template pilihan", () => {
  const pages = buildAlbumPages([1, 2, 3, 4, 5], "duo", false);
  assert.deepEqual(
    pages.map((page) => [page.templateId, page.items.length]),
    [["duo", 2], ["duo", 2], ["duo", 1]],
  );
});

test("menghitung resolusi optimal tanpa mengubah proporsi", () => {
  assert.deepEqual(calculateResizedDimensions(6000, 4000, 2400), {
    width: 2400,
    height: 1600,
  });
  assert.deepEqual(calculateResizedDimensions(1200, 800, 2400), {
    width: 1200,
    height: 800,
  });
  assert.throws(() => calculateResizedDimensions(0, 800, 2400), /lebih dari 0/);
});

test("preset jilid hanya memperbesar margin pada sisi yang dipilih", () => {
  assert.deepEqual(createBindingMargins("none"), {
    top: 10,
    right: 10,
    bottom: 10,
    left: 10,
  });
  assert.deepEqual(createBindingMargins("left"), {
    top: 10,
    right: 10,
    bottom: 10,
    left: 22,
  });
  assert.deepEqual(createBindingMargins("top", 8, 25), {
    top: 25,
    right: 8,
    bottom: 8,
    left: 8,
  });
});

test("posisi dan zoom foto dibatasi agar editor tetap aman", () => {
  assert.deepEqual(normalizePhotoTransform(90, -70, 4), {
    positionX: 50,
    positionY: -50,
    scale: 2.5,
  });
  assert.deepEqual(normalizePhotoTransform(12, -8, 1.4), {
    positionX: 12,
    positionY: -8,
    scale: 1.4,
  });
});

test("nama file PDF aman dan mudah dikenali", () => {
  assert.equal(
    createPdfFilename("Liburan Bali 2026", "Studio Wina"),
    "liburan-bali-2026-studio-wina.pdf",
  );
  assert.equal(createPdfFilename("", ""), "album-foto-albumku.pdf");
});

test("halaman PDF tidak meregangkan hasil tangkapan", () => {
  assert.deepEqual(calculateCoverPlacement(1200, 1600, 210, 297), {
    x: -6.375,
    y: 0,
    width: 222.75,
    height: 297,
  });
  assert.deepEqual(calculateCoverPlacement(1600, 1200, 297, 210), {
    x: 0,
    y: -6.375,
    width: 297,
    height: 222.75,
  });
});

test("template setiap halaman dapat diganti tanpa kehilangan foto", () => {
  const pages = [
    { templateId: "grid-4", items: ["a", "b", "c", "d"] },
    { templateId: "duo", items: ["e", "f"] },
  ];
  const changed = applyPageTemplateOverrides(pages, {
    0: "focus-4",
    1: "duo-stack",
  });

  assert.deepEqual(
    changed.map((page) => page.templateId),
    ["focus-4", "duo-stack"],
  );
  assert.deepEqual(
    changed.flatMap((page) => page.items),
    ["a", "b", "c", "d", "e", "f"],
  );
});

test("template halaman yang terlalu kecil ditolak", () => {
  const pages = [{ templateId: "grid-6", items: [1, 2, 3, 4, 5, 6] }];
  assert.equal(applyPageTemplateOverrides(pages, { 0: "duo" })[0].templateId, "grid-6");
});

test("semua varian template memiliki id unik", () => {
  const ids = TEMPLATES.map((template) => template.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(TEMPLATES.length >= 13);
});
