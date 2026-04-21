/**
 * camera.js — WebRTC Manager
 * Your Face Puzzle Web
 */

/** @type {MediaStream|null} Stream kamera yang sedang aktif */
let _stream = null;

/**
 * Cek apakah browser mendukung getUserMedia API.
 * @returns {boolean}
 */
export function isSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

/**
 * Inisialisasi kamera dan tampilkan live feed pada elemen video.
 * @param {HTMLVideoElement} videoEl - Elemen <video> untuk menampilkan feed
 * @returns {Promise<MediaStream>}
 * @throws {Error} Dengan kode error yang sesuai
 */
export async function init(videoEl) {
  if (!isSupported()) {
    const err = new Error(
      "Browser tidak mendukung akses kamera (getUserMedia tidak tersedia).",
    );
    err.code = "CAMERA_NOT_SUPPORTED";
    throw err;
  }

  // Hentikan stream sebelumnya jika ada
  stopStream();

  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    videoEl.srcObject = _stream;
    await videoEl.play();

    return _stream;
  } catch (err) {
    let code = "CAMERA_UNKNOWN";
    let message = "Gagal mengakses kamera.";

    if (
      err.name === "NotAllowedError" ||
      err.name === "PermissionDeniedError"
    ) {
      code = "CAMERA_PERMISSION_DENIED";
      message =
        "Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser kamu, lalu coba lagi.";
    } else if (
      err.name === "NotFoundError" ||
      err.name === "DevicesNotFoundError"
    ) {
      code = "CAMERA_NOT_FOUND";
      message =
        "Kamera tidak terdeteksi. Pastikan perangkat kamu memiliki kamera yang terhubung.";
    } else if (
      err.name === "NotReadableError" ||
      err.name === "TrackStartError"
    ) {
      code = "CAMERA_IN_USE";
      message =
        "Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain dan coba lagi.";
    } else if (err.name === "OverconstrainedError") {
      // Coba lagi tanpa constraint facingMode
      try {
        _stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        videoEl.srcObject = _stream;
        await videoEl.play();
        return _stream;
      } catch (fallbackErr) {
        code = "CAMERA_OVERCONSTRAINED";
        message =
          "Kamera depan tidak tersedia. Menggunakan kamera yang tersedia.";
      }
    }

    const error = new Error(message);
    error.code = code;
    error.originalError = err;
    throw error;
  }
}

/**
 * Tangkap frame video saat ini ke canvas tersembunyi dan kembalikan ImageData.
 * @param {HTMLVideoElement} videoEl - Elemen video yang sedang memutar feed kamera
 * @returns {ImageData} Data piksel frame yang ditangkap
 * @throws {Error} Jika video tidak aktif atau canvas gagal
 */
export function captureFrame(videoEl) {
  if (!videoEl || videoEl.readyState < 2) {
    throw new Error("Video belum siap untuk ditangkap.");
  }

  const width = videoEl.videoWidth || videoEl.clientWidth;
  const height = videoEl.videoHeight || videoEl.clientHeight;

  if (width === 0 || height === 0) {
    throw new Error("Dimensi video tidak valid.");
  }

  // Buat canvas tersembunyi untuk capture
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  // Mirror horizontal untuk selfie (kamera depan biasanya sudah di-mirror di CSS,
  // tapi kita perlu mirror di canvas agar gambar tidak terbalik)
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, width, height);

  return ctx.getImageData(0, 0, width, height);
}

/**
 * Tangkap frame dan kembalikan sebagai HTMLCanvasElement (untuk preview).
 * @param {HTMLVideoElement} videoEl
 * @returns {HTMLCanvasElement}
 */
export function captureToCanvas(videoEl) {
  if (!videoEl || videoEl.readyState < 2) {
    throw new Error("Video belum siap untuk ditangkap.");
  }

  const width = videoEl.videoWidth || videoEl.clientWidth;
  const height = videoEl.videoHeight || videoEl.clientHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, 0, 0, width, height);

  return canvas;
}

/**
 * Hentikan semua track media stream dan bebaskan sumber daya kamera.
 */
export function stopStream() {
  if (_stream) {
    _stream.getTracks().forEach((track) => track.stop());
    _stream = null;
  }
}

/**
 * Cek apakah stream kamera sedang aktif.
 * @returns {boolean}
 */
export function isActive() {
  return _stream !== null && _stream.active;
}

export const CameraModule = {
  isSupported,
  init,
  captureFrame,
  captureToCanvas,
  stopStream,
  isActive,
};
