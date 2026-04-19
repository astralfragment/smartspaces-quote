import { z } from "zod";

export const QuoteLineItemSchema = z.object({
  variantId: z.string().min(1),
  productId: z.string().min(1),
  title: z.string().min(1),
  qty: z.number().int().min(1).max(9999),
  note: z.string().max(500).optional(),
});

export const QuoteSubmissionSchema = z.object({
  contact_name: z.string().min(1).max(120),
  contact_email: z.string().email().max(200),
  contact_phone: z.string().max(40).optional().default(""),
  project_address: z.string().max(500).optional().default(""),
  timeline: z.string().max(100).optional().default(""),
  budget_range: z.string().max(100).optional().default(""),
  notes: z.string().max(4000).optional().default(""),
  line_items: z.array(QuoteLineItemSchema).min(1).max(100),
  honeypot: z.string().max(0).optional(),
  floor_plan_file_id: z.string().optional(),
});

export type QuoteSubmission = z.infer<typeof QuoteSubmissionSchema>;
export type QuoteLineItem = z.infer<typeof QuoteLineItemSchema>;

export const QuoteCartSchema = z.object({
  items: z.array(QuoteLineItemSchema).max(100),
  updatedAt: z.number().int(),
});

export type QuoteCart = z.infer<typeof QuoteCartSchema>;

export const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
export const QUOTE_REQUEST_TAG = "quote-request";
