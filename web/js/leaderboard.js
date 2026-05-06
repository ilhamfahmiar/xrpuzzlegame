/**
 * leaderboard.js — LocalStorage Manager
 * Your Face Puzzle Web
 */

const STORAGE_KEY = "yfp_leaderboard";
const MAX_ENTRIES_PER_DIFFICULTY = 10;

/**
 * @typedef {Object} LeaderboardEntry
 * @property {string} id - UUID entri
 * @property {string} nama - Nama pemain (maks 20 karakter)
 * @property {number} skor - Skor akhir
 * @property {string} tingkat_kesulitan - 'easy' | 'medium' | 'hard'
 * @property {number} durasi_detik - Durasi penyelesaian dalam detik
 * @property {number} timestamp - Unix timestamp saat skor disimpan
 */

/**
 * Cek apakah localStorage tersedia dan dapat digunakan.
 * @returns {boolean}
 */
export function isStorageAvailable() {
  try {
    const testKey = "__yfp_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Baca semua data leaderboard dari localStorage.
 * @returns {Object} Map difficulty → LeaderboardEntry[]
 */
function readAllData() {
  if (!isStorageAvailable()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    console.warn("[LeaderboardModule] Data localStorage korup, mereset.");
    return {};
  }
}

/**
 * Tulis semua data leaderboard ke localStorage.
 * @param {Object} data
 */
function writeAllData(data) {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn(
      "[LeaderboardModule] Gagal menyimpan ke localStorage:",
      e.message,
    );
  }
}

/**
 * Ambil entri leaderboard untuk difficulty tertentu, diurutkan descending berdasarkan skor.
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @returns {LeaderboardEntry[]}
 */
export function getEntries(difficulty) {
  const data = readAllData();
  const entries = data[difficulty];
  if (!Array.isArray(entries)) return [];
  return [...entries].sort((a, b) => b.skor - a.skor);
}

/**
 * Simpan entri baru ke leaderboard.
 * Jika kapasitas penuh (10 entri), ganti entri dengan skor terendah jika skor baru lebih tinggi.
 * @param {LeaderboardEntry} entry
 * @returns {boolean} true jika berhasil disimpan
 */
export function saveEntry(entry) {
  if (!isStorageAvailable()) return false;

  const data = readAllData();
  const difficulty = entry.tingkat_kesulitan;

  if (!data[difficulty]) {
    data[difficulty] = [];
  }

  const entries = data[difficulty];

  if (entries.length < MAX_ENTRIES_PER_DIFFICULTY) {
    // Masih ada ruang
    entries.push(entry);
  } else {
    // Cari entri dengan skor terendah
    const minIdx = entries.reduce(
      (minI, e, i, arr) => (e.skor < arr[minI].skor ? i : minI),
      0,
    );

    if (entry.skor > entries[minIdx].skor) {
      entries[minIdx] = entry;
    } else {
      return false; // Skor tidak cukup tinggi
    }
  }

  // Urutkan descending
  entries.sort((a, b) => b.skor - a.skor);
  data[difficulty] = entries;
  writeAllData(data);
  return true;
}

/**
 * Cek apakah skor masuk top 10 untuk difficulty tertentu.
 * @param {number} score
 * @param {string} difficulty
 * @returns {boolean}
 */
export function isTopScore(score, difficulty) {
  const entries = getEntries(difficulty);
  if (entries.length < MAX_ENTRIES_PER_DIFFICULTY) return true;
  const lowestScore = entries[entries.length - 1]?.skor ?? 0;
  return score > lowestScore;
}

/**
 * Hapus semua data leaderboard dari localStorage.
 */
export function clearAll() {
  if (!isStorageAvailable()) return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Generate UUID sederhana untuk ID entri.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const LeaderboardModule = {
  isStorageAvailable,
  getEntries,
  saveEntry,
  isTopScore,
  clearAll,
  generateId,
  STORAGE_KEY,
  MAX_ENTRIES_PER_DIFFICULTY,
};
