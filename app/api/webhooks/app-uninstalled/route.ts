import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.SHOPIFY_API_SECRET;
  const hmac = req.headers.get("x-shopify-hmac-sha256");
  if (!secret || !hmac) return NextResponse.json({ error: "invalid" }, { status: 401 });

  const body = await req.text();
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "invalid_hmac" }, { status: 401 });
  }

  // Single-store custom install: nothing persisted server-side. No cleanup needed.
  return NextResponse.json({ ok: true });
}
