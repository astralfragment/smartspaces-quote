import { NextResponse } from "next/server";
import { verifyAppProxySignature, queryFromUrl } from "@/lib/hmac";
import { getOfflineContext } from "@/lib/shopify";
import { loadShopSettings } from "@/lib/shopSettings";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  const query = queryFromUrl(req.url);
  if (!verifyAppProxySignature(query, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  const settings = await loadShopSettings(getOfflineContext());
  return NextResponse.json(
    { ok: true, settings },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
