import { describe, it, expect } from "vitest";
import { computeRSI, computeMACDHistogram, computeBollingerB } from "../lattice-engine";

// ─── RSI ──────────────────────────────────────────────────────────────────────

describe("computeRSI()", () => {
  it("returns 50 when there is insufficient data", () => {
    expect(computeRSI([100, 101, 102])).toBe(50);
  });

  it("returns 100 when price only goes up (no losses)", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(computeRSI(closes)).toBe(100);
  });

  it("returns a number between 0 and 100 for normal data", () => {
    const closes = [
      100, 102, 101, 103, 102, 105, 104, 106, 103, 107,
      105, 108, 106, 107, 109, 108, 110, 107, 109, 111,
    ];
    const rsi = computeRSI(closes);
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it("returns a low RSI for a consistently declining price series", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 200 - i);
    const rsi = computeRSI(closes);
    expect(rsi).toBeLessThan(20);
  });

  it("returns a high RSI for a consistently rising price series", () => {
    // Not as extreme as pure gains, but still skewed bullish
    const closes = [100, 101, 103, 102, 104, 105, 107, 106, 108, 110,
                    109, 111, 112, 114, 113, 115, 117, 116, 118, 120];
    const rsi = computeRSI(closes);
    expect(rsi).toBeGreaterThan(60);
  });
});

// ─── MACD Histogram ───────────────────────────────────────────────────────────

describe("computeMACDHistogram()", () => {
  it("returns 0 when there are fewer than 26 data points", () => {
    expect(computeMACDHistogram([100, 101, 102])).toBe(0);
    expect(computeMACDHistogram(Array.from({ length: 25 }, (_, i) => 100 + i))).toBe(0);
  });

  it("returns a non-zero value with 26 or more data points", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i);
    expect(computeMACDHistogram(closes)).not.toBe(0);
  });

  it("returns a number (not NaN) for valid series", () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = computeMACDHistogram(closes);
    expect(Number.isFinite(result)).toBe(true);
  });
});

// ─── Bollinger %B ─────────────────────────────────────────────────────────────

describe("computeBollingerB()", () => {
  it("returns 0.5 when there is insufficient data", () => {
    expect(computeBollingerB([100, 101, 102], 20)).toBe(0.5);
  });

  it("returns 0.5 when all prices are identical (zero std dev)", () => {
    const closes = Array.from({ length: 20 }, () => 100);
    expect(computeBollingerB(closes)).toBe(0.5);
  });

  it("returns > 0.5 when current price is above the mid band", () => {
    const closes = Array.from({ length: 20 }, () => 100);
    // Override the last price to be higher
    closes[closes.length - 1] = 110;
    const result = computeBollingerB(closes);
    expect(result).toBeGreaterThan(0.5);
  });

  it("returns a finite number for a normal price series", () => {
    const closes = [
      95, 97, 99, 100, 102, 101, 103, 104, 100, 98,
      99, 101, 103, 102, 104, 105, 103, 106, 107, 108,
    ];
    const result = computeBollingerB(closes);
    expect(Number.isFinite(result)).toBe(true);
  });
});
