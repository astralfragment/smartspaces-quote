import { z } from "zod";

/**
 * Line-item shape emitted by Shopify's storefront `/cart.js`.
 * The client-side script on /pages/request-quote fetches /cart.js,
 * filters to the quote-only subset, and POSTs the raw items (plus
 * contact fields) to /apps/quote/submit. The route handler maps
 * numeric IDs to GIDs before invoking Admin-API helpers.
 */
export const QuoteLineItemSchema = z.object({
  variant_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  product_title: z.string().min(1).max(500),
  quantity: z.number().int().min(1).max(9999),
  key: z.string().min(1).max(200),
  variant_title: z.string().max(500).nullable().optional(),
  image: z.string().max(2000).nullable().optional(),
  line_price: z.number().nonnegative().optional(),
});

export const QuoteSubmissionSchema = z.object({
  contact_name: z.string().min(1).max(120),
  contact_email: z.string().email().max(200),
  contact_phone: z.string().max(40).optional().default(""),
  project_address: z.string().max(500).optional().default(""),
  timeline: z.string().max(100).optional().default(""),
  budget_range: z.string().max(100).optional().default(""),
  notes: z.string().max(4000).optional().default(""),
  line_items: z.array(QuoteLineItemSchema).min(1).max(200),
  honeypot: z.string().max(0).optional(),
});

export type QuoteSubmission = z.infer<typeof QuoteSubmissionSchema>;
export type QuoteLineItem = z.infer<typeof QuoteLineItemSchema>;

export const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
export const QUOTE_REQUEST_TAG = "quote-request";
