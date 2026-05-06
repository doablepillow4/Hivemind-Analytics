import { describe, it, expect } from "vitest";
import { safeNum, sanitizeSparkline } from "../market-data";

describe("safeNum()", () => {
  it("returns the number as-is for a valid number", () => {
    expect(safeNum(42)).toBe(42);
    expect(safeNum(0)).toBe(0);
    expect(safeNum(-7.5)).toBe(-7.5);
  });

  it("parses a string number", () => {
    expect(safeNum("3.14")).toBeCloseTo(3.14);
    expect(safeNum("0")).toBe(0);
    expect(safeNum("-100")).toBe(-100);
  });

  it("returns the fallback for NaN", () => {
    expect(safeNum(NaN)).toBe(0);
    expect(safeNum(NaN, 99)).toBe(99);
  });

  it("returns the fallback for Infinity", () => {
    expect(safeNum(Infinity)).toBe(0);
    expect(safeNum(-Infinity, -1)).toBe(-1);
  });

  it("returns the fallback for null and undefined", () => {
    expect(safeNum(null)).toBe(0);
    expect(safeNum(undefined, 5)).toBe(5);
  });

  it("returns the fallback for non-numeric strings", () => {
    expect(safeNum("not-a-number")).toBe(0);
    expect(safeNum("", 7)).toBe(7);
  });

  it("uses 0 as the default fallback", () => {
    expect(safeNum(null)).toBe(0);
  });
});

describe("sanitizeSparkline()", () => {
  it("returns clean data unchanged", () => {
    expect(sanitizeSparkline([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
  });

  it("fills null gaps with the last valid value (forward-fill)", () => {
    expect(sanitizeSparkline([1, null, null, 4])).toEqual([1, 1, 1, 4]);
  });

  it("uses 0 as the seed value before the first valid number", () => {
    expect(sanitizeSparkline([null, null, 5])).toEqual([0, 0, 5]);
  });

  it("handles entirely null array by returning all zeros", () => {
    expect(sanitizeSparkline([null, null, null])).toEqual([0, 0, 0]);
  });

  it("returns an empty array for empty input", () => {
    expect(sanitizeSparkline([])).toEqual([]);
  });

  it("fills undefined with the last valid value", () => {
    expect(sanitizeSparkline([10, undefined, 20])).toEqual([10, 10, 20]);
  });

  it("preserves the last valid value through multiple trailing nulls", () => {
    const result = sanitizeSparkline([5, null, null, null]);
    expect(result).toEqual([5, 5, 5, 5]);
  });
});
