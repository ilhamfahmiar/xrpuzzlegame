/**
 * Tests untuk leaderboard.js — LocalStorage Manager
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  isStorageAvailable,
  getEntries,
  saveEntry,
  isTopScore,
  clearAll,
  generateId,
} from "../js/leaderboard.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides = {}) {
  return {
    id: generateId(),
    nama: "Pemain Test",
    skor: 1000,
    tingkat_kesulitan: "easy",
    durasi_detik: 120,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearAll();
});

// ─── isStorageAvailable ───────────────────────────────────────────────────────

describe("isStorageAvailable", () => {
  it("harus mengembalikan true di jsdom environment", () => {
    expect(isStorageAvailable()).toBe(true);
  });
});

// ─── getEntries ───────────────────────────────────────────────────────────────

describe("getEntries", () => {
  it("harus mengembalikan array kosong jika tidak ada data", () => {
    expect(getEntries("easy")).toEqual([]);
    expect(getEntries("medium")).toEqual([]);
    expect(getEntries("hard")).toEqual([]);
  });

  it("harus mengembalikan entri yang sudah disimpan", () => {
    const entry = makeEntry({ skor: 500 });
    saveEntry(entry);
    const entries = getEntries("easy");
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe(entry.id);
  });

  // Property 16: Leaderboard Selalu Diurutkan Descending
  it("Property 16: harus mengembalikan entri diurutkan descending berdasarkan skor", () => {
    saveEntry(makeEntry({ skor: 300 }));
    saveEntry(makeEntry({ skor: 100 }));
    saveEntry(makeEntry({ skor: 500 }));
    saveEntry(makeEntry({ skor: 200 }));

    const entries = getEntries("easy");
    for (let i = 0; i < entries.length - 1; i++) {
      expect(entries[i].skor).toBeGreaterThanOrEqual(entries[i + 1].skor);
    }
  });
});

// ─── saveEntry ────────────────────────────────────────────────────────────────

describe("saveEntry", () => {
  it("harus menyimpan entri baru dan mengembalikan true", () => {
    const entry = makeEntry();
    expect(saveEntry(entry)).toBe(true);
    expect(getEntries("easy")).toHaveLength(1);
  });

  it("harus menolak entri jika skor tidak cukup tinggi saat kapasitas penuh", () => {
    // Isi 10 entri dengan skor 1000
    for (let i = 0; i < 10; i++) {
      saveEntry(makeEntry({ id: `id-${i}`, skor: 1000 }));
    }
    // Coba simpan entri dengan skor lebih rendah
    const result = saveEntry(makeEntry({ id: "low-score", skor: 500 }));
    expect(result).toBe(false);
    expect(getEntries("easy")).toHaveLength(10);
  });

  it("harus mengganti entri terendah jika skor baru lebih tinggi dan kapasitas penuh", () => {
    // Isi 10 entri dengan skor 100-1000
    for (let i = 1; i <= 10; i++) {
      saveEntry(makeEntry({ id: `id-${i}`, skor: i * 100 }));
    }
    // Simpan entri dengan skor lebih tinggi dari minimum (100)
    const newEntry = makeEntry({ id: "new-high", skor: 1500 });
    const result = saveEntry(newEntry);
    expect(result).toBe(true);

    const entries = getEntries("easy");
    expect(entries).toHaveLength(10);
    // Entri baru harus ada
    expect(entries.some((e) => e.id === "new-high")).toBe(true);
    // Entri terendah (skor 100) harus sudah diganti
    expect(entries.some((e) => e.skor === 100)).toBe(false);
  });

  // Property 14: Kapasitas Leaderboard Tidak Melebihi 10 Entri
  it("Property 14: jumlah entri tidak boleh melebihi 10 setelah banyak penyimpanan", () => {
    for (let i = 0; i < 25; i++) {
      saveEntry(
        makeEntry({ id: `id-${i}`, skor: Math.floor(Math.random() * 10000) }),
      );
    }
    expect(getEntries("easy").length).toBeLessThanOrEqual(10);
  });
});

// ─── Isolasi per difficulty ───────────────────────────────────────────────────

describe("Isolasi data per difficulty", () => {
  // Property 15: Isolasi Data Leaderboard Per Difficulty
  it("Property 15: entri easy tidak boleh muncul di medium atau hard", () => {
    const easyEntry = makeEntry({ tingkat_kesulitan: "easy", skor: 999 });
    const mediumEntry = makeEntry({ tingkat_kesulitan: "medium", skor: 888 });
    const hardEntry = makeEntry({ tingkat_kesulitan: "hard", skor: 777 });

    saveEntry(easyEntry);
    saveEntry(mediumEntry);
    saveEntry(hardEntry);

    const easyEntries = getEntries("easy");
    const mediumEntries = getEntries("medium");
    const hardEntries = getEntries("hard");

    expect(easyEntries.some((e) => e.id === easyEntry.id)).toBe(true);
    expect(easyEntries.some((e) => e.id === mediumEntry.id)).toBe(false);
    expect(easyEntries.some((e) => e.id === hardEntry.id)).toBe(false);

    expect(mediumEntries.some((e) => e.id === mediumEntry.id)).toBe(true);
    expect(mediumEntries.some((e) => e.id === easyEntry.id)).toBe(false);

    expect(hardEntries.some((e) => e.id === hardEntry.id)).toBe(true);
    expect(hardEntries.some((e) => e.id === easyEntry.id)).toBe(false);
  });
});

// ─── isTopScore ───────────────────────────────────────────────────────────────

describe("isTopScore", () => {
  it("harus mengembalikan true jika leaderboard kosong", () => {
    expect(isTopScore(100, "easy")).toBe(true);
  });

  it("harus mengembalikan true jika kurang dari 10 entri", () => {
    saveEntry(makeEntry({ skor: 500 }));
    expect(isTopScore(1, "easy")).toBe(true);
  });

  it("harus mengembalikan true jika skor lebih tinggi dari minimum saat penuh", () => {
    for (let i = 1; i <= 10; i++) {
      saveEntry(makeEntry({ id: `id-${i}`, skor: i * 100 }));
    }
    // Minimum adalah 100, skor 101 harus masuk
    expect(isTopScore(101, "easy")).toBe(true);
  });

  it("harus mengembalikan false jika skor sama atau lebih rendah dari minimum saat penuh", () => {
    for (let i = 1; i <= 10; i++) {
      saveEntry(makeEntry({ id: `id-${i}`, skor: i * 100 }));
    }
    // Minimum adalah 100, skor 100 tidak boleh masuk (harus lebih tinggi)
    expect(isTopScore(100, "easy")).toBe(false);
    expect(isTopScore(50, "easy")).toBe(false);
  });
});

// ─── Round-trip baca-tulis ────────────────────────────────────────────────────

describe("Round-trip baca-tulis leaderboard", () => {
  // Property 17: Round-Trip Baca-Tulis Leaderboard
  it("Property 17: semua field entri harus identik setelah disimpan dan dibaca", () => {
    const entry = {
      id: "test-id-123",
      nama: "Pemain Uji",
      skor: 1234,
      tingkat_kesulitan: "medium",
      durasi_detik: 95,
      timestamp: 1700000000000,
    };

    saveEntry(entry);
    const entries = getEntries("medium");
    const found = entries.find((e) => e.id === entry.id);

    expect(found).toBeDefined();
    expect(found.id).toBe(entry.id);
    expect(found.nama).toBe(entry.nama);
    expect(found.skor).toBe(entry.skor);
    expect(found.tingkat_kesulitan).toBe(entry.tingkat_kesulitan);
    expect(found.durasi_detik).toBe(entry.durasi_detik);
    expect(found.timestamp).toBe(entry.timestamp);
  });
});

// ─── clearAll ─────────────────────────────────────────────────────────────────

describe("clearAll", () => {
  it("harus menghapus semua data dari semua difficulty", () => {
    saveEntry(makeEntry({ tingkat_kesulitan: "easy" }));
    saveEntry(makeEntry({ tingkat_kesulitan: "medium" }));
    saveEntry(makeEntry({ tingkat_kesulitan: "hard" }));

    clearAll();

    expect(getEntries("easy")).toEqual([]);
    expect(getEntries("medium")).toEqual([]);
    expect(getEntries("hard")).toEqual([]);
  });
});
