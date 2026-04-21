/**
 * puzzle.js — Image Processor
 * Your Face Puzzle Web
 */

import { DIFFICULTY_CONFIG } from "./game.js";

/**
 * @typedef {Object} PuzzlePiece
 * @property {number} id - Index unik kepingan (0 hingga N-1)
 * @property {number} correctSlot - Index slot yang benar (sama dengan id)
 * @property {ImageData} imageData - Pixel data kepingan
 * @property {number} currentX - Posisi X saat ini di canvas (piksel)
 * @property {number} currentY - Posisi Y saat ini di canvas (piksel)
 * @property {number} width - Lebar kepingan (piksel)
 * @property {number} height - Tinggi kepingan (piksel)
 * @property {boolean} isLocked - true jika sudah ditempatkan dengan benar
 * @property {boolean} isDragging - true jika sedang di-drag
 * @property {number} lastX - Posisi X sebelum drag dimulai
 * @property {number} lastY - Posisi Y sebelum drag dimulai
 */

/**
 * Crop persegi dari tengah gambar.
 * Mengambil sisi terpendek sebagai ukuran crop, mengambil area tengah.
 * @param {ImageData} imageData
 * @returns {ImageData} ImageData persegi (width === height)
 */
export function squareCrop(imageData) {
  const { width, height, data } = imageData;
  const size = Math.min(width, height);
  const offsetX = Math.floor((width - size) / 2);
  const offsetY = Math.floor((height - size) / 2);

  const canvas = createOffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Buat ImageData sumber dan gambar ke canvas
  const srcCanvas = createOffscreenCanvas(width, height);
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.putImageData(imageData, 0, 0);

  ctx.drawImage(srcCanvas, offsetX, offsetY, size, size, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

/**
 * Potong ImageData menjadi grid NxN kepingan yang seragam.
 * @param {ImageData} imageData - Gambar persegi (width === height)
 * @param {number} gridSize - Ukuran grid (3, 4, atau 5)
 * @returns {ImageData[]} Array kepingan dengan dimensi yang sama
 */
export function sliceIntoGrid(imageData, gridSize) {
  const { width, height } = imageData;
  const pieceW = Math.floor(width / gridSize);
  const pieceH = Math.floor(height / gridSize);

  const srcCanvas = createOffscreenCanvas(width, height);
  const srcCtx = srcCanvas.getContext("2d");
  srcCtx.putImageData(imageData, 0, 0);

  const pieces = [];

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const canvas = createOffscreenCanvas(pieceW, pieceH);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        srcCanvas,
        col * pieceW,
        row * pieceH,
        pieceW,
        pieceH,
        0,
        0,
        pieceW,
        pieceH,
      );
      pieces.push(ctx.getImageData(0, 0, pieceW, pieceH));
    }
  }

  return pieces;
}

/**
 * Acak posisi kepingan menggunakan algoritma Fisher-Yates.
 * Memastikan tidak ada kepingan yang berada di posisi solusi yang benar.
 * @param {PuzzlePiece[]} pieces
 * @returns {PuzzlePiece[]} Array yang sama dengan posisi teracak
 */
export function shufflePieces(pieces) {
  if (pieces.length <= 1) return pieces;

  const arr = [...pieces];

  // Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // Pastikan tidak ada kepingan di posisi solusi yang benar
  // (bandingkan id dengan index posisi dalam array)
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].id === i && arr.length > 1) {
      // Swap dengan elemen berikutnya (atau sebelumnya jika di akhir)
      const swapIdx = i === arr.length - 1 ? 0 : i + 1;
      [arr[i], arr[swapIdx]] = [arr[swapIdx], arr[i]];
    }
  }

  return arr;
}

/**
 * Proses gambar selfie menjadi array PuzzlePiece yang siap dimainkan.
 * @param {ImageData} imageData - Data gambar dari kamera
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {PuzzlePiece[]}
 * @throws {Error} Jika gambar terlalu kecil atau proses gagal
 */
export function processImage(imageData, difficulty) {
  if (!imageData || imageData.width < 100 || imageData.height < 100) {
    throw new Error("Gambar terlalu kecil. Minimal 100×100 piksel.");
  }

  const config = DIFFICULTY_CONFIG[difficulty];
  if (!config) throw new Error(`Difficulty tidak valid: ${difficulty}`);

  const { gridSize } = config;

  // 1. Square crop
  const cropped = squareCrop(imageData);

  // 2. Slice menjadi grid
  const slices = sliceIntoGrid(cropped, gridSize);

  // 3. Buat PuzzlePiece objects dengan posisi awal (akan diatur oleh canvas-renderer)
  const pieces = slices.map((imgData, index) => ({
    id: index,
    correctSlot: index,
    imageData: imgData,
    currentX: 0,
    currentY: 0,
    width: imgData.width,
    height: imgData.height,
    isLocked: false,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  }));

  // 4. Shuffle
  const shuffled = shufflePieces(pieces);

  return shuffled;
}

/**
 * Rekonstruksi gambar dari semua kepingan (untuk validasi round-trip).
 * @param {PuzzlePiece[]} pieces - Array kepingan diurutkan berdasarkan correctSlot
 * @param {number} gridSize
 * @returns {ImageData}
 */
export function reconstructImage(pieces, gridSize) {
  if (!pieces || pieces.length === 0)
    throw new Error("Pieces tidak boleh kosong.");

  // Urutkan berdasarkan correctSlot
  const sorted = [...pieces].sort((a, b) => a.correctSlot - b.correctSlot);

  const pieceW = sorted[0].width;
  const pieceH = sorted[0].height;
  const totalW = pieceW * gridSize;
  const totalH = pieceH * gridSize;

  const canvas = createOffscreenCanvas(totalW, totalH);
  const ctx = canvas.getContext("2d");

  sorted.forEach((piece, index) => {
    const row = Math.floor(index / gridSize);
    const col = index % gridSize;

    const pieceCanvas = createOffscreenCanvas(pieceW, pieceH);
    const pieceCtx = pieceCanvas.getContext("2d");
    pieceCtx.putImageData(piece.imageData, 0, 0);

    ctx.drawImage(pieceCanvas, col * pieceW, row * pieceH);
  });

  return ctx.getImageData(0, 0, totalW, totalH);
}

// ─── Private helpers ───────────────────────────────────────────────────────

/**
 * Buat offscreen canvas (kompatibel dengan browser dan Node.js/jsdom untuk testing).
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
function createOffscreenCanvas(width, height) {
  // Selalu gunakan HTMLCanvasElement untuk kompatibilitas maksimal
  // OffscreenCanvas tidak didukung di semua browser (terutama Safari lama)
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export const PuzzleModule = {
  squareCrop,
  sliceIntoGrid,
  shufflePieces,
  processImage,
  reconstructImage,
};
