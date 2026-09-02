import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDuration, todayInZurich } from "@/lib/format";

describe("formatDuration", () => {
  it("formats sub-hour durations as mm:ss", () => {
    expect(formatDuration(65)).toBe("01:05");
  });

  it("formats hour-plus durations as h:mm:ss", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  it("pads single-digit minutes and seconds", () => {
    expect(formatDuration(5)).toBe("00:05");
  });
});

describe("todayInZurich", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // CEST (UTC+2) im Sommer: 22:30 UTC ist bereits 00:30 Uhr des Folgetags
  // in Zürich — genau der Fall, den die UTC-basierte Berechnung falsch
  // stempeln würde.
  it("rolls over to the next local day for a late-night UTC instant in summer (CEST, UTC+2)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T22:30:00Z"));
    expect(todayInZurich()).toBe("2026-06-15");
  });

  // CET (UTC+1) im Winter: 23:30 UTC ist erst 00:30 Uhr des Folgetags in
  // Zürich (kleinerer Versatz als im Sommer, aber derselbe Effekt).
  it("rolls over to the next local day for a late-night UTC instant in winter (CET, UTC+1)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-14T23:30:00Z"));
    expect(todayInZurich()).toBe("2026-01-15");
  });

  it("stays on the same local day for a UTC instant well within the local day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-14T10:00:00Z"));
    expect(todayInZurich()).toBe("2026-06-14");
  });
});
