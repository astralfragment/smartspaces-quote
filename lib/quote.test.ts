import { describe, it, expect } from "vitest";
import { QuoteSubmissionSchema } from "./quote";

describe("QuoteSubmissionSchema", () => {
  const valid = {
    contact_name: "Ada",
    contact_email: "ada@example.com",
    line_items: [
      {
        variant_id: 111,
        product_id: 1,
        product_title: "Amp X",
        quantity: 1,
        key: "111:abcdef0123456789abcdef0123456789",
      },
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

  it("rejects more than 200 line items", () => {
    const lots = Array.from({ length: 201 }, (_, i) => ({
      variant_id: i + 1,
      product_id: i + 1,
      product_title: "X",
      quantity: 1,
      key: `${i + 1}:abcdef0123456789abcdef0123456789`,
    }));
    const r = QuoteSubmissionSchema.safeParse({ ...valid, line_items: lots });
    expect(r.success).toBe(false);
  });

  it("accepts optional variant_title, image, line_price", () => {
    const r = QuoteSubmissionSchema.safeParse({
      ...valid,
      line_items: [
        {
          ...valid.line_items[0],
          variant_title: "Black",
          image: "https://cdn.shopify.com/x.jpg",
          line_price: 12999,
        },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("accepts a payload with all new optional fields populated", () => {
    const r = QuoteSubmissionSchema.safeParse({
      ...valid,
      preferred_contact: "whatsapp",
      install_required: true,
      existing_system: "Sonos + Lutron Caseta",
      rooms: [
        { name: "Living Room", notes: "primary listening space" },
        { name: "Master Bedroom" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("accepts a payload with all new fields omitted", () => {
    const r = QuoteSubmissionSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.rooms).toEqual([]);
      expect(r.data.preferred_contact).toBeUndefined();
      expect(r.data.install_required).toBeUndefined();
      expect(r.data.existing_system).toBe("");
    }
  });

  it("rejects more than 50 rooms", () => {
    const rooms = Array.from({ length: 51 }, (_, i) => ({ name: `Room ${i + 1}` }));
    const r = QuoteSubmissionSchema.safeParse({ ...valid, rooms });
    expect(r.success).toBe(false);
  });

  it("rejects a room with empty name", () => {
    const r = QuoteSubmissionSchema.safeParse({
      ...valid,
      rooms: [{ name: "", notes: "orphan" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid preferred_contact value", () => {
    const r = QuoteSubmissionSchema.safeParse({ ...valid, preferred_contact: "carrier-pigeon" });
    expect(r.success).toBe(false);
  });
});
