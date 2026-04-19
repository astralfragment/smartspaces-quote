import { adminGraphQL, type ShopifyAdminContext } from "./shopify";

const CUSTOMER_BY_EMAIL = /* GraphQL */ `
  query CustomerByEmail($query: String!) {
    customers(first: 1, query: $query) {
      edges { node { id email } }
    }
  }
`;

const CUSTOMER_CREATE = /* GraphQL */ `
  mutation CustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id email }
      userErrors { field message }
    }
  }
`;

type CustomerByEmailData = {
  customers: { edges: Array<{ node: { id: string; email: string } }> };
};

type CustomerCreateData = {
  customerCreate: {
    customer: { id: string; email: string } | null;
    userErrors: Array<{ field: string[] | null; message: string }>;
  };
};

export async function findOrCreateCustomer(
  ctx: ShopifyAdminContext,
  input: { email: string; name: string; phone?: string },
): Promise<{ id: string; email: string }> {
  const [firstName, ...rest] = input.name.trim().split(/\s+/);
  const lastName = rest.join(" ") || undefined;

  const found = await adminGraphQL<CustomerByEmailData>(ctx, CUSTOMER_BY_EMAIL, {
    query: `email:${JSON.stringify(input.email)}`,
  });
  const existing = found.customers.edges[0]?.node;
  if (existing) return existing;

  const created = await adminGraphQL<CustomerCreateData>(ctx, CUSTOMER_CREATE, {
    input: {
      email: input.email,
      firstName: firstName || input.email,
      lastName,
      phone: input.phone || undefined,
      tags: ["quote-lead"],
    },
  });
  if (!created.customerCreate.customer) {
    throw new Error(`customerCreate failed: ${JSON.stringify(created.customerCreate.userErrors)}`);
  }
  return created.customerCreate.customer;
}
