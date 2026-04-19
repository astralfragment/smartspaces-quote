import { z } from "zod";

export const QuoteSettingsSchema = z.object({
  hidePriceOnStorefront: z.boolean(),
  hidePriceOnCollectionCards: z.boolean(),
  replaceAddToCart: z.boolean(),
  ctaAddToQuote: z.string().min(1).max(60),
  ctaRequestQuote: z.string().min(1).max(60),
  hintText: z.string().max(300),
  quoteOnlyTag: z.string().min(1).max(60),
});

export type QuoteSettings = z.infer<typeof QuoteSettingsSchema>;

export const DEFAULT_SETTINGS: QuoteSettings = {
  hidePriceOnStorefront: true,
  hidePriceOnCollectionCards: true,
  replaceAddToCart: true,
  ctaAddToQuote: "Add to Quote",
  ctaRequestQuote: "Request Quote",
  hintText: "Price on request — add to your quote for a personalized estimate.",
  quoteOnlyTag: "quote-only",
};

export const SHOP_SETTINGS_METAFIELD = {
  namespace: "quote",
  key: "settings",
  type: "json",
} as const;
