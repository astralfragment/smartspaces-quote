import { NextResponse } from "next/server";
import {
  QuoteSubmissionSchema,
  QUOTE_REQUEST_TAG,
  type QuoteLineItem,
} from "@/lib/quote";
import { verifyAppProxySignature, queryFromUrl } from "@/lib/hmac";
import { getOfflineContext } from "@/lib/shopify";
import { findOrCreateCustomer } from "@/lib/customer";
import {
  createDraftOrderFromQuote,
  type DraftOrderLineItem,
} from "@/lib/draftOrder";
import { uploadToShopifyFiles } from "@/lib/files";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

function toDraftLineItems(items: QuoteLineItem[]): DraftOrderLineItem[] {
  return items.map((li) => ({
    variantId: `gid://shopify/ProductVariant/${li.variant_id}`,
    quantity: li.quantity,
    title: li.product_title,
  }));
}

export async function POST(req: Request) {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret) return NextResponse.json({ error: "server_not_configured" }, { status: 500 });

  const xff = req.headers.get("x-forwarded-for");
  const ip =
    req.headers.get("x-real-ip") ||
    (xff ? xff.split(",").map((s) => s.trim()).filter(Boolean).pop() : null) ||
    "unknown";
  const rl = checkRateLimit(`submit:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const query = queryFromUrl(req.url);
  if (!verifyAppProxySignature(query, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let payload: unknown;
  let filePart: File | null = null;

  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const json = form.get("payload");
    if (typeof json !== "string") return NextResponse.json({ error: "missing_payload" }, { status: 400 });
    payload = JSON.parse(json);
    const f = form.get("floor_plan");
    if (f instanceof File && f.size > 0) filePart = f;
  } else if (contentType.startsWith("application/json")) {
    payload = await req.json();
  } else {
    return NextResponse.json({ error: "unsupported_content_type" }, { status: 415 });
  }

  if (
    payload &&
    typeof payload === "object" &&
    typeof (payload as { honeypot?: unknown }).honeypot === "string" &&
    (payload as { honeypot: string }).honeypot.length > 0
  ) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const parsed = QuoteSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }
  const submission = parsed.data;

  const ctx = getOfflineContext();

  let floorPlanFileId: string | undefined;
  if (filePart) {
    const maxBytes = 10 * 1024 * 1024;
    if (filePart.size > maxBytes) {
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }
    const buffer = Buffer.from(await filePart.arrayBuffer());
    const uploaded = await uploadToShopifyFiles(ctx, {
      buffer,
      filename: filePart.name || "floor_plan.pdf",
      mimeType: filePart.type || "application/pdf",
    });
    floorPlanFileId = uploaded.fileId;
  }

  const customer = await findOrCreateCustomer(ctx, {
    email: submission.contact_email,
    name: submission.contact_name,
    phone: submission.contact_phone,
  });

  const draft = await createDraftOrderFromQuote(
    ctx,
    {
      submission,
      lineItems: toDraftLineItems(submission.line_items),
      floorPlanFileId,
    },
    customer.id,
  );

  return NextResponse.json(
    {
      ok: true,
      deduped: draft.deduped,
      draftOrderId: draft.id,
      tag: QUOTE_REQUEST_TAG,
    },
    { status: 200 },
  );
}
