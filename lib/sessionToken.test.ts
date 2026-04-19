import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyShopifySessionToken } from "./sessionToken";

const API_KEY = "test-client-id";
const API_SECRET = "test-secret";

function base64url(input: string | Buffer): string {
  return (typeof input === "string" ? Buffer.from(input, "utf8") : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeToken(claims: Record<string, unknown>, secret = API_SECRET): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claims));
  const sig = base64url(createHmac("sha256", secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

function validClaims(overrides: Partial<Record<string, unknown>> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: "https://demo.myshopify.com/admin",
    dest: "https://demo.myshopify.com",
    aud: API_KEY,
    sub: "42",
    exp: now + 60,
    nbf: now - 10,
    iat: now,
    jti: "x",
    sid: "y",
    ...overrides,
  };
}

describe("verifyShopifySessionToken", () => {
  it("accepts a valid token", () => {
    const token = makeToken(validClaims());
    const result = verifyShopifySessionToken(token, { apiKey: API_KEY, apiSecret: API_SECRET });
    expect(result.shopDomain).toBe("demo.myshopify.com");
    expect(result.userId).toBe("42");
  });

  it("rejects tampered signature", () => {
    const token = makeToken(validClaims(), "wrong-secret");
    expect(() => verifyShopifySessionToken(token, { apiKey: API_KEY, apiSecret: API_SECRET })).toThrow(
      /invalid_signature/,
    );
  });

  it("rejects expired token", () => {
    const token = makeToken(validClaims({ exp: Math.floor(Date.now() / 1000) - 5 }));
    expect(() => verifyShopifySessionToken(token, { apiKey: API_KEY, apiSecret: API_SECRET })).toThrow(
      /token_expired/,
    );
  });

  it("rejects wrong audience", () => {
    const token = makeToken(validClaims({ aud: "other-app" }));
    expect(() => verifyShopifySessionToken(token, { apiKey: API_KEY, apiSecret: API_SECRET })).toThrow(
      /invalid_audience/,
    );
  });

  it("rejects iss/dest domain mismatch", () => {
    const token = makeToken(
      validClaims({ iss: "https://demo.myshopify.com/admin", dest: "https://other.myshopify.com" }),
    );
    expect(() => verifyShopifySessionToken(token, { apiKey: API_KEY, apiSecret: API_SECRET })).toThrow(
      /iss_dest_mismatch/,
    );
  });
});
