import { describe, expect, it } from "vitest";
import { draw_time, getMeanAndVar, getOccurance, getStats } from "./stats";

describe("draw_time", () => {
  it("converts microseconds to a rounded millisecond label", () => {
    expect(draw_time(12400)).toBe("12 ms");
    expect(draw_time(0)).toBe("0 ms");
  });

  it("falls back to 0 ms for missing or invalid values", () => {
    expect(draw_time(null)).toBe("0 ms");
    expect(draw_time(undefined)).toBe("0 ms");
    expect(draw_time(NaN)).toBe("0 ms");
  });
});

describe("getMeanAndVar", () => {
  it("returns zeros for an empty or missing array", () => {
    expect(getMeanAndVar([])).toEqual({ average: 0, std_deviation: 0 });
    expect(getMeanAndVar(null)).toEqual({ average: 0, std_deviation: 0 });
  });

  it("computes the population standard deviation", () => {
    const { average, std_deviation } = getMeanAndVar([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(average).toBe(5);
    expect(std_deviation).toBe(2);
  });
});

describe("getStats", () => {
  it("returns zeros without samples", () => {
    expect(getStats([])).toEqual({ median: 0, min: 0, max: 0, average: 0, std_deviation: 0, samples: 0 });
    expect(getStats(undefined).samples).toBe(0);
  });

  it("takes the middle value for an odd count", () => {
    expect(getStats([30, 10, 20])).toMatchObject({ median: 20, min: 10, max: 30, average: 20, samples: 3 });
  });

  it("averages the two middle values for an even count", () => {
    expect(getStats([40, 10, 20, 30]).median).toBe(25);
  });

  it("does not mutate its input", () => {
    const input = [3, 1, 2];
    getStats(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("getOccurance", () => {
  it("returns a single empty bin without data", () => {
    expect(getOccurance([])).toEqual([0]);
  });

  it("builds one bin per 5 ms up to the maximum", () => {
    expect(getOccurance([1], 250)).toHaveLength(51);
  });

  it("falls back to 250 ms for an invalid maximum", () => {
    expect(getOccurance([1], -1)).toHaveLength(51);
    expect(getOccurance([1], "x")).toHaveLength(51);
  });

  it("places values in 5 ms bins (microsecond input, rounded up)", () => {
    const bins = getOccurance([0, 5000, 5001, 10000], 50);
    expect(bins[0]).toBe(1);
    expect(bins[1]).toBe(1);
    expect(bins[2]).toBe(2);
  });

  it("puts values above the range in the last bin", () => {
    const bins = getOccurance([900000], 50);
    expect(bins[bins.length - 1]).toBe(1);
  });
});
