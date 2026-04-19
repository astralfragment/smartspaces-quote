import { adminGraphQL, type ShopifyAdminContext } from "./shopify";
import { DEDUPE_WINDOW_MS, QUOTE_REQUEST_TAG, type QuoteSubmission } from "./quote";

const DRAFT_ORDER_CREATE = /* GraphQL */ `
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name invoiceUrl createdAt }
      userErrors { field message }
    }
  }
`;

const DRAFT_ORDER_UPDATE = /* GraphQL */ `
  mutation DraftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
    draftOrderUpdate(id: $id, input: $input) {
      draftOrder { id name }
      userErrors { field message }
    }
  }
`;

const RECENT_DRAFTS_BY_EMAIL = /* GraphQL */ `
  query RecentDrafts($query: String!) {
    draftOrders(first: 5, query: $query, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          createdAt
          tags
          email
          lineItems(first: 100) {
            edges { node { variant { id } quantity title } }
          }
        }
      }
    }
  }
`;

type DraftOrderCreateData = {
  draftOrderCreate: {
    draftOrder: { id: string; name: string; invoiceUrl: string | null; createdAt: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
};

type RecentDraftsData = {
  draftOrders: {
    edges: Array<{
      node: {
        id: string;
        createdAt: string;
        tags: string[];
        email: string | null;
        lineItems: { edges: Array<{ node: { variant: { id: string } | null; quantity: number; title: string } }> };
      };
    }>;
  };
};

export type QuoteDraftOrder = {
  id: string;
  name: string;
  invoiceUrl: string | null;
  deduped: boolean;
};

/**
 * Internal shape used to build the DraftOrderInput. The route handler is
 * responsible for mapping the Shopify /cart.js line items to this shape
 * (numeric ids → GIDs, key → customer_note-style attribute if desired).
 */
export type DraftOrderLineItem = {
  variantId: string;
  quantity: number;
  title?: string;
};

export type QuoteDraftContext = {
  submission: QuoteSubmission;
  lineItems: DraftOrderLineItem[];
  floorPlanFileId?: string;
};

export function buildDraftOrderInput(
  ctx: QuoteDraftContext,
  customerId: string,
): Record<string, unknown> {
  const { submission, lineItems, floorPlanFileId } = ctx;
  const customAttributes: Array<{ key: string; value: string }> = [
    { key: "source", value: "quote-request" },
  ];
  if (submission.contact_phone) customAttributes.push({ key: "phone", value: submission.contact_phone });
  if (submission.project_address) customAttributes.push({ key: "project_address", value: submission.project_address });
  if (submission.timeline) customAttributes.push({ key: "timeline", value: submission.timeline });
  if (submission.budget_range) customAttributes.push({ key: "budget_range", value: submission.budget_range });
  if (submission.preferred_contact)
    customAttributes.push({ key: "preferred_contact", value: submission.preferred_contact });
  if (submission.install_required)
    customAttributes.push({ key: "install_required", value: "Yes" });
  if (submission.existing_system)
    customAttributes.push({ key: "existing_system", value: submission.existing_system });
  submission.rooms.forEach((r, i) => {
    customAttributes.push({
      key: `room_${i + 1}`,
      value: r.notes ? `${r.name} — ${r.notes}` : r.name,
    });
  });
  if (floorPlanFileId) customAttributes.push({ key: "floor_plan_file_id", value: floorPlanFileId });

  return {
    tags: [QUOTE_REQUEST_TAG],
    note: submission.notes || undefined,
    email: submission.contact_email,
    purchasingEntity: { customerId },
    lineItems: lineItems.map((li) => ({
      variantId: li.variantId,
      quantity: li.quantity,
    })),
    customAttributes,
    useCustomerDefaultAddress: true,
  };
}

export async function findRecentDuplicateDraft(
  ctx: ShopifyAdminContext,
  email: string,
  now: number = Date.now(),
): Promise<{ id: string } | null> {
  const data = await adminGraphQL<RecentDraftsData>(ctx, RECENT_DRAFTS_BY_EMAIL, {
    query: `email:${JSON.stringify(email)} tag:${QUOTE_REQUEST_TAG} status:open`,
  });
  for (const edge of data.draftOrders.edges) {
    const created = Date.parse(edge.node.createdAt);
    if (Number.isFinite(created) && now - created < DEDUPE_WINDOW_MS) {
      return { id: edge.node.id };
    }
  }
  return null;
}

export async function createDraftOrderFromQuote(
  ctx: ShopifyAdminContext,
  draftCtx: QuoteDraftContext,
  customerId: string,
): Promise<QuoteDraftOrder> {
  const duplicate = await findRecentDuplicateDraft(ctx, draftCtx.submission.contact_email);
  if (duplicate) {
    await adminGraphQL(ctx, DRAFT_ORDER_UPDATE, {
      id: duplicate.id,
      input: buildDraftOrderInput(draftCtx, customerId),
    });
    return { id: duplicate.id, name: "(appended)", invoiceUrl: null, deduped: true };
  }

  const data = await adminGraphQL<DraftOrderCreateData>(ctx, DRAFT_ORDER_CREATE, {
    input: buildDraftOrderInput(draftCtx, customerId),
  });
  const d = data.draftOrderCreate.draftOrder;
  if (!d) {
    throw new Error(`draftOrderCreate failed: ${JSON.stringify(data.draftOrderCreate.userErrors)}`);
  }
  return { id: d.id, name: d.name, invoiceUrl: d.invoiceUrl, deduped: false };
}
