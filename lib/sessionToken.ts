import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionTokenPayload = {
  iss: string;
  dest: string;
  aud: string;
  sub: string;
  exp: number;
  nbf: number;
  iat: number;
  jti: string;
  sid: string;
};

export type VerifiedSession = {
  shopDomain: string;
  userId: string;
};

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64").toString("utf8");
}

export function verifyShopifySessionToken(
  token: string,
  opts: { apiKey: string; apiSecret: string },
): VerifiedSession {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("invalid_token_format");

  const [header64, payload64, signature64] = parts;
  const signingInput = `${header64}.${payload64}`;

  const expected = createHmac("sha256", opts.apiSecret).update(signingInput).digest();
  const actual = Buffer.from(signature64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("invalid_signature");
  }

  const payload = JSON.parse(base64urlDecode(payload64)) as SessionTokenPayload;
  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== "number" || payload.exp <= now) throw new Error("token_expired");
  if (typeof payload.nbf !== "number" || payload.nbf > now + 10) throw new Error("token_not_yet_valid");
  if (payload.aud !== opts.apiKey) throw new Error("invalid_audience");

  let issHost: string;
  let destHost: string;
  try {
    issHost = new URL(payload.iss).hostname;
    destHost = new URL(payload.dest).hostname;
  } catch {
    throw new Error("invalid_iss_or_dest");
  }

  const issTopLevel = issHost.split(".").slice(-3).join(".");
  const destTopLevel = destHost.split(".").slice(-3).join(".");
  if (issTopLevel !== destTopLevel) throw new Error("iss_dest_mismatch");

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(destHost)) throw new Error("invalid_shop");

  return { shopDomain: destHost, userId: payload.sub };
}

export function extractBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const [scheme, value] = h.split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !value) return null;
  return value;
}
