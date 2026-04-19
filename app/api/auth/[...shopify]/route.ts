import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const API_VERSION = "2025-07";

function clientId() {
  const v = process.env.SHOPIFY_API_KEY;
  if (!v) throw new Error("SHOPIFY_API_KEY not set");
  return v;
}
function clientSecret() {
  const v = process.env.SHOPIFY_API_SECRET;
  if (!v) throw new Error("SHOPIFY_API_SECRET not set");
  return v;
}
function appUrl() {
  return process.env.SHOPIFY_APP_URL ?? "";
}
function scopes() {
  return process.env.SHOPIFY_SCOPES ?? "";
}

function verifyInstallHmac(url: URL): boolean {
  const params = new URLSearchParams(url.searchParams);
  const hmac = params.get("hmac");
  if (!hmac) return false;
  params.delete("hmac");
  params.delete("signature");
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const message = sorted.map(([k, v]) => `${k}=${v}`).join("&");
  const expected = createHmac("sha256", clientSecret()).update(message).digest("hex");
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function isValidShop(shop: string | null): shop is string {
  return !!shop && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

export async function GET(req: Request, { params }: { params: Promise<{ shopify: string[] }> }) {
  const { shopify } = await params;
  const action = shopify[0];
  const url = new URL(req.url);

  if (action === "callback") return handleCallback(url);
  return handleInstall(url);
}

function handleInstall(url: URL) {
  const shop = url.searchParams.get("shop");
  if (!isValidShop(shop)) return new NextResponse("Invalid shop", { status: 400 });

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${appUrl()}/api/auth/callback`;
  const installUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId())}` +
    `&scope=${encodeURIComponent(scopes())}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&grant_options[]=`;

  const res = NextResponse.redirect(installUrl);
  res.cookies.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return res;
}

async function handleCallback(url: URL) {
  const shop = url.searchParams.get("shop");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!isValidShop(shop) || !code || !state) return new NextResponse("Missing params", { status: 400 });
  if (!verifyInstallHmac(url)) return new NextResponse("Invalid HMAC", { status: 401 });

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId(),
      client_secret: clientSecret(),
      code,
    }),
  });
  if (!tokenRes.ok) return new NextResponse("Token exchange failed", { status: 500 });
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  await ensureMetafieldDefinitions(shop, access_token);

  const hostParam = url.searchParams.get("host") ?? "";
  const adminRedirect = `https://${shop}/admin/apps/${clientId()}?host=${encodeURIComponent(hostParam)}`;
  return NextResponse.redirect(adminRedirect);
}

async function ensureMetafieldDefinitions(shop: string, token: string) {
  const query = /* GraphQL */ `
    mutation Define($def: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $def) {
        createdDefinition { id }
        userErrors { field message code }
      }
    }
  `;
  const defs = [
    {
      name: "Quote only",
      description: "Hide price + buy button on the storefront; show Request Quote instead.",
      namespace: "quote",
      key: "quote_only",
      type: "boolean",
      ownerType: "PRODUCT",
      pin: true,
      access: { admin: "MERCHANT_READ_WRITE", storefront: "PUBLIC_READ" },
    },
    {
      name: "Quote cart",
      description: "Persisted quote cart for logged-in customers (managed by the app).",
      namespace: "quote",
      key: "cart",
      type: "json",
      ownerType: "CUSTOMER",
      access: { admin: "MERCHANT_READ" },
    },
  ];
  const url = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
  for (const def of defs) {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables: { def } }),
    });
  }
}
