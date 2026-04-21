/**
 * canvas-renderer.js — Renderer & Drag-Drop
 * Your Face Puzzle Web
 */

// ─── Constants ──────────────────────────────────────────────────────────────

const SNAP_THRESHOLD = 0.5; // Snap jika dalam 50% ukuran kepingan dari slot
const LOCK_HIGHLIGHT_DURATION = 400; // ms untuk highlight hijau saat kepingan terkunci
const HOLDING_AREA_RATIO = 0.35; // 35% canvas untuk holding area

// ─── State ──────────────────────────────────────────────────────────────────

/** @type {HTMLCanvasElement|null} */
let _canvas = null;

/** @type {CanvasRenderingContext2D|null} */
let _ctx = null;

/** @type {import('./puzzle.js').PuzzlePiece[]} */
let _pieces = [];

/** @type {number} Ukuran grid (3, 4, atau 5) */
let _gridSize = 3;

/** @type {number|null} requestAnimationFrame ID */
let _animationId = null;

/** @type {{pieceId: number, offsetX: number, offsetY: number}|null} */
let _dragState = null;

/** @type {number|null} Index slot yang di-highlight saat drag */
let _highlightedSlot = null;

/** @type {ImageData|null} Foto asli untuk pratinjau */
let _previewImageData = null;

/** @type {boolean} Apakah pratinjau sedang ditampilkan */
let _showingPreview = false;

/** @type {Set<number>} Set pieceId yang sedang dalam animasi lock highlight */
let _lockHighlights = new Set();

/** @type {Function|null} Callback saat kepingan berhasil ditempatkan */
let _onPieceLocked = null;

/** @type {Function|null} Callback saat semua kepingan terkunci */
let _onAllLocked = null;

// Layout areas (dihitung saat init/resize)
let _layout = {
  gridX: 0,
  gridY: 0,
  gridW: 0,
  gridH: 0,
  holdX: 0,
  holdY: 0,
  holdW: 0,
  holdH: 0,
  pieceW: 0,
  pieceH: 0,
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Inisialisasi canvas renderer.
 * @param {HTMLCanvasElement} canvasEl
 * @param {import('./puzzle.js').PuzzlePiece[]} pieces
 * @param {number} gridSize
 * @param {Object} [callbacks]
 * @param {Function} [callbacks.onPieceLocked] - Dipanggil dengan (pieceId) saat kepingan terkunci
 * @param {Function} [callbacks.onAllLocked] - Dipanggil saat semua kepingan terkunci
 */
export function init(canvasEl, pieces, gridSize, callbacks = {}) {
  _canvas = canvasEl;
  _ctx = canvasEl.getContext("2d");
  _pieces = pieces;
  _gridSize = gridSize;
  _dragState = null;
  _highlightedSlot = null;
  _showingPreview = false;
  _lockHighlights = new Set();
  _onPieceLocked = callbacks.onPieceLocked || null;
  _onAllLocked = callbacks.onAllLocked || null;

  // Hitung layout
  recalculateLayout();

  // Posisikan kepingan di holding area
  layoutHoldingArea();

  // Pasang event listeners
  attachEventListeners();

  // Mulai render loop
  startRenderLoop();
}

/**
 * Mulai render loop menggunakan requestAnimationFrame.
 */
export function startRenderLoop() {
  if (_animationId !== null) return;
  const loop = () => {
    render();
    _animationId = requestAnimationFrame(loop);
  };
  _animationId = requestAnimationFrame(loop);
}

/**
 * Hentikan render loop.
 */
export function stopRenderLoop() {
  if (_animationId !== null) {
    cancelAnimationFrame(_animationId);
    _animationId = null;
  }
}

/**
 * Tampilkan foto asli semi-transparan di atas canvas.
 * @param {ImageData} imageData
 */
export function showPreview(imageData) {
  _previewImageData = imageData;
  _showingPreview = true;
}

/**
 * Sembunyikan pratinjau.
 */
export function hidePreview() {
  _showingPreview = false;
}

/**
 * Sesuaikan ukuran canvas berdasarkan viewport.
 * @param {number} size - Ukuran baru (canvas selalu persegi)
 */
export function resize(size) {
  if (!_canvas) return;
  const clampedSize = Math.max(280, Math.min(600, size));
  _canvas.width = clampedSize;
  _canvas.height = clampedSize;
  recalculateLayout();
  layoutHoldingArea();
}

/**
 * Bersihkan semua state dan hentikan render loop.
 */
export function destroy() {
  stopRenderLoop();
  detachEventListeners();
  _canvas = null;
  _ctx = null;
  _pieces = [];
  _dragState = null;
}

// ─── Render ──────────────────────────────────────────────────────────────────

/**
 * Render satu frame.
 */
function render() {
  if (!_ctx || !_canvas) return;

  const { width, height } = _canvas;
  _ctx.clearRect(0, 0, width, height);

  // Background
  _ctx.fillStyle = "#1A1A2E";
  _ctx.fillRect(0, 0, width, height);

  // Gambar area grid (target)
  drawGridArea();

  // Gambar area holding
  drawHoldingArea();

  // Gambar kepingan yang tidak sedang di-drag (terkunci dan tidak terkunci)
  _pieces.forEach((piece) => {
    if (!piece.isDragging) {
      drawPiece(piece);
    }
  });

  // Gambar kepingan yang sedang di-drag di layer terdepan
  if (_dragState !== null) {
    const dragged = _pieces.find((p) => p.id === _dragState.pieceId);
    if (dragged) drawPiece(dragged, true);
  }

  // Pratinjau foto asli
  if (_showingPreview && _previewImageData) {
    drawPreview();
  }
}

/**
 * Gambar area grid (target slots).
 */
function drawGridArea() {
  const { gridX, gridY, gridW, gridH, pieceW, pieceH } = _layout;

  // Background area grid
  _ctx.fillStyle = "rgba(108, 99, 255, 0.05)";
  _ctx.fillRect(gridX, gridY, gridW, gridH);

  // Border area grid
  _ctx.strokeStyle = "rgba(108, 99, 255, 0.3)";
  _ctx.lineWidth = 1;
  _ctx.strokeRect(gridX, gridY, gridW, gridH);

  // Gambar slot grid
  for (let row = 0; row < _gridSize; row++) {
    for (let col = 0; col < _gridSize; col++) {
      const slotIdx = row * _gridSize + col;
      const x = gridX + col * pieceW;
      const y = gridY + row * pieceH;

      // Highlight slot terdekat saat drag
      if (_highlightedSlot === slotIdx) {
        _ctx.fillStyle = "rgba(108, 99, 255, 0.25)";
        _ctx.fillRect(x, y, pieceW, pieceH);
      }

      // Border slot
      _ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      _ctx.lineWidth = 1;
      _ctx.strokeRect(x, y, pieceW, pieceH);

      // Nomor slot (debug, bisa dihapus)
      // _ctx.fillStyle = 'rgba(255,255,255,0.2)';
      // _ctx.font = '10px sans-serif';
      // _ctx.fillText(slotIdx, x + 4, y + 14);
    }
  }
}

/**
 * Gambar area holding (tempat kepingan yang belum ditempatkan).
 */
function drawHoldingArea() {
  const { holdX, holdY, holdW, holdH } = _layout;

  _ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  _ctx.fillRect(holdX, holdY, holdW, holdH);

  _ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  _ctx.lineWidth = 1;
  _ctx.strokeRect(holdX, holdY, holdW, holdH);
}

/**
 * Gambar satu kepingan puzzle.
 * @param {import('./puzzle.js').PuzzlePiece} piece
 * @param {boolean} [isDragging=false]
 */
function drawPiece(piece, isDragging = false) {
  if (!piece.imageData) return;

  const { currentX, currentY, width, height } = piece;

  // Buat offscreen canvas untuk ImageData
  const offscreen = createOffscreenCanvas(width, height);
  const offCtx = offscreen.getContext("2d");
  offCtx.putImageData(piece.imageData, 0, 0);

  _ctx.save();

  if (isDragging) {
    // Shadow saat di-drag
    _ctx.shadowColor = "rgba(108, 99, 255, 0.6)";
    _ctx.shadowBlur = 12;
    _ctx.shadowOffsetY = 4;
    _ctx.globalAlpha = 0.95;
  }

  _ctx.drawImage(offscreen, currentX, currentY, width, height);

  // Highlight hijau saat baru terkunci
  if (_lockHighlights.has(piece.id)) {
    _ctx.fillStyle = "rgba(44, 182, 125, 0.4)";
    _ctx.fillRect(currentX, currentY, width, height);
  }

  // Border kepingan terkunci
  if (piece.isLocked) {
    _ctx.strokeStyle = "rgba(44, 182, 125, 0.6)";
    _ctx.lineWidth = 2;
    _ctx.strokeRect(currentX, currentY, width, height);
  } else if (!isDragging) {
    _ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    _ctx.lineWidth = 1;
    _ctx.strokeRect(currentX, currentY, width, height);
  }

  _ctx.restore();
}

/**
 * Gambar pratinjau foto asli semi-transparan.
 */
function drawPreview() {
  const { gridX, gridY, gridW, gridH } = _layout;

  const offscreen = createOffscreenCanvas(
    _previewImageData.width,
    _previewImageData.height,
  );
  const offCtx = offscreen.getContext("2d");
  offCtx.putImageData(_previewImageData, 0, 0);

  _ctx.save();
  _ctx.globalAlpha = 0.6;
  _ctx.drawImage(offscreen, gridX, gridY, gridW, gridH);
  _ctx.restore();
}

// ─── Layout ──────────────────────────────────────────────────────────────────

/**
 * Hitung ulang layout berdasarkan ukuran canvas saat ini.
 */
function recalculateLayout() {
  if (!_canvas) return;

  const size = _canvas.width;
  const padding = Math.floor(size * 0.02);

  // Area grid: bagian kanan/atas (65% lebar)
  const gridW = Math.floor((size - padding * 3) * (1 - HOLDING_AREA_RATIO));
  const gridH = gridW; // Persegi
  const gridX = padding;
  const gridY = Math.floor((size - gridH) / 2);

  // Ukuran kepingan
  const pieceW = Math.floor(gridW / _gridSize);
  const pieceH = Math.floor(gridH / _gridSize);

  // Area holding: bagian kiri (35% lebar)
  const holdW = Math.floor((size - padding * 3) * HOLDING_AREA_RATIO);
  const holdH = size - padding * 2;
  const holdX = gridX + gridW + padding;
  const holdY = padding;

  _layout = {
    gridX,
    gridY,
    gridW,
    gridH,
    holdX,
    holdY,
    holdW,
    holdH,
    pieceW,
    pieceH,
  };
}

/**
 * Posisikan kepingan yang belum terkunci di holding area.
 */
function layoutHoldingArea() {
  const { holdX, holdY, holdW, holdH, pieceW, pieceH } = _layout;

  const unlockedPieces = _pieces.filter((p) => !p.isLocked);
  if (unlockedPieces.length === 0) return;

  // Hitung grid untuk holding area
  const cols = Math.max(1, Math.floor(holdW / (pieceW + 4)));
  const padding = 4;

  unlockedPieces.forEach((piece, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    piece.currentX = holdX + col * (pieceW + padding);
    piece.currentY = holdY + row * (pieceH + padding);
    piece.lastX = piece.currentX;
    piece.lastY = piece.currentY;
    piece.width = pieceW;
    piece.height = pieceH;
  });
}

// ─── Drag & Drop ─────────────────────────────────────────────────────────────

/**
 * Dapatkan koordinat canvas dari event mouse atau touch.
 * @param {MouseEvent|TouchEvent} e
 * @returns {{x: number, y: number}}
 */
function getCanvasCoords(e) {
  const rect = _canvas.getBoundingClientRect();
  const scaleX = _canvas.width / rect.width;
  const scaleY = _canvas.height / rect.height;

  let clientX, clientY;

  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  };
}

/**
 * Cari kepingan yang berada di koordinat (x, y).
 * @param {number} x
 * @param {number} y
 * @returns {import('./puzzle.js').PuzzlePiece|null}
 */
function findPieceAt(x, y) {
  // Cari dari atas (kepingan terakhir di array = di atas)
  for (let i = _pieces.length - 1; i >= 0; i--) {
    const p = _pieces[i];
    if (p.isLocked) continue;
    if (
      x >= p.currentX &&
      x <= p.currentX + p.width &&
      y >= p.currentY &&
      y <= p.currentY + p.height
    ) {
      return p;
    }
  }
  return null;
}

/**
 * Cari slot grid terdekat dari koordinat (x, y).
 * @param {number} x
 * @param {number} y
 * @returns {number|null} Index slot, atau null jika tidak ada yang cukup dekat
 */
function getClosestSlot(x, y) {
  const { gridX, gridY, pieceW, pieceH } = _layout;

  let closestSlot = null;
  let closestDist = Infinity;

  for (let row = 0; row < _gridSize; row++) {
    for (let col = 0; col < _gridSize; col++) {
      const slotIdx = row * _gridSize + col;
      const slotCenterX = gridX + col * pieceW + pieceW / 2;
      const slotCenterY = gridY + row * pieceH + pieceH / 2;

      const dist = Math.hypot(x - slotCenterX, y - slotCenterY);
      if (dist < closestDist) {
        closestDist = dist;
        closestSlot = slotIdx;
      }
    }
  }

  // Hanya snap jika cukup dekat
  const threshold = Math.min(pieceW, pieceH) * SNAP_THRESHOLD;
  return closestDist <= threshold ? closestSlot : null;
}

/**
 * Coba tempatkan kepingan ke slot.
 * @param {import('./puzzle.js').PuzzlePiece} piece
 * @param {number} slotIdx
 */
function tryPlacePiece(piece, slotIdx) {
  const { gridX, gridY, pieceW, pieceH } = _layout;

  if (slotIdx === piece.correctSlot) {
    // Penempatan benar — kunci kepingan
    const row = Math.floor(slotIdx / _gridSize);
    const col = slotIdx % _gridSize;
    piece.currentX = gridX + col * pieceW;
    piece.currentY = gridY + row * pieceH;
    piece.isLocked = true;

    // Animasi highlight hijau
    _lockHighlights.add(piece.id);
    setTimeout(() => _lockHighlights.delete(piece.id), LOCK_HIGHLIGHT_DURATION);

    if (typeof _onPieceLocked === "function") {
      _onPieceLocked(piece.id);
    }

    // Cek apakah semua terkunci
    const allLocked = _pieces.every((p) => p.isLocked);
    if (allLocked && typeof _onAllLocked === "function") {
      _onAllLocked();
    }
  } else {
    // Penempatan salah — kembalikan ke posisi sebelumnya
    piece.currentX = piece.lastX;
    piece.currentY = piece.lastY;
  }
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

function onPointerDown(e) {
  e.preventDefault();
  if (!_canvas) return;

  const { x, y } = getCanvasCoords(e);
  const piece = findPieceAt(x, y);

  if (!piece) return;

  // Simpan posisi sebelum drag
  piece.lastX = piece.currentX;
  piece.lastY = piece.currentY;
  piece.isDragging = true;

  _dragState = {
    pieceId: piece.id,
    offsetX: x - piece.currentX,
    offsetY: y - piece.currentY,
  };

  // Pindahkan kepingan ke akhir array agar render di atas
  const idx = _pieces.indexOf(piece);
  if (idx !== -1) {
    _pieces.splice(idx, 1);
    _pieces.push(piece);
  }
}

function onPointerMove(e) {
  e.preventDefault();
  if (!_dragState || !_canvas) return;

  const { x, y } = getCanvasCoords(e);
  const piece = _pieces.find((p) => p.id === _dragState.pieceId);
  if (!piece) return;

  piece.currentX = x - _dragState.offsetX;
  piece.currentY = y - _dragState.offsetY;

  // Update highlight slot terdekat
  const pieceCenterX = piece.currentX + piece.width / 2;
  const pieceCenterY = piece.currentY + piece.height / 2;
  _highlightedSlot = getClosestSlot(pieceCenterX, pieceCenterY);
}

function onPointerUp(e) {
  e.preventDefault();
  if (!_dragState || !_canvas) return;

  const piece = _pieces.find((p) => p.id === _dragState.pieceId);
  if (piece) {
    piece.isDragging = false;

    const pieceCenterX = piece.currentX + piece.width / 2;
    const pieceCenterY = piece.currentY + piece.height / 2;
    const closestSlot = getClosestSlot(pieceCenterX, pieceCenterY);

    if (closestSlot !== null) {
      tryPlacePiece(piece, closestSlot);
    } else {
      // Kembalikan ke posisi sebelumnya
      piece.currentX = piece.lastX;
      piece.currentY = piece.lastY;
    }
  }

  _dragState = null;
  _highlightedSlot = null;
}

function attachEventListeners() {
  if (!_canvas) return;

  // Mouse events
  _canvas.addEventListener("mousedown", onPointerDown);
  _canvas.addEventListener("mousemove", onPointerMove);
  _canvas.addEventListener("mouseup", onPointerUp);
  _canvas.addEventListener("mouseleave", onPointerUp);

  // Touch events
  _canvas.addEventListener("touchstart", onPointerDown, { passive: false });
  _canvas.addEventListener("touchmove", onPointerMove, { passive: false });
  _canvas.addEventListener("touchend", onPointerUp, { passive: false });
  _canvas.addEventListener("touchcancel", onPointerUp, { passive: false });
}

function detachEventListeners() {
  if (!_canvas) return;

  _canvas.removeEventListener("mousedown", onPointerDown);
  _canvas.removeEventListener("mousemove", onPointerMove);
  _canvas.removeEventListener("mouseup", onPointerUp);
  _canvas.removeEventListener("mouseleave", onPointerUp);

  _canvas.removeEventListener("touchstart", onPointerDown);
  _canvas.removeEventListener("touchmove", onPointerMove);
  _canvas.removeEventListener("touchend", onPointerUp);
  _canvas.removeEventListener("touchcancel", onPointerUp);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createOffscreenCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export const CanvasRenderer = {
  init,
  startRenderLoop,
  stopRenderLoop,
  showPreview,
  hidePreview,
  resize,
  destroy,
};
