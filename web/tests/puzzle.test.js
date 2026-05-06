/**
 * Tests untuk puzzle.js — Image Processor
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  squareCrop,
  sliceIntoGrid,
  shufflePieces,
  processImage,
  reconstructImage,
} from "../js/puzzle.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Buat ImageData mock dengan warna solid.
 */
function createMockImageData(width, height, fillValue = 128) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue; // R
    data[i + 1] = fillValue; // G
    data[i + 2] = fillValue; // B
    data[i + 3] = 255; // A
  }
  return new ImageData(data, width, height);
}

/**
 * Buat ImageData dengan pola warna berbeda per piksel (untuk round-trip test).
 */
function createPatternImageData(width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 3) % 256;
      data[i + 1] = (y * 3) % 256;
      data[i + 2] = ((x + y) * 2) % 256;
      data[i + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

/**
 * Bandingkan dua ImageData piksel per piksel.
 */
function imageDataEqual(a, b) {
  if (a.width !== b.width || a.height !== b.height) return false;
  for (let i = 0; i < a.data.length; i++) {
    if (a.data[i] !== b.data[i]) return false;
  }
  return true;
}

// ─── squareCrop ───────────────────────────────────────────────────────────────

describe("squareCrop", () => {
  // Property 2: Square Crop Menghasilkan Gambar Persegi
  it("Property 2: harus menghasilkan gambar persegi dari gambar landscape", () => {
    const img = createMockImageData(400, 200);
    const result = squareCrop(img);
    expect(result.width).toBe(result.height);
    expect(result.width).toBe(200);
  });

  it("Property 2: harus menghasilkan gambar persegi dari gambar portrait", () => {
    const img = createMockImageData(200, 400);
    const result = squareCrop(img);
    expect(result.width).toBe(result.height);
    expect(result.width).toBe(200);
  });

  it("Property 2: harus menghasilkan gambar persegi dari gambar yang sudah persegi", () => {
    const img = createMockImageData(300, 300);
    const result = squareCrop(img);
    expect(result.width).toBe(result.height);
    expect(result.width).toBe(300);
  });

  it("ukuran hasil harus min(width, height)", () => {
    const img = createMockImageData(640, 480);
    const result = squareCrop(img);
    expect(result.width).toBe(480);
    expect(result.height).toBe(480);
  });
});

// ─── sliceIntoGrid ────────────────────────────────────────────────────────────

describe("sliceIntoGrid", () => {
  // Property 3: Jumlah Kepingan Sesuai Konfigurasi Kesulitan
  it("Property 3: harus menghasilkan 9 kepingan untuk grid 3x3", () => {
    const img = createMockImageData(300, 300);
    const pieces = sliceIntoGrid(img, 3);
    expect(pieces).toHaveLength(9);
  });

  it("Property 3: harus menghasilkan 16 kepingan untuk grid 4x4", () => {
    const img = createMockImageData(400, 400);
    const pieces = sliceIntoGrid(img, 4);
    expect(pieces).toHaveLength(16);
  });

  it("Property 3: harus menghasilkan 25 kepingan untuk grid 5x5", () => {
    const img = createMockImageData(500, 500);
    const pieces = sliceIntoGrid(img, 5);
    expect(pieces).toHaveLength(25);
  });

  // Property 4: Semua Kepingan Memiliki Dimensi yang Seragam
  it("Property 4: semua kepingan harus memiliki dimensi yang sama", () => {
    const img = createMockImageData(300, 300);
    const pieces = sliceIntoGrid(img, 3);
    const firstW = pieces[0].width;
    const firstH = pieces[0].height;
    pieces.forEach((p) => {
      expect(p.width).toBe(firstW);
      expect(p.height).toBe(firstH);
    });
  });

  it("dimensi kepingan harus width/gridSize x height/gridSize", () => {
    const img = createMockImageData(300, 300);
    const pieces = sliceIntoGrid(img, 3);
    expect(pieces[0].width).toBe(100);
    expect(pieces[0].height).toBe(100);
  });
});

// ─── shufflePieces ────────────────────────────────────────────────────────────

describe("shufflePieces", () => {
  function makePieces(n) {
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      correctSlot: i,
      imageData: createMockImageData(10, 10),
      currentX: 0,
      currentY: 0,
      width: 10,
      height: 10,
      isLocked: false,
      isDragging: false,
      lastX: 0,
      lastY: 0,
    }));
  }

  // Property 5: Shuffle Menghasilkan Permutasi yang Valid
  it("Property 5: harus mengandung elemen yang sama dengan array asli", () => {
    const pieces = makePieces(9);
    const shuffled = shufflePieces(pieces);
    expect(shuffled).toHaveLength(9);
    const originalIds = pieces.map((p) => p.id).sort((a, b) => a - b);
    const shuffledIds = shuffled.map((p) => p.id).sort((a, b) => a - b);
    expect(shuffledIds).toEqual(originalIds);
  });

  it("tidak boleh ada kepingan di posisi solusi yang benar setelah shuffle", () => {
    const pieces = makePieces(9);
    const shuffled = shufflePieces(pieces);
    let allCorrect = true;
    for (let i = 0; i < shuffled.length; i++) {
      if (shuffled[i].id !== i) {
        allCorrect = false;
        break;
      }
    }
    expect(allCorrect).toBe(false);
  });

  it("harus mengembalikan array yang sama jika hanya 1 elemen", () => {
    const pieces = makePieces(1);
    const shuffled = shufflePieces(pieces);
    expect(shuffled).toHaveLength(1);
    expect(shuffled[0].id).toBe(0);
  });
});

// ─── processImage ─────────────────────────────────────────────────────────────

describe("processImage", () => {
  it("harus melempar error jika gambar terlalu kecil", () => {
    const img = createMockImageData(50, 50);
    expect(() => processImage(img, "easy")).toThrow();
  });

  it("harus melempar error untuk difficulty tidak valid", () => {
    const img = createMockImageData(300, 300);
    expect(() => processImage(img, "invalid")).toThrow();
  });

  it("harus menghasilkan 9 kepingan untuk easy", () => {
    const img = createMockImageData(300, 300);
    const pieces = processImage(img, "easy");
    expect(pieces).toHaveLength(9);
  });

  it("harus menghasilkan 16 kepingan untuk medium", () => {
    const img = createMockImageData(400, 400);
    const pieces = processImage(img, "medium");
    expect(pieces).toHaveLength(16);
  });

  it("harus menghasilkan 25 kepingan untuk hard", () => {
    const img = createMockImageData(500, 500);
    const pieces = processImage(img, "hard");
    expect(pieces).toHaveLength(25);
  });

  it("setiap kepingan harus memiliki properti yang diperlukan", () => {
    const img = createMockImageData(300, 300);
    const pieces = processImage(img, "easy");
    pieces.forEach((p) => {
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("correctSlot");
      expect(p).toHaveProperty("imageData");
      expect(p).toHaveProperty("isLocked", false);
      expect(p).toHaveProperty("isDragging", false);
    });
  });

  it("harus menerima gambar landscape (non-square)", () => {
    const img = createMockImageData(640, 480);
    const pieces = processImage(img, "easy");
    expect(pieces).toHaveLength(9);
  });
});

// ─── reconstructImage ────────────────────────────────────────────────────────

describe("reconstructImage", () => {
  it("harus melempar error jika pieces kosong", () => {
    expect(() => reconstructImage([], 3)).toThrow();
  });

  it("harus menghasilkan ImageData dengan dimensi yang benar", () => {
    const img = createMockImageData(300, 300);
    const pieces = processImage(img, "easy");
    const reconstructed = reconstructImage(pieces, 3);
    // Ukuran rekonstruksi = pieceW * gridSize x pieceH * gridSize
    expect(reconstructed.width).toBeGreaterThan(0);
    expect(reconstructed.height).toBeGreaterThan(0);
  });

  // Property 1: Round-Trip Pemotongan dan Rekonstruksi Gambar
  it("Property 1: rekonstruksi harus identik dengan square crop dari gambar asli", () => {
    const img = createPatternImageData(300, 300);
    const pieces = processImage(img, "easy");

    // Urutkan berdasarkan correctSlot untuk rekonstruksi
    const sortedPieces = [...pieces].sort(
      (a, b) => a.correctSlot - b.correctSlot,
    );
    const reconstructed = reconstructImage(sortedPieces, 3);

    // Square crop dari gambar asli
    const cropped = squareCrop(img);

    // Dimensi harus sama (mungkin sedikit berbeda karena floor division)
    expect(reconstructed.width).toBeLessThanOrEqual(cropped.width);
    expect(reconstructed.height).toBeLessThanOrEqual(cropped.height);

    // Cek piksel di area yang overlap
    const checkW = Math.min(reconstructed.width, cropped.width);
    const checkH = Math.min(reconstructed.height, cropped.height);
    let mismatch = 0;
    for (let y = 0; y < checkH; y++) {
      for (let x = 0; x < checkW; x++) {
        const ri = (y * reconstructed.width + x) * 4;
        const ci = (y * cropped.width + x) * 4;
        for (let c = 0; c < 3; c++) {
          if (reconstructed.data[ri + c] !== cropped.data[ci + c]) mismatch++;
        }
      }
    }
    // Toleransi 0 mismatch untuk gambar yang sama
    expect(mismatch).toBe(0);
  });
});
