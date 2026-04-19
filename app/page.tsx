import { redirect, notFound } from "next/navigation";

type SearchParams = Promise<{ host?: string; shop?: string; embedded?: string }>;

export default async function Root({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const queryString = new URLSearchParams();
  if (sp.host) queryString.set("host", sp.host);
  if (sp.shop) queryString.set("shop", sp.shop);
  if (sp.embedded) queryString.set("embedded", sp.embedded);

  if (sp.host || sp.shop) {
    const suffix = queryString.toString();
    redirect(`/admin${suffix ? `?${suffix}` : ""}`);
  }
  notFound();
}
