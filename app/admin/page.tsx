import { redirect } from "next/navigation";
import AdminClient from "./AdminClient";

type SearchParams = Promise<{ host?: string; shop?: string; embedded?: string }>;

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const { host, shop } = await searchParams;
  if (!host && !shop) {
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const appHandle = "smartspaces-quote";
    if (shopDomain) {
      const handle = shopDomain.replace(".myshopify.com", "");
      redirect(`https://admin.shopify.com/store/${handle}/apps/${appHandle}`);
    }
  }
  return <AdminClient />;
}
