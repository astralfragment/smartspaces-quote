import type {
  CartValidationsGenerateRunInput,
  CartValidationsGenerateRunResult,
  ValidationError,
} from "../generated/api";

// Blocks checkout for quote-only SKUs to close the `/cart/<variant>:<qty>?replace`
// permalink bypass of the storefront's Add-to-Quote UI.

const TRUTHY_VALUES = new Set(["true", "1", "yes"]);

function isQuoteOnly(metafieldValue: string | null | undefined): boolean {
  if (!metafieldValue) return false;
  return TRUTHY_VALUES.has(metafieldValue.trim().toLowerCase());
}

export function cartValidationsGenerateRun(
  input: CartValidationsGenerateRunInput,
): CartValidationsGenerateRunResult {
  const errors: ValidationError[] = [];

  for (const line of input.cart.lines) {
    if (line.merchandise.__typename !== "ProductVariant") continue;

    const product = line.merchandise.product;
    const tagged = product.hasTags.some(
      (t) => t.tag === "quote-only" && t.hasTag,
    );
    const metafielded = isQuoteOnly(product.metafield?.value);

    if (tagged || metafielded) {
      errors.push({
        message: `"${product.title}" requires a quote — please complete the quote request instead.`,
        target: "$.cart",
      });
    }
  }

  return {
    operations: [
      {
        validationAdd: { errors },
      },
    ],
  };
}
