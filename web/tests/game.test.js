/**
 * Tests untuk game.js — Game State & Timer
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
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
} from "../js/game.js";

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Bersihkan state sebelum setiap test
  clearSessionStorage();
  // Reset timer jika ada sesi aktif
  try {
    endSession(false);
  } catch {}
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  clearSessionStorage();
  try {
    endSession(false);
  } catch {}
});

// ─── DIFFICULTY_CONFIG ────────────────────────────────────────────────────────

describe("DIFFICULTY_CONFIG", () => {
  it("harus memiliki konfigurasi untuk easy, medium, hard", () => {
    expect(DIFFICULTY_CONFIG).toHaveProperty("easy");
    expect(DIFFICULTY_CONFIG).toHaveProperty("medium");
    expect(DIFFICULTY_CONFIG).toHaveProperty("hard");
  });

  it("easy: gridSize=3, totalPieces=9, timeLimit=300, bonusScore=0", () => {
    expect(DIFFICULTY_CONFIG.easy).toEqual({
      gridSize: 3,
      totalPieces: 9,
      timeLimit: 300,
      bonusScore: 0,
    });
  });

  it("medium: gridSize=4, totalPieces=16, timeLimit=180, bonusScore=500", () => {
    expect(DIFFICULTY_CONFIG.medium).toEqual({
      gridSize: 4,
      totalPieces: 16,
      timeLimit: 180,
      bonusScore: 500,
    });
  });

  it("hard: gridSize=5, totalPieces=25, timeLimit=120, bonusScore=1500", () => {
    expect(DIFFICULTY_CONFIG.hard).toEqual({
      gridSize: 5,
      totalPieces: 25,
      timeLimit: 120,
      bonusScore: 1500,
    });
  });
});

// ─── startSession ─────────────────────────────────────────────────────────────

describe("startSession", () => {
  it("harus menginisialisasi state dengan benar untuk difficulty easy", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    const state = getState();
    expect(state).not.toBeNull();
    expect(state.difficulty).toBe("easy");
    expect(state.gridSize).toBe(3);
    expect(state.totalPieces).toBe(9);
    expect(state.timeLimit).toBe(300);
    expect(state.timeRemaining).toBe(300);
    expect(state.placedPieces).toBe(0);
    expect(state.isPaused).toBe(false);
    expect(state.isCompleted).toBe(false);
  });

  it("harus menginisialisasi state dengan benar untuk difficulty medium", () => {
    startSession(
      "medium",
      () => {},
      () => {},
    );
    const state = getState();
    expect(state.difficulty).toBe("medium");
    expect(state.timeRemaining).toBe(180);
    expect(state.totalPieces).toBe(16);
  });

  it("harus menginisialisasi state dengan benar untuk difficulty hard", () => {
    startSession(
      "hard",
      () => {},
      () => {},
    );
    const state = getState();
    expect(state.difficulty).toBe("hard");
    expect(state.timeRemaining).toBe(120);
    expect(state.totalPieces).toBe(25);
  });

  it("harus melempar error untuk difficulty tidak valid", () => {
    expect(() =>
      startSession(
        "invalid",
        () => {},
        () => {},
      ),
    ).toThrow();
  });

  it("harus menghasilkan sessionId yang unik", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    const state1 = getState();
    endSession(false);

    startSession(
      "easy",
      () => {},
      () => {},
    );
    const state2 = getState();

    expect(state1.sessionId).not.toBe(state2.sessionId);
  });

  // Property 9: Inisialisasi Timer Sesuai Konfigurasi Kesulitan
  it("Property 9: timeRemaining harus sama dengan timeLimit untuk semua difficulty", () => {
    for (const diff of ["easy", "medium", "hard"]) {
      startSession(
        diff,
        () => {},
        () => {},
      );
      const state = getState();
      expect(state.timeRemaining).toBe(DIFFICULTY_CONFIG[diff].timeLimit);
      endSession(false);
    }
  });
});

// ─── formatTime ───────────────────────────────────────────────────────────────

describe("formatTime", () => {
  it("harus memformat 0 detik menjadi '00:00'", () => {
    expect(formatTime(0)).toBe("00:00");
  });

  it("harus memformat 60 detik menjadi '01:00'", () => {
    expect(formatTime(60)).toBe("01:00");
  });

  it("harus memformat 300 detik menjadi '05:00'", () => {
    expect(formatTime(300)).toBe("05:00");
  });

  it("harus memformat 90 detik menjadi '01:30'", () => {
    expect(formatTime(90)).toBe("01:30");
  });

  it("harus memformat 65 detik menjadi '01:05'", () => {
    expect(formatTime(65)).toBe("01:05");
  });

  it("harus menangani nilai negatif (clamp ke 0)", () => {
    expect(formatTime(-5)).toBe("00:00");
  });

  // Property 10: Format Waktu MM:SS yang Valid
  it("Property 10: format harus MM:SS dan nilai numerik konsisten", () => {
    for (let s = 0; s <= 300; s += 7) {
      const result = formatTime(s);
      expect(result).toMatch(/^\d{2}:\d{2}$/);
      const [mm, ss] = result.split(":").map(Number);
      expect(mm * 60 + ss).toBe(s);
    }
  });
});

// ─── calculateScore ───────────────────────────────────────────────────────────

describe("calculateScore", () => {
  it("easy: 100 detik sisa → 100*10 + 0 = 1000", () => {
    expect(calculateScore(100, "easy")).toBe(1000);
  });

  it("medium: 50 detik sisa → 50*10 + 500 = 1000", () => {
    expect(calculateScore(50, "medium")).toBe(1000);
  });

  it("hard: 30 detik sisa → 30*10 + 1500 = 1800", () => {
    expect(calculateScore(30, "hard")).toBe(1800);
  });

  it("harus mengembalikan 0 untuk difficulty tidak valid", () => {
    expect(calculateScore(100, "invalid")).toBe(0);
  });

  it("harus mengembalikan nilai non-negatif untuk timeRemaining=0", () => {
    expect(calculateScore(0, "easy")).toBe(0);
    expect(calculateScore(0, "medium")).toBe(500);
    expect(calculateScore(0, "hard")).toBe(1500);
  });

  // Property 11: Formula Kalkulasi Skor
  it("Property 11: skor = timeRemaining*10 + bonusScore untuk semua difficulty", () => {
    for (const diff of ["easy", "medium", "hard"]) {
      for (const t of [0, 30, 60, 120, 180, 300]) {
        const expected = t * 10 + DIFFICULTY_CONFIG[diff].bonusScore;
        expect(calculateScore(t, diff)).toBe(expected);
      }
    }
  });
});

// ─── pauseSession / resumeSession ─────────────────────────────────────────────

describe("pauseSession / resumeSession", () => {
  it("pauseSession harus mengubah isPaused menjadi true", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    pauseSession();
    expect(getState().isPaused).toBe(true);
  });

  it("resumeSession harus mengubah isPaused menjadi false", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    pauseSession();
    resumeSession();
    expect(getState().isPaused).toBe(false);
  });

  it("pauseSession tidak boleh bekerja jika sudah di-pause", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    pauseSession();
    pauseSession(); // double pause
    expect(getState().isPaused).toBe(true);
  });

  it("resumeSession tidak boleh bekerja jika tidak di-pause", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    resumeSession(); // resume tanpa pause
    expect(getState().isPaused).toBe(false);
  });

  // Property 13: Pause dan Resume Membalikkan State
  it("Property 13: pause lalu resume harus mengembalikan isPaused ke false", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    expect(getState().isPaused).toBe(false);
    pauseSession();
    expect(getState().isPaused).toBe(true);
    resumeSession();
    expect(getState().isPaused).toBe(false);
  });
});

// ─── onPiecePlaced / detectCompletion ─────────────────────────────────────────

describe("onPiecePlaced / detectCompletion", () => {
  it("harus menambah placedPieces setiap kali dipanggil", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    onPiecePlaced(0);
    expect(getState().placedPieces).toBe(1);
    onPiecePlaced(1);
    expect(getState().placedPieces).toBe(2);
  });

  it("harus memanggil onEnd saat semua kepingan ditempatkan", () => {
    const onEnd = vi.fn();
    startSession("easy", () => {}, onEnd);

    // Easy = 9 kepingan
    for (let i = 0; i < 9; i++) {
      onPiecePlaced(i);
    }

    expect(onEnd).toHaveBeenCalledOnce();
    expect(onEnd.mock.calls[0][0].isCompleted).toBe(true);
  });
});

// ─── endSession ───────────────────────────────────────────────────────────────

describe("endSession", () => {
  it("skor harus 0 jika completed=false (waktu habis)", () => {
    const onEnd = vi.fn();
    startSession("easy", () => {}, onEnd);
    endSession(false);
    expect(onEnd.mock.calls[0][0].score).toBe(0);
    expect(onEnd.mock.calls[0][0].isCompleted).toBe(false);
  });

  it("skor harus dihitung jika completed=true", () => {
    const onEnd = vi.fn();
    startSession("medium", () => {}, onEnd);
    endSession(true);
    const finalState = onEnd.mock.calls[0][0];
    expect(finalState.isCompleted).toBe(true);
    expect(finalState.score).toBeGreaterThan(0);
  });

  it("state harus null setelah endSession", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    endSession(false);
    expect(getState()).toBeNull();
  });
});

// ─── sessionStorage round-trip ────────────────────────────────────────────────

describe("saveToSessionStorage / restoreFromSessionStorage", () => {
  it("harus menyimpan dan memulihkan state dengan benar", () => {
    startSession(
      "medium",
      () => {},
      () => {},
    );
    const originalState = getState();
    saveToSessionStorage();

    const restored = restoreFromSessionStorage();
    expect(restored).not.toBeNull();
    expect(restored.sessionId).toBe(originalState.sessionId);
    expect(restored.difficulty).toBe(originalState.difficulty);
    expect(restored.timeRemaining).toBe(originalState.timeRemaining);
    expect(restored.placedPieces).toBe(originalState.placedPieces);
  });

  it("harus mengembalikan null jika tidak ada data tersimpan", () => {
    clearSessionStorage();
    expect(restoreFromSessionStorage()).toBeNull();
  });

  it("clearSessionStorage harus menghapus data", () => {
    startSession(
      "easy",
      () => {},
      () => {},
    );
    saveToSessionStorage();
    clearSessionStorage();
    expect(restoreFromSessionStorage()).toBeNull();
  });

  // Property 12: Round-Trip Penyimpanan dan Pemulihan State Sesi
  it("Property 12: semua field harus identik setelah round-trip", () => {
    startSession(
      "hard",
      () => {},
      () => {},
    );
    onPiecePlaced(0);
    pauseSession();
    const before = getState();
    saveToSessionStorage();
    const after = restoreFromSessionStorage();

    expect(after.sessionId).toBe(before.sessionId);
    expect(after.difficulty).toBe(before.difficulty);
    expect(after.gridSize).toBe(before.gridSize);
    expect(after.totalPieces).toBe(before.totalPieces);
    expect(after.placedPieces).toBe(before.placedPieces);
    expect(after.timeLimit).toBe(before.timeLimit);
    expect(after.timeRemaining).toBe(before.timeRemaining);
    expect(after.isPaused).toBe(before.isPaused);
    expect(after.isCompleted).toBe(before.isCompleted);
    expect(after.score).toBe(before.score);
  });
});
