import { describe, expect, it } from "vitest";
import { cartValidationsGenerateRun } from "../src/cart_validations_generate_run";
import type { CartValidationsGenerateRunInput } from "../generated/api";

function line(
  title: string,
  opts: { tagged?: boolean; metafield?: string | null } = {},
): CartValidationsGenerateRunInput["cart"]["lines"][number] {
  return {
    quantity: 1,
    merchandise: {
      __typename: "ProductVariant",
      product: {
        id: `gid://shopify/Product/${title.replace(/\s+/g, "-")}`,
        title,
        hasTags: [{ tag: "quote-only", hasTag: opts.tagged ?? false }],
        metafield: opts.metafield === undefined ? null : { value: opts.metafield as string },
      },
    },
  } as CartValidationsGenerateRunInput["cart"]["lines"][number];
}

function inp(lines: CartValidationsGenerateRunInput["cart"]["lines"]): CartValidationsGenerateRunInput {
  return { cart: { lines } } as CartValidationsGenerateRunInput;
}

describe("cartValidationsGenerateRun", () => {
  it("returns no errors for an empty cart", () => {
    const result = cartValidationsGenerateRun(inp([]));
    expect(result.operations[0].validationAdd.errors).toEqual([]);
  });

  it("returns no errors when cart has only regular items", () => {
    const result = cartValidationsGenerateRun(
      inp([line("HDMI Cable"), line("Wall Plate", { metafield: "false" })]),
    );
    expect(result.operations[0].validationAdd.errors).toEqual([]);
  });

  it("blocks checkout when a line has the quote-only tag", () => {
    const result = cartValidationsGenerateRun(
      inp([line("Control4 EA-5 Controller", { tagged: true })]),
    );
    const errors = result.operations[0].validationAdd.errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].target).toBe("$.cart");
    expect(errors[0].message).toContain("Control4 EA-5 Controller");
    expect(errors[0].message).toContain("quote");
  });

  it("blocks checkout when the quote.quote_only metafield is true (string)", () => {
    const result = cartValidationsGenerateRun(
      inp([line("Savant Pro Host", { metafield: "true" })]),
    );
    expect(result.operations[0].validationAdd.errors).toHaveLength(1);
  });

  it("treats string 'false' as not quote-only", () => {
    const result = cartValidationsGenerateRun(
      inp([line("Regular Speaker", { metafield: "false" })]),
    );
    expect(result.operations[0].validationAdd.errors).toEqual([]);
  });

  it("accepts other truthy metafield values: '1', 'yes', mixed case", () => {
    const r1 = cartValidationsGenerateRun(inp([line("A", { metafield: "1" })]));
    const r2 = cartValidationsGenerateRun(inp([line("B", { metafield: "yes" })]));
    const r3 = cartValidationsGenerateRun(inp([line("C", { metafield: "TRUE" })]));
    expect(r1.operations[0].validationAdd.errors).toHaveLength(1);
    expect(r2.operations[0].validationAdd.errors).toHaveLength(1);
    expect(r3.operations[0].validationAdd.errors).toHaveLength(1);
  });

  it("emits one error per quote-only line in a mixed cart", () => {
    const result = cartValidationsGenerateRun(
      inp([
        line("HDMI Cable"),
        line("Crestron Processor", { tagged: true }),
        line("Crestron Touch Panel", { metafield: "true" }),
      ]),
    );
    const errors = result.operations[0].validationAdd.errors;
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain("Crestron Processor");
    expect(errors[1].message).toContain("Crestron Touch Panel");
  });

  it("ignores non-ProductVariant merchandise (e.g. CustomProduct)", () => {
    const custom: CartValidationsGenerateRunInput["cart"]["lines"][number] = {
      quantity: 1,
      merchandise: { __typename: "CustomProduct" },
    } as CartValidationsGenerateRunInput["cart"]["lines"][number];
    const result = cartValidationsGenerateRun(inp([custom]));
    expect(result.operations[0].validationAdd.errors).toEqual([]);
  });
});
