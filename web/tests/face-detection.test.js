import { describe, test, expect } from "vitest";
import fc from "fast-check";

// ── Pure function implementations (mirrored from index.html for testing) ──

function filterValidFaces(detections) {
  return (detections || []).filter((d) => d.score >= 0.7);
}

function assignPlayersByPosition(validFaces) {
  const sorted = [...validFaces].sort(
    (a, b) => a.boundingBox.xCenter - b.boundingBox.xCenter,
  );
  return sorted.map((f, i) => ({ ...f, player: i === 0 ? "p1" : "p2" }));
}

function handleFaceCountChange(fd, faceCount) {
  if (faceCount !== 2) {
    fd.stabilityStart = null;
  } else if (fd.stabilityStart === null) {
    fd.stabilityStart = Date.now();
  }
}

function computeCropRect(bbox, padding, frameW, frameH) {
  const bw = bbox.width * frameW;
  const bh = bbox.height * frameH;
  const cx = bbox.xCenter * frameW;
  const cy = bbox.yCenter * frameH;
  const padX = bw * padding;
  const padY = bh * padding;
  let x = Math.round(cx - bw / 2 - padX);
  let y = Math.round(cy - bh / 2 - padY);
  let w = Math.round(bw + padX * 2);
  let h = Math.round(bh + padY * 2);
  x = Math.max(0, x);
  y = Math.max(0, y);
  if (x + w > frameW) w = frameW - x;
  if (y + h > frameH) h = frameH - y;
  return { x, y, w, h };
}

// ── Property 1: Filter confidence score ──
// Feature: face-detection-2p-auto-start, Property 1
// Validates: Requirements 1.2
describe("filterValidFaces", () => {
  test("Property 1: hanya mengembalikan wajah dengan score >= 0.7", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            score: fc.float({
              min: Math.fround(0),
              max: Math.fround(1),
              noNaN: true,
            }),
            boundingBox: fc.record({
              xCenter: fc.float({
                min: Math.fround(0.1),
                max: Math.fround(0.9),
                noNaN: true,
              }),
              yCenter: fc.float({
                min: Math.fround(0.1),
                max: Math.fround(0.9),
                noNaN: true,
              }),
              width: fc.float({
                min: Math.fround(0.05),
                max: Math.fround(0.4),
                noNaN: true,
              }),
              height: fc.float({
                min: Math.fround(0.05),
                max: Math.fround(0.4),
                noNaN: true,
              }),
            }),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        (detections) => {
          const valid = filterValidFaces(detections);
          const expectedCount = detections.filter((d) => d.score >= 0.7).length;
          return (
            valid.every((d) => d.score >= 0.7) && valid.length === expectedCount
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  test("mengembalikan array kosong jika input kosong", () => {
    expect(filterValidFaces([])).toEqual([]);
    expect(filterValidFaces(null)).toEqual([]);
    expect(filterValidFaces(undefined)).toEqual([]);
  });
});

// ── Property 2: Penugasan P1/P2 berdasarkan posisi horizontal ──
// Feature: face-detection-2p-auto-start, Property 2
// Validates: Requirements 2.4
describe("assignPlayersByPosition", () => {
  test("Property 2: P1 selalu di kiri (xCenter lebih kecil), P2 selalu di kanan", () => {
    fc.assert(
      fc.property(
        fc.float({
          min: Math.fround(0.0),
          max: Math.fround(0.48),
          noNaN: true,
        }),
        fc.float({
          min: Math.fround(0.52),
          max: Math.fround(1.0),
          noNaN: true,
        }),
        (xLeft, xRight) => {
          const faces1 = [
            {
              boundingBox: {
                xCenter: xLeft,
                yCenter: 0.5,
                width: 0.2,
                height: 0.2,
              },
              score: 0.9,
            },
            {
              boundingBox: {
                xCenter: xRight,
                yCenter: 0.5,
                width: 0.2,
                height: 0.2,
              },
              score: 0.9,
            },
          ];
          const faces2 = [
            {
              boundingBox: {
                xCenter: xRight,
                yCenter: 0.5,
                width: 0.2,
                height: 0.2,
              },
              score: 0.9,
            },
            {
              boundingBox: {
                xCenter: xLeft,
                yCenter: 0.5,
                width: 0.2,
                height: 0.2,
              },
              score: 0.9,
            },
          ];
          const r1 = assignPlayersByPosition(faces1);
          const r2 = assignPlayersByPosition(faces2);
          return (
            r1.find((f) => f.player === "p1").boundingBox.xCenter === xLeft &&
            r1.find((f) => f.player === "p2").boundingBox.xCenter === xRight &&
            r2.find((f) => f.player === "p1").boundingBox.xCenter === xLeft &&
            r2.find((f) => f.player === "p2").boundingBox.xCenter === xRight
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 3: Reset stabilitas saat jumlah wajah berubah ──
// Feature: face-detection-2p-auto-start, Property 3
// Validates: Requirements 2.2
describe("handleFaceCountChange", () => {
  test("Property 3: stabilityStart direset untuk semua jumlah wajah selain 2", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }).filter((n) => n !== 2),
        fc.integer({ min: 1, max: 1000 }),
        (faceCount, elapsedMs) => {
          const fd = { stabilityStart: Date.now() - elapsedMs };
          handleFaceCountChange(fd, faceCount);
          return fd.stabilityStart === null;
        },
      ),
      { numRuns: 100 },
    );
  });

  test("stabilityStart di-set saat faceCount === 2 dan stabilityStart null", () => {
    const fd = { stabilityStart: null };
    handleFaceCountChange(fd, 2);
    expect(fd.stabilityStart).not.toBeNull();
    expect(typeof fd.stabilityStart).toBe("number");
  });

  test("stabilityStart tidak berubah jika faceCount === 2 dan sudah ada", () => {
    const ts = Date.now() - 500;
    const fd = { stabilityStart: ts };
    handleFaceCountChange(fd, 2);
    expect(fd.stabilityStart).toBe(ts);
  });
});

// ── Property 4: Crop dengan padding dan dimensi yang valid ──
// Feature: face-detection-2p-auto-start, Property 4
// Validates: Requirements 3.1, 3.2
describe("computeCropRect", () => {
  test("Property 4: hasil crop tidak overflow frame dan menerapkan padding", () => {
    fc.assert(
      fc.property(
        fc.record({
          xCenter: fc.float({
            min: Math.fround(0.15),
            max: Math.fround(0.85),
            noNaN: true,
          }),
          yCenter: fc.float({
            min: Math.fround(0.15),
            max: Math.fround(0.85),
            noNaN: true,
          }),
          width: fc.float({
            min: Math.fround(0.1),
            max: Math.fround(0.5),
            noNaN: true,
          }),
          height: fc.float({
            min: Math.fround(0.1),
            max: Math.fround(0.5),
            noNaN: true,
          }),
        }),
        fc.integer({ min: 320, max: 1920 }),
        fc.integer({ min: 240, max: 1080 }),
        (bbox, frameW, frameH) => {
          const rect = computeCropRect(bbox, 0.2, frameW, frameH);
          return (
            rect.x >= 0 &&
            rect.y >= 0 &&
            rect.x + rect.w <= frameW &&
            rect.y + rect.h <= frameH &&
            rect.w > 0 &&
            rect.h > 0
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 5: Validasi ukuran minimum crop ──
// Feature: face-detection-2p-auto-start, Property 5
// Validates: Requirements 3.4
describe("cropFaceRegion minimum size", () => {
  test("Property 5: computeCropRect menghasilkan rect kecil untuk bbox sangat kecil", () => {
    fc.assert(
      fc.property(
        fc.record({
          xCenter: fc.float({
            min: Math.fround(0.1),
            max: Math.fround(0.9),
            noNaN: true,
          }),
          yCenter: fc.float({
            min: Math.fround(0.1),
            max: Math.fround(0.9),
            noNaN: true,
          }),
          width: fc.float({
            min: Math.fround(0.001),
            max: Math.fround(0.03),
            noNaN: true,
          }),
          height: fc.float({
            min: Math.fround(0.001),
            max: Math.fround(0.03),
            noNaN: true,
          }),
        }),
        fc.integer({ min: 320, max: 1280 }),
        fc.integer({ min: 240, max: 720 }),
        (bbox, frameW, frameH) => {
          const rect = computeCropRect(bbox, 0.2, frameW, frameH);
          // Untuk bbox sangat kecil, rect.w dan rect.h harus < 80
          // (sehingga cropFaceRegion akan return null)
          const expectedW = Math.round(bbox.width * frameW * 1.4);
          const expectedH = Math.round(bbox.height * frameH * 1.4);
          if (expectedW >= 80 || expectedH >= 80) return true; // skip edge case
          return rect.w < 80 || rect.h < 80;
        },
      ),
      { numRuns: 100 },
    );
  });
});
