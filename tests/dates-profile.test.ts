import { expect, test, vi, afterEach } from "vitest";
import {
  captureLoggingTime,
  formatDateKey,
  getLast7Days,
  nextLoggingMidnight,
  offsetDate,
  validateDateKey,
} from "../lib/dates";
import { readProfile, writeProfile } from "../lib/profile-storage";
afterEach(() => vi.useRealTimers());
test.each([
  ["2026-03-08T06:00:00Z", "2026-03-09T05:00:00Z"],
  ["2026-11-01T05:00:00Z", "2026-11-02T06:00:00Z"],
  ["2026-12-31T23:00:00Z", "2027-01-01T06:00:00Z"],
])(
  "next Chicago midnight respects DST and year boundaries: %s",
  (now, midnight) => {
    expect(new Date(nextLoggingMidnight(Date.parse(now))).toISOString()).toBe(
      new Date(midnight).toISOString(),
    );
  },
);
test("a request started before midnight keeps its original logging date after completion", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-22T04:59:59Z"));
  const operation = captureLoggingTime();
  vi.advanceTimersByTime(120_000);
  expect(captureLoggingTime().date).toBe("2026-09-22");
  expect(operation.date).toBe("2026-09-21");
  expect(formatDateKey(new Date(operation.loggedAt))).toBe(operation.date);
});
test("calendar windows are based on Chicago dates, not local browser offsets", () => {
  expect(formatDateKey(new Date("2026-09-22T08:00:00+09:00"))).toBe(
    "2026-09-21",
  );
  expect(getLast7Days("2026-03-10")).toEqual([
    "2026-03-10",
    "2026-03-09",
    "2026-03-08",
    "2026-03-07",
    "2026-03-06",
    "2026-03-05",
    "2026-03-04",
  ]);
  expect(offsetDate("2026-01-01", -13)).toBe("2025-12-19");
  for (const date of ["2026-02-30", "junk", "2026-13-01", "2026-9-1"])
    expect(() => validateDateKey(date)).toThrow();
});
test("storage failures do not prevent in-memory profile selection", () => {
  const blocked = {
    getItem() {
      throw new Error("Blocked");
    },
    setItem() {
      throw new Error("Blocked");
    },
    removeItem() {
      throw new Error("Blocked");
    },
  };
  expect(readProfile(blocked)).toBeNull();
  expect(() => writeProfile(blocked, "valid")).not.toThrow();
  expect(() => writeProfile(blocked, null)).not.toThrow();
});
