import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, _resetForTests } from "./rateLimit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    _resetForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T00:00:00Z"));
  });

  it("allows the first request from a new IP", () => {
    const result = checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it("allows requests up to the configured limit", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit and returns a positive retryAfterMs", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 });
    const sixth = checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 });
    expect(sixth.allowed).toBe(false);
    expect(sixth.retryAfterMs).toBeGreaterThan(0);
    expect(sixth.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("allows requests again after the window expires", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 });
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("tracks IPs independently", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 });
    expect(checkRateLimit("1.2.3.4", { limit: 5, windowMs: 60_000 }).allowed).toBe(false);
    expect(checkRateLimit("5.6.7.8", { limit: 5, windowMs: 60_000 }).allowed).toBe(true);
  });
});
