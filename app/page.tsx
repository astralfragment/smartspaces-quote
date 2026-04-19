export default function Home() {
  return (
    <main
      style={{
        padding: 40,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 720,
        margin: "40px auto",
        color: "#1a1a1a",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Quote requests</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        This app has no custom admin UI. Everything is managed from native Shopify admin.
      </p>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>Where things live</h2>
        <ul style={{ lineHeight: 1.9 }}>
          <li>
            <strong>Mark a product as quote-only:</strong> open any product and toggle the{" "}
            <em>Quote only</em> field (under Metafields, pinned). Also add the tag{" "}
            <code>quote-only</code> if you want collection-grid prices hidden too.
          </li>
          <li>
            <strong>Review a new quote request:</strong> go to Orders → Drafts and filter by tag{" "}
            <code>quote-request</code>. Edit prices, add service line items, click{" "}
            <em>Send invoice</em>.
          </li>
          <li>
            <strong>Email notifications:</strong> configured in Shopify Flow. See repo{" "}
            <code>flows/README.md</code>.
          </li>
          <li>
            <strong>Storefront setup:</strong> theme editor → enable the{" "}
            <em>Quote: Cart Drawer</em> app embed, add the <em>Quote: Product CTA</em> block to
            your product template, and drop the <em>Quote: Request Page</em> block onto a page
            with handle <code>request-quote</code>.
          </li>
        </ul>
      </section>
    </main>
  );
}
