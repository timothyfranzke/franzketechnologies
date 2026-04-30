import { describe, it, expect } from "vitest";
import {
  computeTileY,
  computeProgress,
  hitTest,
  createAccumulator,
  updateAccumulator,
} from "./lightningMatchRenderer.js";

// ─── computeTileY ─────────────────────────────────────────────────

describe("computeTileY", () => {
  it("returns -tileH at progress 0 (tile above canvas)", () => {
    expect(computeTileY(0, 40, 600)).toBe(-40);
  });

  it("returns canvasH at progress 1 (tile below canvas)", () => {
    expect(computeTileY(1, 40, 600)).toBe(600);
  });

  it("returns midpoint at progress 0.5", () => {
    // lerp(-40, 600, 0.5) = -40 + 640 * 0.5 = 280
    expect(computeTileY(0.5, 40, 600)).toBe(280);
  });

  it("returns correct position at progress 0.25", () => {
    // lerp(-40, 600, 0.25) = -40 + 640 * 0.25 = 120
    expect(computeTileY(0.25, 40, 600)).toBe(120);
  });
});

// ─── computeProgress ──────────────────────────────────────────────

describe("computeProgress", () => {
  it("returns 0 at spawn time", () => {
    expect(computeProgress(1000, 1000, 6000)).toBe(0);
  });

  it("returns 0.5 halfway through fall", () => {
    expect(computeProgress(4000, 1000, 6000)).toBe(0.5);
  });

  it("returns 1 at end of fall", () => {
    expect(computeProgress(7000, 1000, 6000)).toBe(1);
  });

  it("returns > 1 when overdue", () => {
    expect(computeProgress(8000, 1000, 6000)).toBeGreaterThan(1);
  });
});

// ─── hitTest ──────────────────────────────────────────────────────

describe("hitTest", () => {
  const bounds = [
    { id: "a", x: 10, y: 10, w: 80, h: 40 },
    { id: "b", x: 50, y: 30, w: 80, h: 40 },
    { id: "c", x: 200, y: 100, w: 60, h: 30 },
  ];

  it("returns null when no tile hit", () => {
    expect(hitTest(300, 300, bounds)).toBeNull();
  });

  it("hits a tile in the center", () => {
    expect(hitTest(230, 115, bounds)).toBe("c");
  });

  it("returns top-most (last in array) tile when overlapping", () => {
    // Point (60, 40) is inside both "a" (10-90, 10-50) and "b" (50-130, 30-70)
    expect(hitTest(60, 40, bounds)).toBe("b");
  });

  it("hits tile at exact edge", () => {
    expect(hitTest(10, 10, bounds)).toBe("a");
  });

  it("hits tile at bottom-right edge", () => {
    // (45, 48) is inside "a" (10-90, 10-50) but outside "b" (50-130, 30-70)
    expect(hitTest(45, 48, bounds)).toBe("a");
  });

  it("returns null with empty bounds", () => {
    expect(hitTest(50, 50, [])).toBeNull();
  });
});

// ─── Accumulator ──────────────────────────────────────────────────

describe("createAccumulator", () => {
  it("creates with zero accumulated", () => {
    const acc = createAccumulator(1000);
    expect(acc.intervalMs).toBe(1000);
    expect(acc.accumulated).toBe(0);
  });
});

describe("updateAccumulator", () => {
  it("does not fire before interval", () => {
    const acc = createAccumulator(1000);
    const result = updateAccumulator(acc, 500);
    expect(result.fires).toBe(0);
    expect(result.accumulated).toBe(500);
  });

  it("fires once at exactly the interval", () => {
    const acc = createAccumulator(1000);
    const result = updateAccumulator(acc, 1000);
    expect(result.fires).toBe(1);
    expect(result.accumulated).toBe(0);
  });

  it("fires multiple times for large delta", () => {
    const acc = createAccumulator(1000);
    const result = updateAccumulator(acc, 3500);
    expect(result.fires).toBe(3);
    expect(result.accumulated).toBe(500);
  });

  it("accumulates across multiple updates", () => {
    const acc = createAccumulator(1000);
    // First update: 600ms, no fire
    const r1 = updateAccumulator(acc, 600);
    expect(r1.fires).toBe(0);
    expect(r1.accumulated).toBe(600);

    // Second update: 600ms with 600 already accumulated → fires once, 200 left
    const r2 = updateAccumulator({ ...acc, accumulated: r1.accumulated }, 600);
    expect(r2.fires).toBe(1);
    expect(r2.accumulated).toBe(200);
  });

  it("handles zero delta", () => {
    const acc = createAccumulator(1000);
    const result = updateAccumulator(acc, 0);
    expect(result.fires).toBe(0);
    expect(result.accumulated).toBe(0);
  });
});
