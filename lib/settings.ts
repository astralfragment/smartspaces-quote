import { z } from "zod";

export const QuoteSettingsSchema = z.object({
  quoteOnlyTag: z.string().min(1).max(60),
  ctaAddToQuote: z.string().min(1).max(60),
  ctaRequestQuote: z.string().min(1).max(60),
  hidePriceOnPDP: z.boolean(),
  hidePriceOnCollection: z.boolean(),
});

export type QuoteSettings = z.infer<typeof QuoteSettingsSchema>;

export const DEFAULT_SETTINGS: QuoteSettings = {
  quoteOnlyTag: "quote-only",
  ctaAddToQuote: "Add to Quote",
  ctaRequestQuote: "Request Quote",
  hidePriceOnPDP: true,
  hidePriceOnCollection: true,
};

export const SHOP_SETTINGS_METAFIELD = {
  namespace: "quote",
  key: "settings",
  type: "json",
} as const;
