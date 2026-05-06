/**
 * app.js — Router SPA & Orchestrator
 * Your Face Puzzle Web
 *
 * Entry point utama. Menginisialisasi semua modul dan mengelola alur permainan.
 */

import { UIModule } from "./ui.js";
import { CameraModule } from "./camera.js";
import { PuzzleModule } from "./puzzle.js";
import { CanvasRenderer } from "./canvas-renderer.js";
import {
  GameModule,
  DIFFICULTY_CONFIG,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  onPiecePlaced,
  formatTime,
  getState,
  restoreFromSessionStorage,
  clearSessionStorage,
} from "./game.js";
import {
  LeaderboardModule,
  getEntries,
  saveEntry,
  isTopScore,
  generateId,
} from "./leaderboard.js";

// ─── State Aplikasi ───────────────────────────────────────────────────────────

/** @type {string} Difficulty yang dipilih pemain */
let _selectedDifficulty =
  localStorage.getItem("yfp_last_difficulty") || "medium";

/** @type {ImageData|null} Data gambar selfie yang diambil */
let _capturedImageData = null;

/** @type {HTMLCanvasElement|null} Canvas capture dari kamera */
let _captureCanvas = null;

/** @type {import('./puzzle.js').PuzzlePiece[]|null} Kepingan puzzle saat ini */
let _currentPieces = null;

/** @type {string|null} ID entri skor yang baru disimpan (untuk highlight leaderboard) */
let _lastSavedEntryId = null;

/** @type {boolean} Apakah tombol pratinjau sedang ditekan */
let _previewActive = false;

// ─── Router ───────────────────────────────────────────────────────────────────

function handleHashChange() {
  const hash = window.location.hash || "#home";
  const routes = {
    "#home": showHome,
    "#camera": showCamera,
    "#difficulty": showDifficulty,
    "#game": showGame,
    "#result": showResult,
    "#leaderboard": showLeaderboard,
    "#how-to-play": showHowToPlay,
  };
  const handler = routes[hash];
  if (handler) {
    handler();
  } else {
    navigate("#home");
  }
}

function navigate(hash) {
  window.location.hash = hash;
}

// ─── Screen Handlers ──────────────────────────────────────────────────────────

function showHome() {
  // Hentikan kamera jika masih aktif
  CameraModule.stopStream();
  CanvasRenderer.destroy();
  UIModule.showScreen("home");
}

function showCamera() {
  UIModule.showScreen("camera");
  UIModule.hideCameraError();
  UIModule.hideCameraPreview();

  const videoEl = document.getElementById("camera-feed");

  if (!CameraModule.isSupported()) {
    UIModule.showCameraError(
      "Browser kamu tidak mendukung akses kamera. Gunakan Chrome 80+, Firefox 75+, Safari 13+, atau Edge 80+.",
    );
    return;
  }

  UIModule.showSpinner("Mengakses kamera...");

  CameraModule.init(videoEl)
    .then(() => {
      UIModule.hideSpinner();
    })
    .catch((err) => {
      UIModule.hideSpinner();
      UIModule.showCameraError(err.message || "Gagal mengakses kamera.");
    });
}

function showDifficulty() {
  UIModule.showScreen("difficulty");

  // Tandai difficulty terakhir yang dipilih
  document.querySelectorAll(".btn--difficulty").forEach((btn) => {
    const d = btn.dataset.difficulty;
    btn.setAttribute(
      "aria-pressed",
      d === _selectedDifficulty ? "true" : "false",
    );
  });

  // Terapkan preferensi aksesibilitas
  applyAccessibilityPreferences();
}

async function showGame() {
  if (!_capturedImageData) {
    navigate("#camera");
    return;
  }

  UIModule.showScreen("game");
  UIModule.showSpinner("Memproses gambar...");

  try {
    // Proses gambar menjadi puzzle
    _currentPieces = PuzzleModule.processImage(
      _capturedImageData,
      _selectedDifficulty,
    );

    const config = DIFFICULTY_CONFIG[_selectedDifficulty];
    const canvasEl = document.getElementById("puzzle-canvas");

    // Sesuaikan ukuran canvas
    const size = getCanvasSize();
    canvasEl.width = size;
    canvasEl.height = size;

    // Inisialisasi renderer
    CanvasRenderer.init(canvasEl, _currentPieces, config.gridSize, {
      onPieceLocked: (pieceId) => {
        onPiecePlaced(pieceId);
        const state = getState();
        if (state) {
          UIModule.updateProgress(state.placedPieces, state.totalPieces);
        }
      },
      onAllLocked: () => {
        // Puzzle selesai — endSession akan dipanggil oleh detectCompletion
      },
    });

    UIModule.hideSpinner();

    // Mulai sesi game
    startSession(
      _selectedDifficulty,
      // onTick
      (timeRemaining) => {
        UIModule.updateTimer(timeRemaining, formatTime);
      },
      // onEnd
      (finalState) => {
        CanvasRenderer.stopRenderLoop();
        handleSessionEnd(finalState);
      },
    );

    // Update UI awal
    UIModule.updateProgress(0, config.totalPieces);
    UIModule.updateTimer(config.timeLimit, formatTime);
  } catch (err) {
    UIModule.hideSpinner();
    UIModule.showToast(`Gagal memproses gambar: ${err.message}`);
    navigate("#camera");
  }
}

function showResult() {
  UIModule.showScreen("result");
}

function showLeaderboard() {
  UIModule.showScreen("leaderboard");

  // Render leaderboard untuk semua difficulty
  ["easy", "medium", "hard"].forEach((diff) => {
    const entries = getEntries(diff);
    UIModule.renderLeaderboard(diff, entries, _lastSavedEntryId);
  });

  // Aktifkan tab yang sesuai dengan difficulty terakhir
  activateLeaderboardTab(_selectedDifficulty);
}

function showHowToPlay() {
  UIModule.showScreen("how-to-play");
}

// ─── Game Flow ────────────────────────────────────────────────────────────────

/**
 * Tangani akhir sesi permainan.
 * @param {import('./game.js').GameState} finalState
 */
function handleSessionEnd(finalState) {
  const difficultyLabels = { easy: "Mudah", medium: "Sedang", hard: "Sulit" };
  const duration = (finalState.endTimestamp - finalState.startTimestamp) / 1000;

  if (finalState.isCompleted) {
    UIModule.setResultContent({
      title: "🎉 Selamat!",
      message: "Kamu berhasil menyusun puzzle!",
      score: finalState.score,
      difficulty: finalState.difficulty,
      durationSeconds: duration,
    });
  } else {
    UIModule.setResultContent({
      title: "⏰ Waktu Habis!",
      message: "Coba lagi dan susun puzzle lebih cepat!",
      score: 0,
      difficulty: finalState.difficulty,
      durationSeconds: duration,
    });
  }

  // Cek apakah skor masuk top 10
  if (
    finalState.isCompleted &&
    isTopScore(finalState.score, finalState.difficulty)
  ) {
    UIModule.showPlayerNameForm();
    setupSaveScoreHandler(finalState, duration);
  } else {
    UIModule.hidePlayerNameForm();
  }

  navigate("#result");
}

/**
 * Setup handler untuk menyimpan skor ke leaderboard.
 * @param {import('./game.js').GameState} finalState
 * @param {number} duration
 */
function setupSaveScoreHandler(finalState, duration) {
  const btn = document.getElementById("btn-save-score");
  const input = document.getElementById("input-player-name");

  if (!btn || !input) return;

  const handler = () => {
    const nama = (input.value || "Pemain").trim().slice(0, 20) || "Pemain";
    const entry = {
      id: generateId(),
      nama,
      skor: finalState.score,
      tingkat_kesulitan: finalState.difficulty,
      durasi_detik: Math.round(duration),
      timestamp: Date.now(),
    };

    const saved = saveEntry(entry);
    if (saved) {
      _lastSavedEntryId = entry.id;
      UIModule.showToast("Skor berhasil disimpan!");
    } else {
      UIModule.showToast("Skor tidak cukup tinggi untuk masuk leaderboard.");
    }

    UIModule.hidePlayerNameForm();
    btn.removeEventListener("click", handler);
  };

  btn.addEventListener("click", handler);
}

// ─── Event Listeners Setup ────────────────────────────────────────────────────

function setupEventListeners() {
  // ── Home ──
  document
    .getElementById("btn-play")
    ?.addEventListener("click", () => navigate("#camera"));
  document
    .getElementById("btn-leaderboard-home")
    ?.addEventListener("click", () => navigate("#leaderboard"));
  document
    .getElementById("btn-how-to-play")
    ?.addEventListener("click", () => navigate("#how-to-play"));

  // ── Camera ──
  document
    .getElementById("btn-capture")
    ?.addEventListener("click", handleCapture);
  document
    .getElementById("btn-use-photo")
    ?.addEventListener("click", () => navigate("#difficulty"));
  document
    .getElementById("btn-retake")
    ?.addEventListener("click", handleRetake);
  document
    .getElementById("btn-retry-camera")
    ?.addEventListener("click", showCamera);
  document
    .getElementById("btn-back-from-camera")
    ?.addEventListener("click", () => {
      CameraModule.stopStream();
      navigate("#home");
    });

  // ── Difficulty ──
  document.querySelectorAll(".btn--difficulty").forEach((btn) => {
    btn.addEventListener("click", () => {
      _selectedDifficulty = btn.dataset.difficulty;
      localStorage.setItem("yfp_last_difficulty", _selectedDifficulty);
      navigate("#game");
    });
  });

  document
    .getElementById("btn-back-from-difficulty")
    ?.addEventListener("click", () => {
      navigate("#camera");
    });

  // Toggle aksesibilitas
  document
    .getElementById("toggle-animations")
    ?.addEventListener("change", (e) => {
      document.body.classList.toggle("no-animation", e.target.checked);
      localStorage.setItem("yfp_no_animation", e.target.checked ? "1" : "0");
    });

  document.getElementById("toggle-audio")?.addEventListener("change", (e) => {
    localStorage.setItem("yfp_audio", e.target.checked ? "1" : "0");
  });

  // ── Game ──
  const btnPreview = document.getElementById("btn-preview");
  if (btnPreview) {
    btnPreview.addEventListener("mousedown", handlePreviewStart);
    btnPreview.addEventListener("touchstart", handlePreviewStart, {
      passive: true,
    });
    btnPreview.addEventListener("mouseup", handlePreviewEnd);
    btnPreview.addEventListener("touchend", handlePreviewEnd, {
      passive: true,
    });
    btnPreview.addEventListener("mouseleave", handlePreviewEnd);
  }

  document.getElementById("btn-pause")?.addEventListener("click", handlePause);
  document
    .getElementById("btn-resume")
    ?.addEventListener("click", handleResume);
  document
    .getElementById("btn-exit-game")
    ?.addEventListener("click", handleExitGame);

  // ── Result ──
  document.getElementById("btn-play-again")?.addEventListener("click", () => {
    _capturedImageData = null;
    _currentPieces = null;
    navigate("#camera");
  });
  document
    .getElementById("btn-leaderboard-result")
    ?.addEventListener("click", () => navigate("#leaderboard"));
  document
    .getElementById("btn-home-result")
    ?.addEventListener("click", () => navigate("#home"));

  // ── Leaderboard ──
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activateLeaderboardTab(btn.dataset.difficulty);
    });
  });
  document
    .getElementById("btn-back-from-leaderboard")
    ?.addEventListener("click", () => navigate("#home"));

  // ── How to Play ──
  document
    .getElementById("btn-back-from-how-to-play")
    ?.addEventListener("click", () => navigate("#home"));

  // ── Resize ──
  window.addEventListener("resize", handleResize);

  // ── Global Error Handler ──
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[App] Unhandled rejection:", e.reason);
    UIModule.showToast("Terjadi kesalahan. Silakan coba lagi.");
  });

  window.addEventListener("error", (e) => {
    console.error("[App] Global error:", e.error);
  });
}

// ─── Action Handlers ──────────────────────────────────────────────────────────

function handleCapture() {
  const videoEl = document.getElementById("camera-feed");
  try {
    _captureCanvas = CameraModule.captureToCanvas(videoEl);
    _capturedImageData = _captureCanvas
      .getContext("2d")
      .getImageData(0, 0, _captureCanvas.width, _captureCanvas.height);

    UIModule.showCameraPreview(_captureCanvas);
  } catch (err) {
    UIModule.showCameraError(err.message || "Gagal mengambil foto.");
  }
}

function handleRetake() {
  _capturedImageData = null;
  _captureCanvas = null;
  UIModule.hideCameraPreview();

  const videoEl = document.getElementById("camera-feed");
  if (!CameraModule.isActive()) {
    CameraModule.init(videoEl).catch((err) => {
      UIModule.showCameraError(err.message);
    });
  }
}

function handlePreviewStart() {
  if (!_capturedImageData) return;
  _previewActive = true;
  CanvasRenderer.showPreview(_capturedImageData);
}

function handlePreviewEnd() {
  if (!_previewActive) return;
  _previewActive = false;
  CanvasRenderer.hidePreview();
}

function handlePause() {
  pauseSession();
  UIModule.setPauseOverlay(true);
  document.getElementById("btn-pause").setAttribute("hidden", "");
}

function handleResume() {
  resumeSession();
  UIModule.setPauseOverlay(false);
  document.getElementById("btn-pause").removeAttribute("hidden");
}

function handleExitGame() {
  UIModule.showDialog(
    "Keluar dari Permainan",
    "Apakah kamu yakin ingin keluar? Progres permainan akan hilang.",
    () => {
      // Konfirmasi
      endSession(false);
      CanvasRenderer.destroy();
      clearSessionStorage();
      navigate("#home");
    },
    () => {
      // Batal — lanjutkan
    },
  );
}

function handleResize() {
  const canvasEl = document.getElementById("puzzle-canvas");
  if (!canvasEl) return;
  const size = getCanvasSize();
  CanvasRenderer.resize(size);
}

// ─── Leaderboard Tabs ─────────────────────────────────────────────────────────

function activateLeaderboardTab(difficulty) {
  // Update tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const isActive = btn.dataset.difficulty === difficulty;
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    btn.classList.toggle("tab-btn--active", isActive);
  });

  // Update tab panels
  ["easy", "medium", "hard"].forEach((diff) => {
    const panel = document.getElementById(`leaderboard-table-${diff}`);
    if (panel) {
      if (diff === difficulty) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    }
  });
}

// ─── Accessibility ────────────────────────────────────────────────────────────

function applyAccessibilityPreferences() {
  const noAnimation = localStorage.getItem("yfp_no_animation") === "1";
  const audioEnabled = localStorage.getItem("yfp_audio") === "1";

  document.body.classList.toggle("no-animation", noAnimation);

  const toggleAnim = document.getElementById("toggle-animations");
  const toggleAudio = document.getElementById("toggle-audio");

  if (toggleAnim) toggleAnim.checked = noAnimation;
  if (toggleAudio) toggleAudio.checked = audioEnabled;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Hitung ukuran canvas yang sesuai dengan viewport.
 * @returns {number}
 */
function getCanvasSize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const available = Math.min(vw * 0.9, vh - 160);
  return Math.max(280, Math.min(600, available));
}

// ─── Session Recovery ─────────────────────────────────────────────────────────

/**
 * Cek apakah ada sesi yang tersimpan di sessionStorage.
 * Jika ada, tawarkan untuk melanjutkan.
 */
function checkSessionRecovery() {
  const savedState = restoreFromSessionStorage();
  if (!savedState || savedState.isCompleted) {
    clearSessionStorage();
    return;
  }

  // Ada sesi yang belum selesai — tapi kita tidak bisa memulihkan gambar
  // (ImageData tidak bisa disimpan di sessionStorage)
  // Jadi kita bersihkan saja
  clearSessionStorage();
}

// ─── Fallback Check ───────────────────────────────────────────────────────────

function checkBrowserSupport() {
  const hasCanvas = !!document.createElement("canvas").getContext;
  const hasWebRTC = !!(
    navigator.mediaDevices && navigator.mediaDevices.getUserMedia
  );

  if (!hasCanvas) {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;
                  background:#0F0E17;color:#FFFFFE;font-family:sans-serif;text-align:center;padding:2rem;">
        <div>
          <h1 style="font-size:1.5rem;margin-bottom:1rem;">Browser Tidak Didukung</h1>
          <p>Browser kamu tidak mendukung Canvas API yang diperlukan untuk game ini.</p>
          <p style="margin-top:0.5rem;color:#A7A9BE;">
            Gunakan Chrome 80+, Firefox 75+, Safari 13+, atau Edge 80+.
          </p>
        </div>
      </div>
    `;
    return false;
  }

  return true;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  if (!checkBrowserSupport()) return;

  checkSessionRecovery();
  applyAccessibilityPreferences();
  setupEventListeners();

  // Setup hash routing
  window.addEventListener("hashchange", handleHashChange);

  // Navigasi ke hash saat ini atau home
  handleHashChange();
}

// Mulai aplikasi saat DOM siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
