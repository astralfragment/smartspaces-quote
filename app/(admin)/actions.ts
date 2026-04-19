"use server";

import { getOfflineContext, adminGraphQL } from "@/lib/shopify";

export type QuoteSettings = {
  merchantNotificationEmail: string;
  defaultQuoteExpiryDays: number;
  collectPhone: boolean;
  collectProjectAddress: boolean;
  collectTimeline: boolean;
  collectBudgetRange: boolean;
  collectFloorPlan: boolean;
};

const SHOP_ID = /* GraphQL */ `query { shop { id } }`;

const SET_METAFIELD = /* GraphQL */ `
  mutation Set($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

const PRODUCT_SET_QUOTE_ONLY = /* GraphQL */ `
  mutation ToggleQuoteOnly($id: ID!, $value: String!, $tagsToAdd: [String!], $tagsToRemove: [String!]) {
    metafieldsSet(metafields: [{
      ownerId: $id, namespace: "quote", key: "quote_only", type: "boolean", value: $value
    }]) {
      userErrors { field message }
    }
    tagsAdd(id: $id, tags: $tagsToAdd) { userErrors { field message } }
    tagsRemove(id: $id, tags: $tagsToRemove) { userErrors { field message } }
  }
`;

export async function saveSettings(formData: FormData): Promise<void> {
  const settings: QuoteSettings = {
    merchantNotificationEmail: String(formData.get("merchantNotificationEmail") ?? ""),
    defaultQuoteExpiryDays: Number(formData.get("defaultQuoteExpiryDays") ?? 14),
    collectPhone: formData.get("collectPhone") === "on",
    collectProjectAddress: formData.get("collectProjectAddress") === "on",
    collectTimeline: formData.get("collectTimeline") === "on",
    collectBudgetRange: formData.get("collectBudgetRange") === "on",
    collectFloorPlan: formData.get("collectFloorPlan") === "on",
  };

  const ctx = getOfflineContext();
  const shop = await adminGraphQL<{ shop: { id: string } }>(ctx, SHOP_ID);

  await adminGraphQL(ctx, SET_METAFIELD, {
    metafields: [
      {
        ownerId: shop.shop.id,
        namespace: "quote",
        key: "settings",
        type: "json",
        value: JSON.stringify(settings),
      },
    ],
  });
}

export async function bulkToggleQuoteOnly(formData: FormData): Promise<{ count: number }> {
  const raw = String(formData.get("productIds") ?? "");
  const quoteOnly = formData.get("quoteOnly") === "on";
  const ids = raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("gid://") ? s : `gid://shopify/Product/${s}`));

  const ctx = getOfflineContext();
  for (const id of ids) {
    await adminGraphQL(ctx, PRODUCT_SET_QUOTE_ONLY, {
      id,
      value: quoteOnly ? "true" : "false",
      tagsToAdd: quoteOnly ? ["quote-only"] : [],
      tagsToRemove: quoteOnly ? [] : ["quote-only"],
    });
  }
  return { count: ids.length };
}
