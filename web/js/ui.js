/**
 * ui.js — Screen Manager & DOM Helpers
 * Your Face Puzzle Web
 */

/** @type {number|null} ID timeout untuk auto-hide toast */
let _toastTimeout = null;

/** @type {Function|null} Cleanup function untuk dialog listeners */
let _dialogCleanup = null;

/**
 * Map nama layar ke ID elemen DOM.
 * @type {Object.<string, string>}
 */
const SCREEN_IDS = {
  home: "screen-home",
  camera: "screen-camera",
  difficulty: "screen-difficulty",
  game: "screen-game",
  result: "screen-result",
  leaderboard: "screen-leaderboard",
  "how-to-play": "screen-how-to-play",
};

/**
 * UIModule — mengelola tampilan layar dan komponen UI global.
 */
export const UIModule = {
  /**
   * Tampilkan layar yang ditentukan dan sembunyikan semua layar lain.
   * @param {string} name - Nama layar ('home', 'camera', 'difficulty', 'game', 'result', 'leaderboard', 'how-to-play')
   */
  showScreen(name) {
    const targetId = SCREEN_IDS[name];
    if (!targetId) {
      console.warn(`[UIModule] Layar tidak dikenal: "${name}"`);
      return;
    }

    // Sembunyikan semua layar
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.remove("active");
    });

    // Tampilkan layar yang dituju
    const target = document.getElementById(targetId);
    if (target) {
      target.classList.add("active");
      // Scroll ke atas saat berpindah layar
      window.scrollTo({ top: 0, behavior: "instant" });
    } else {
      console.error(`[UIModule] Elemen tidak ditemukan: #${targetId}`);
    }
  },

  /**
   * Sembunyikan semua layar (hapus class .active dari semua .screen).
   */
  hideAllScreens() {
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.remove("active");
    });
  },

  /**
   * Tampilkan overlay spinner loading.
   * @param {string} [message='Memuat...'] - Pesan yang ditampilkan di bawah spinner
   */
  showSpinner(message = "Memuat...") {
    const spinner = document.getElementById("spinner");
    const msgEl = document.getElementById("spinner-message");
    if (msgEl) msgEl.textContent = message;
    if (spinner) spinner.removeAttribute("hidden");
  },

  /**
   * Sembunyikan overlay spinner loading.
   */
  hideSpinner() {
    const spinner = document.getElementById("spinner");
    if (spinner) spinner.setAttribute("hidden", "");
  },

  /**
   * Tampilkan dialog konfirmasi modal.
   * @param {string} title - Judul dialog
   * @param {string} message - Pesan dialog
   * @param {Function} onConfirm - Callback saat pengguna menekan "Ya"
   * @param {Function} [onCancel] - Callback saat pengguna menekan "Tidak"
   */
  showDialog(title, message, onConfirm, onCancel) {
    const dialog = document.getElementById("dialog");
    const titleEl = document.getElementById("dialog-title");
    const msgEl = document.getElementById("dialog-message");
    const btnYes = document.getElementById("btn-dialog-yes");
    const btnNo = document.getElementById("btn-dialog-no");

    if (!dialog || !titleEl || !msgEl || !btnYes || !btnNo) {
      console.error("[UIModule] Elemen dialog tidak ditemukan.");
      return;
    }

    // Bersihkan listener sebelumnya
    if (_dialogCleanup) {
      _dialogCleanup();
      _dialogCleanup = null;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;
    dialog.removeAttribute("hidden");

    // Fokus ke tombol "Ya" untuk aksesibilitas keyboard
    requestAnimationFrame(() => btnYes.focus());

    const handleYes = () => {
      this.hideDialog();
      if (typeof onConfirm === "function") onConfirm();
    };

    const handleNo = () => {
      this.hideDialog();
      if (typeof onCancel === "function") onCancel();
    };

    const handleKeydown = (e) => {
      if (e.key === "Escape") handleNo();
    };

    btnYes.addEventListener("click", handleYes, { once: true });
    btnNo.addEventListener("click", handleNo, { once: true });
    document.addEventListener("keydown", handleKeydown);

    _dialogCleanup = () => {
      btnYes.removeEventListener("click", handleYes);
      btnNo.removeEventListener("click", handleNo);
      document.removeEventListener("keydown", handleKeydown);
    };
  },

  /**
   * Sembunyikan dialog konfirmasi.
   */
  hideDialog() {
    const dialog = document.getElementById("dialog");
    if (dialog) dialog.setAttribute("hidden", "");
    if (_dialogCleanup) {
      _dialogCleanup();
      _dialogCleanup = null;
    }
  },

  /**
   * Tampilkan notifikasi toast sementara.
   * @param {string} message - Pesan yang ditampilkan
   * @param {number} [duration=3000] - Durasi tampil dalam milidetik
   */
  showToast(message, duration = 3000) {
    const toast = document.getElementById("toast");
    const msgEl = document.getElementById("toast-message");

    if (!toast || !msgEl) return;

    // Batalkan auto-hide sebelumnya
    if (_toastTimeout !== null) {
      clearTimeout(_toastTimeout);
      _toastTimeout = null;
    }

    msgEl.textContent = message;
    toast.removeAttribute("hidden");

    _toastTimeout = setTimeout(() => {
      toast.setAttribute("hidden", "");
      _toastTimeout = null;
    }, duration);
  },

  /**
   * Perbarui teks indikator progres puzzle.
   * @param {number} placed - Jumlah kepingan yang sudah ditempatkan dengan benar
   * @param {number} total - Total jumlah kepingan
   */
  updateProgress(placed, total) {
    const el = document.getElementById("progress-display");
    if (el) el.textContent = `${placed} / ${total} kepingan`;
  },

  /**
   * Perbarui tampilan timer.
   * @param {number} seconds - Sisa waktu dalam detik
   * @param {Function} formatTimeFn - Fungsi format waktu dari game.js (seconds → 'MM:SS')
   */
  updateTimer(seconds, formatTimeFn) {
    const el = document.getElementById("timer-display");
    if (!el) return;

    const formatted =
      typeof formatTimeFn === "function"
        ? formatTimeFn(seconds)
        : String(seconds);

    el.textContent = formatted;

    // Tambahkan class warning jika sisa waktu < 30 detik
    if (seconds < 30) {
      el.classList.add("timer-warning");
    } else {
      el.classList.remove("timer-warning");
    }
  },

  /**
   * Tampilkan atau sembunyikan pause overlay.
   * @param {boolean} visible
   */
  setPauseOverlay(visible) {
    const overlay = document.getElementById("pause-overlay");
    if (!overlay) return;
    if (visible) {
      overlay.removeAttribute("hidden");
    } else {
      overlay.setAttribute("hidden", "");
    }
  },

  /**
   * Tampilkan pesan error kamera.
   * @param {string} message - Pesan error yang ditampilkan
   */
  showCameraError(message) {
    const errorEl = document.getElementById("camera-error");
    const msgEl = document.getElementById("camera-error-message");
    const container = document.getElementById("camera-container");

    if (msgEl) msgEl.textContent = message;
    if (errorEl) errorEl.removeAttribute("hidden");
    if (container) container.setAttribute("hidden", "");
  },

  /**
   * Sembunyikan pesan error kamera dan tampilkan kembali container kamera.
   */
  hideCameraError() {
    const errorEl = document.getElementById("camera-error");
    const container = document.getElementById("camera-container");

    if (errorEl) errorEl.setAttribute("hidden", "");
    if (container) container.removeAttribute("hidden");
  },

  /**
   * Tampilkan pratinjau foto yang diambil dan sembunyikan live feed.
   * @param {HTMLCanvasElement} captureCanvas - Canvas dengan foto yang diambil
   */
  showCameraPreview(captureCanvas) {
    const container = document.getElementById("camera-container");
    const preview = document.getElementById("camera-preview");
    const previewCanvas = document.getElementById("capture-canvas");

    if (container) container.setAttribute("hidden", "");
    if (preview) preview.removeAttribute("hidden");

    // Salin gambar dari capture canvas ke preview canvas
    if (previewCanvas && captureCanvas) {
      previewCanvas.width = captureCanvas.width;
      previewCanvas.height = captureCanvas.height;
      const ctx = previewCanvas.getContext("2d");
      ctx.drawImage(captureCanvas, 0, 0);
    }
  },

  /**
   * Sembunyikan pratinjau foto dan tampilkan kembali live feed.
   */
  hideCameraPreview() {
    const container = document.getElementById("camera-container");
    const preview = document.getElementById("camera-preview");

    if (container) container.removeAttribute("hidden");
    if (preview) preview.setAttribute("hidden", "");
  },

  /**
   * Tampilkan form input nama pemain untuk penyimpanan skor.
   */
  showPlayerNameForm() {
    const form = document.getElementById("player-name-form");
    if (form) form.removeAttribute("hidden");
  },

  /**
   * Sembunyikan form input nama pemain.
   */
  hidePlayerNameForm() {
    const form = document.getElementById("player-name-form");
    if (form) form.setAttribute("hidden", "");
  },

  /**
   * Set konten layar hasil.
   * @param {Object} opts
   * @param {string} opts.title - Judul hasil ('Selamat!' atau 'Waktu Habis!')
   * @param {string} opts.message - Pesan tambahan
   * @param {number} opts.score - Skor akhir
   * @param {string} opts.difficulty - Tingkat kesulitan ('easy'|'medium'|'hard')
   * @param {number} opts.durationSeconds - Durasi sesi dalam detik
   */
  setResultContent({ title, message, score, difficulty, durationSeconds }) {
    const titleEl = document.getElementById("result-title");
    const msgEl = document.getElementById("result-message");
    const scoreEl = document.getElementById("result-score");
    const diffEl = document.getElementById("result-difficulty");
    const timeEl = document.getElementById("result-time");

    const difficultyLabels = { easy: "Mudah", medium: "Sedang", hard: "Sulit" };
    const mins = Math.floor(durationSeconds / 60);
    const secs = Math.floor(durationSeconds % 60);
    const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (scoreEl) scoreEl.textContent = score.toLocaleString("id-ID");
    if (diffEl) diffEl.textContent = difficultyLabels[difficulty] || difficulty;
    if (timeEl) timeEl.textContent = `Durasi: ${timeStr}`;
  },

  /**
   * Render tabel leaderboard untuk difficulty tertentu.
   * @param {string} difficulty - 'easy' | 'medium' | 'hard'
   * @param {Array} entries - Array LeaderboardEntry
   * @param {string|null} currentEntryId - ID entri skor pemain saat ini (untuk highlight)
   */
  renderLeaderboard(difficulty, entries, currentEntryId = null) {
    const tbody = document.getElementById(`leaderboard-body-${difficulty}`);
    const emptyMsg = document.getElementById(`leaderboard-empty-${difficulty}`);

    if (!tbody) return;

    tbody.innerHTML = "";

    if (!entries || entries.length === 0) {
      if (emptyMsg) emptyMsg.removeAttribute("hidden");
      return;
    }

    if (emptyMsg) emptyMsg.setAttribute("hidden", "");

    const difficultyLabels = { easy: "Mudah", medium: "Sedang", hard: "Sulit" };

    entries.forEach((entry, index) => {
      const tr = document.createElement("tr");
      if (entry.id === currentEntryId) {
        tr.classList.add("current-player");
      }

      const date = new Date(entry.timestamp);
      const dateStr = date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(entry.nama)}</td>
        <td>${entry.skor.toLocaleString("id-ID")}</td>
        <td>${difficultyLabels[entry.tingkat_kesulitan] || entry.tingkat_kesulitan}</td>
        <td>${dateStr}</td>
      `;

      tbody.appendChild(tr);
    });
  },
};

/**
 * Escape HTML untuk mencegah XSS saat merender konten user.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
