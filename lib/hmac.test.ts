import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyAppProxySignature, queryFromUrl } from "./hmac";

const SECRET = "test-secret";

function sign(q: Record<string, string>) {
  const message = Object.keys(q)
    .sort()
    .map((k) => `${k}=${q[k]}`)
    .join("");
  return createHmac("sha256", SECRET).update(message).digest("hex");
}

describe("verifyAppProxySignature", () => {
  it("accepts a correctly signed request", () => {
    const q = { shop: "demo.myshopify.com", path_prefix: "/apps/quote", timestamp: "1700000000" };
    const signature = sign(q);
    expect(verifyAppProxySignature({ ...q, signature }, SECRET)).toBe(true);
  });

  it("rejects a tampered request", () => {
    const q = { shop: "demo.myshopify.com", path_prefix: "/apps/quote", timestamp: "1700000000" };
    const signature = sign(q);
    expect(verifyAppProxySignature({ ...q, signature, path_prefix: "/apps/evil" }, SECRET)).toBe(false);
  });

  it("rejects when signature is missing", () => {
    expect(verifyAppProxySignature({ shop: "demo.myshopify.com" }, SECRET)).toBe(false);
  });

  it("rejects against a wrong secret", () => {
    const q = { shop: "demo.myshopify.com", timestamp: "1700000000" };
    const signature = sign(q);
    expect(verifyAppProxySignature({ ...q, signature }, "other-secret")).toBe(false);
  });
});

describe("queryFromUrl", () => {
  it("extracts search params as a flat record", () => {
    const url = "https://app.example.com/api/proxy/submit?shop=demo.myshopify.com&timestamp=1700000000&signature=abc";
    expect(queryFromUrl(url)).toEqual({
      shop: "demo.myshopify.com",
      timestamp: "1700000000",
      signature: "abc",
    });
  });
});
