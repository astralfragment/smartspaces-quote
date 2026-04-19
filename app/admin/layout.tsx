import type { ReactNode } from "react";
import Script from "next/script";

export const metadata = {
  title: "SmartSpaces Quote — Settings",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  return (
    <>
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        data-api-key={apiKey}
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
