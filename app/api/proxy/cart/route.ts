import { NextResponse } from "next/server";
import { QuoteCartSchema } from "@/lib/quote";
import { verifyAppProxySignature, queryFromUrl } from "@/lib/hmac";
import { adminGraphQL, getOfflineContext } from "@/lib/shopify";

export const runtime = "nodejs";

const CUSTOMER_CART_GET = /* GraphQL */ `
  query CustomerCart($id: ID!) {
    customer(id: $id) {
      id
      metafield(namespace: "quote", key: "cart") { value }
    }
  }
`;

const CUSTOMER_CART_SET = /* GraphQL */ `
  mutation CartSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

function requireLoggedInCustomerId(query: Record<string, string>): string | null {
  const raw = query.logged_in_customer_id;
  if (!raw) return null;
  return `gid://shopify/Customer/${raw}`;
}

async function guard(req: Request): Promise<{ query: Record<string, string> } | NextResponse> {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  const query = queryFromUrl(req.url);
  if (!verifyAppProxySignature(query, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  return { query };
}

export async function GET(req: Request) {
  const g = await guard(req);
  if (g instanceof NextResponse) return g;
  const customerGid = requireLoggedInCustomerId(g.query);
  if (!customerGid) return NextResponse.json({ items: [], updatedAt: 0 });

  const ctx = getOfflineContext();
  const data = await adminGraphQL<{ customer: { metafield: { value: string } | null } | null }>(
    ctx,
    CUSTOMER_CART_GET,
    { id: customerGid },
  );
  const raw = data.customer?.metafield?.value;
  if (!raw) return NextResponse.json({ items: [], updatedAt: 0 });
  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ items: [], updatedAt: 0 });
  }
}

export async function PUT(req: Request) {
  const g = await guard(req);
  if (g instanceof NextResponse) return g;
  const customerGid = requireLoggedInCustomerId(g.query);
  if (!customerGid) return NextResponse.json({ error: "not_logged_in" }, { status: 401 });

  const body = await req.json();
  const parsed = QuoteCartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }

  const ctx = getOfflineContext();
  await adminGraphQL(ctx, CUSTOMER_CART_SET, {
    metafields: [
      {
        ownerId: customerGid,
        namespace: "quote",
        key: "cart",
        type: "json",
        value: JSON.stringify(parsed.data),
      },
    ],
  });
  return NextResponse.json({ ok: true });
}
