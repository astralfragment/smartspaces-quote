import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyAppProxySignature(
  query: Record<string, string | string[] | undefined>,
  secret: string,
): boolean {
  const signature = typeof query.signature === "string" ? query.signature : undefined;
  if (!signature) return false;

  const message = Object.keys(query)
    .filter((k) => k !== "signature")
    .sort()
    .map((k) => {
      const v = query[k];
      const value = Array.isArray(v) ? v.join(",") : (v ?? "");
      return `${k}=${value}`;
    })
    .join("");

  const expected = createHmac("sha256", secret).update(message).digest("hex");

  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function queryFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const u = new URL(url);
  for (const [k, v] of u.searchParams.entries()) out[k] = v;
  return out;
}
