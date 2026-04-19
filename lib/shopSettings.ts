import { adminGraphQL, type ShopifyAdminContext } from "./shopify";
import { DEFAULT_SETTINGS, QuoteSettingsSchema, SHOP_SETTINGS_METAFIELD, type QuoteSettings } from "./settings";

const SHOP_SETTINGS_QUERY = /* GraphQL */ `
  query ShopSettings {
    shop {
      id
      metafield(namespace: "quote", key: "settings") { value }
    }
  }
`;

const METAFIELDS_SET = /* GraphQL */ `
  mutation Set($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message code }
    }
  }
`;

type ShopResp = { shop: { id: string; metafield: { value: string } | null } };

export async function loadShopSettings(ctx: ShopifyAdminContext): Promise<QuoteSettings> {
  const data = await adminGraphQL<ShopResp>(ctx, SHOP_SETTINGS_QUERY);
  const raw = data.shop.metafield?.value;
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = QuoteSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveShopSettings(
  ctx: ShopifyAdminContext,
  input: QuoteSettings,
): Promise<void> {
  const data = await adminGraphQL<ShopResp>(ctx, SHOP_SETTINGS_QUERY);
  const ownerId = data.shop.id;
  const result = await adminGraphQL<{
    metafieldsSet: { userErrors: Array<{ message: string; code?: string }> };
  }>(ctx, METAFIELDS_SET, {
    metafields: [
      {
        ownerId,
        namespace: SHOP_SETTINGS_METAFIELD.namespace,
        key: SHOP_SETTINGS_METAFIELD.key,
        type: SHOP_SETTINGS_METAFIELD.type,
        value: JSON.stringify(input),
      },
    ],
  });
  const errors = result.metafieldsSet.userErrors;
  if (errors.length > 0) {
    throw new Error(`saveShopSettings failed: ${JSON.stringify(errors)}`);
  }
}
