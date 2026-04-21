/**
 * game.js — Game State & Timer
 * Your Face Puzzle Web
 */

const SESSION_STORAGE_KEY = "yfp_session";

/**
 * Konfigurasi per tingkat kesulitan.
 * @type {Object.<string, {gridSize: number, totalPieces: number, timeLimit: number, bonusScore: number}>}
 */
export const DIFFICULTY_CONFIG = {
  easy: { gridSize: 3, totalPieces: 9, timeLimit: 300, bonusScore: 0 },
  medium: { gridSize: 4, totalPieces: 16, timeLimit: 180, bonusScore: 500 },
  hard: { gridSize: 5, totalPieces: 25, timeLimit: 120, bonusScore: 1500 },
};

/**
 * @typedef {Object} GameState
 * @property {string} sessionId
 * @property {string} difficulty
 * @property {number} gridSize
 * @property {number} totalPieces
 * @property {number} placedPieces
 * @property {number} timeLimit
 * @property {number} timeRemaining
 * @property {boolean} isPaused
 * @property {boolean} isCompleted
 * @property {number} startTimestamp
 * @property {number} endTimestamp
 * @property {number} score
 */

/** @type {GameState|null} */
let _state = null;

/** @type {number|null} setInterval ID */
let _timerInterval = null;

/** @type {Function|null} Callback dipanggil setiap tick (seconds) */
let _onTick = null;

/** @type {Function|null} Callback dipanggil saat sesi berakhir */
let _onEnd = null;

/**
 * Mulai sesi permainan baru.
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @param {Function} onTick - Dipanggil setiap detik dengan (timeRemaining)
 * @param {Function} onEnd - Dipanggil saat sesi berakhir dengan (GameState)
 */
export function startSession(difficulty, onTick, onEnd) {
  const config = DIFFICULTY_CONFIG[difficulty];
  if (!config) throw new Error(`Difficulty tidak valid: ${difficulty}`);

  // Hentikan sesi sebelumnya jika ada
  stopTimer();

  const sessionId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  _state = {
    sessionId,
    difficulty,
    gridSize: config.gridSize,
    totalPieces: config.totalPieces,
    placedPieces: 0,
    timeLimit: config.timeLimit,
    timeRemaining: config.timeLimit,
    isPaused: false,
    isCompleted: false,
    startTimestamp: Date.now(),
    endTimestamp: 0,
    score: 0,
  };

  _onTick = onTick;
  _onEnd = onEnd;

  startTimer();
  saveToSessionStorage();
}

/**
 * Jeda sesi — hentikan timer.
 */
export function pauseSession() {
  if (!_state || _state.isPaused || _state.isCompleted) return;
  _state.isPaused = true;
  stopTimer();
  saveToSessionStorage();
}

/**
 * Lanjutkan sesi yang dijeda.
 */
export function resumeSession() {
  if (!_state || !_state.isPaused || _state.isCompleted) return;
  _state.isPaused = false;
  startTimer();
  saveToSessionStorage();
}

/**
 * Dipanggil saat kepingan ditempatkan dengan benar.
 * @param {number} pieceId
 */
export function onPiecePlaced(pieceId) {
  if (!_state || _state.isCompleted) return;
  _state.placedPieces++;
  saveToSessionStorage();
  detectCompletion();
}

/**
 * Cek apakah puzzle sudah selesai.
 * Jika ya, akhiri sesi.
 */
export function detectCompletion() {
  if (!_state) return;
  if (_state.placedPieces >= _state.totalPieces) {
    endSession(true);
  }
}

/**
 * Hitung skor akhir.
 * Formula: timeRemaining * 10 + bonusScore
 * @param {number} timeRemaining - Sisa waktu dalam detik
 * @param {string} difficulty
 * @returns {number}
 */
export function calculateScore(timeRemaining, difficulty) {
  const config = DIFFICULTY_CONFIG[difficulty];
  if (!config) return 0;
  return Math.max(0, Math.round(timeRemaining * 10 + config.bonusScore));
}

/**
 * Akhiri sesi permainan.
 * @param {boolean} completed - true jika puzzle selesai, false jika waktu habis
 */
export function endSession(completed) {
  if (!_state) return;

  stopTimer();

  _state.isCompleted = completed;
  _state.endTimestamp = Date.now();
  _state.score = completed
    ? calculateScore(_state.timeRemaining, _state.difficulty)
    : 0;

  const finalState = { ..._state };

  // Bersihkan session storage
  clearSessionStorage();

  if (typeof _onEnd === "function") {
    _onEnd(finalState);
  }

  _state = null;
  _onTick = null;
  _onEnd = null;
}

/**
 * Format detik menjadi string MM:SS.
 * @param {number} seconds
 * @returns {string}
 */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/**
 * Ambil state sesi saat ini (read-only copy).
 * @returns {GameState|null}
 */
export function getState() {
  return _state ? { ..._state } : null;
}

/**
 * Simpan state sesi ke sessionStorage.
 */
export function saveToSessionStorage() {
  if (!_state) return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(_state));
  } catch (e) {
    console.warn("[GameModule] Gagal menyimpan ke sessionStorage:", e.message);
  }
}

/**
 * Pulihkan state sesi dari sessionStorage.
 * @returns {GameState|null}
 */
export function restoreFromSessionStorage() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Hapus state sesi dari sessionStorage.
 */
export function clearSessionStorage() {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Abaikan error
  }
}

// ─── Private helpers ───────────────────────────────────────────────────────

function startTimer() {
  if (_timerInterval !== null) return;

  _timerInterval = setInterval(() => {
    if (!_state || _state.isPaused || _state.isCompleted) return;

    _state.timeRemaining = Math.max(0, _state.timeRemaining - 1);

    if (typeof _onTick === "function") {
      _onTick(_state.timeRemaining);
    }

    if (_state.timeRemaining <= 0) {
      endSession(false);
    }
  }, 1000);
}

function stopTimer() {
  if (_timerInterval !== null) {
    clearInterval(_timerInterval);
    _timerInterval = null;
  }
}

export const GameModule = {
  DIFFICULTY_CONFIG,
  startSession,
  pauseSession,
  resumeSession,
  onPiecePlaced,
  detectCompletion,
  calculateScore,
  endSession,
  formatTime,
  getState,
  saveToSessionStorage,
  restoreFromSessionStorage,
  clearSessionStorage,
};
