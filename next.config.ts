import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors https://*.myshopify.com https://admin.shopify.com" },
        ],
      },
    ];
  },
};

export default config;
