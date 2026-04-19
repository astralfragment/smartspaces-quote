import { NextResponse } from "next/server";
import { verifyShopifySessionToken, extractBearerToken } from "@/lib/sessionToken";
import { QuoteSettingsSchema } from "@/lib/settings";
import { loadShopSettings, saveShopSettings } from "@/lib/shopSettings";
import { getOfflineContext } from "@/lib/shopify";

export const runtime = "nodejs";

function authGuard(req: Request): VerifiedOr401 {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return { ok: false, response: NextResponse.json({ error: "server_not_configured" }, { status: 500 }) };
  }
  const bearer = extractBearerToken(req);
  if (!bearer) {
    return { ok: false, response: NextResponse.json({ error: "missing_session_token" }, { status: 401 }) };
  }
  try {
    const session = verifyShopifySessionToken(bearer, { apiKey, apiSecret });
    const expectedShop = process.env.SHOPIFY_SHOP_DOMAIN;
    if (expectedShop && session.shopDomain !== expectedShop) {
      return {
        ok: false,
        response: NextResponse.json({ error: "shop_mismatch" }, { status: 403 }),
      };
    }
    return { ok: true, session };
  } catch (err) {
    return {
      ok: false,
      response: NextResponse.json({ error: "invalid_session_token", reason: (err as Error).message }, { status: 401 }),
    };
  }
}

type VerifiedOr401 =
  | { ok: true; session: { shopDomain: string; userId: string } }
  | { ok: false; response: NextResponse };

export async function GET(req: Request) {
  const g = authGuard(req);
  if (!g.ok) return g.response;
  const settings = await loadShopSettings(getOfflineContext());
  return NextResponse.json({ ok: true, settings });
}

export async function POST(req: Request) {
  const g = authGuard(req);
  if (!g.ok) return g.response;
  const body = await req.json().catch(() => null);
  const parsed = QuoteSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }
  await saveShopSettings(getOfflineContext(), parsed.data);
  return NextResponse.json({ ok: true });
}
