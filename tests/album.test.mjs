import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPageTemplateOverrides,
  buildAlbumPages,
  calculateCoverPlacement,
  calculateResizedDimensions,
  calculatePageCount,
  createBindingMargins,
  createPhotoAdjustmentFilter,
  createPdfFilename,
  formatFileSize,
  moveItem,
  normalizePhotoAdjustments,
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
    ["grid-4", "feature-5", "strip-4", "duo"],
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
    scale: 3,
  });
  assert.deepEqual(normalizePhotoTransform(12, -8, 1.4), {
    positionX: 12,
    positionY: -8,
    scale: 1.4,
  });
});

test("koreksi cetak dibatasi pada rentang yang aman", () => {
  assert.deepEqual(normalizePhotoAdjustments(200, 50, Number.NaN), {
    brightness: 140,
    contrast: 80,
    saturation: 100,
  });
  assert.deepEqual(normalizePhotoAdjustments(112.4, 98.3, 104.2), {
    brightness: 112,
    contrast: 98,
    saturation: 104,
  });
});

test("filter koreksi cetak memiliki urutan yang konsisten", () => {
  assert.equal(
    createPhotoAdjustmentFilter({ brightness: 112, contrast: 98, saturation: 104 }),
    "brightness(112%) contrast(98%) saturate(104%)",
  );
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

test("template lebih kecil mengalirkan sisa foto ke halaman berikutnya", () => {
  const pages = [{ templateId: "grid-6", items: [1, 2, 3, 4, 5, 6] }];
  const result = applyPageTemplateOverrides(pages, { 0: "duo" });
  assert.equal(result[0].templateId, "duo");
  assert.deepEqual(result.map((page) => page.items), [[1, 2], [3, 4, 5, 6]]);
});

test("mengganti empat ke lima otomatis menarik foto berikutnya", () => {
  const result = buildAlbumPages([1, 2, 3, 4, 5, 6, 7, 8], "grid-4", false, { 0: "feature-5" });
  assert.deepEqual(result.map((page) => page.items), [[1, 2, 3, 4, 5], [6, 7, 8]]);
});
test("seluruh perubahan kapasitas mempertahankan urutan dan setiap foto tepat sekali", () => {
  for (let count = 1; count <= 100; count++) for (const template of TEMPLATES) for (const variety of [true, false]) {
    const photos = Array.from({ length: count }, (_, i) => i);
    const pages = buildAlbumPages(photos, "grid-8", variety, { 0: template.id, 2: "single" });
    assert.deepEqual(pages.flatMap((page) => page.items), photos);
    for (const page of pages) assert.ok(page.items.length <= TEMPLATES.find((t) => t.id === page.templateId).slots);
  }
});
test("zoom out diperbolehkan sampai 50 persen", () => {
  assert.equal(normalizePhotoTransform(0, 0, 0.1).scale, 0.5);
  assert.equal(normalizePhotoTransform(0, 0, 0.7).scale, 0.7);
});

test("semua varian template memiliki id unik", () => {
  const ids = TEMPLATES.map((template) => template.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(TEMPLATES.length >= 13);
});
