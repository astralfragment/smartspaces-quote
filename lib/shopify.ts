const ADMIN_API_VERSION = "2025-07";

export type ShopifyAdminContext = {
  shop: string;
  accessToken: string;
};

export function getOfflineContext(): ShopifyAdminContext {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_OFFLINE_TOKEN;
  if (!shop) throw new Error("SHOPIFY_SHOP_DOMAIN is not set");
  if (!accessToken) throw new Error("SHOPIFY_OFFLINE_TOKEN is not set");
  return { shop, accessToken };
}

export async function adminGraphQL<T = unknown>(
  ctx: ShopifyAdminContext,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const url = `https://${ctx.shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ctx.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    throw new Error(`Shopify Admin API ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) {
    throw new Error(`Shopify Admin API errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}
