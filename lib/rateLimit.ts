type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (existing.count < opts.limit) {
    existing.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }
  return { allowed: false, retryAfterMs: existing.resetAt - now };
}

export function _resetForTests(): void {
  buckets.clear();
}
