import { describe, it, expect } from "vitest";
import { QuoteSubmissionSchema } from "./quote";

describe("QuoteSubmissionSchema", () => {
  const valid = {
    contact_name: "Ada",
    contact_email: "ada@example.com",
    line_items: [
      { variantId: "gid://shopify/ProductVariant/1", productId: "gid://shopify/Product/1", title: "X", qty: 1 },
    ],
  };

  it("accepts a minimal valid payload", () => {
    const r = QuoteSubmissionSchema.safeParse(valid);
    expect(r.success).toBe(true);
  });

  it("rejects bad email", () => {
    const r = QuoteSubmissionSchema.safeParse({ ...valid, contact_email: "nope" });
    expect(r.success).toBe(false);
  });

  it("rejects an empty cart", () => {
    const r = QuoteSubmissionSchema.safeParse({ ...valid, line_items: [] });
    expect(r.success).toBe(false);
  });

  it("rejects a filled honeypot", () => {
    const r = QuoteSubmissionSchema.safeParse({ ...valid, honeypot: "I am a bot" });
    expect(r.success).toBe(false);
  });

  it("caps line items at 100", () => {
    const lots = Array.from({ length: 101 }, (_, i) => ({
      variantId: `gid://shopify/ProductVariant/${i}`,
      productId: `gid://shopify/Product/${i}`,
      title: "X",
      qty: 1,
    }));
    const r = QuoteSubmissionSchema.safeParse({ ...valid, line_items: lots });
    expect(r.success).toBe(false);
  });
});
