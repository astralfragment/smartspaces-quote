export default function Landing() {
  return (
    <main style={{ padding: 40, fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto" }}>
      <h1>SmartSpaces Quote</h1>
      <p>Shopify request-a-quote app for home automation dealers.</p>
      <p>
        <a href="/admin">Admin settings →</a>
      </p>
      <p style={{ color: "#666", fontSize: 14 }}>
        For merchants: open this app from your Shopify admin (Apps → SmartSpaces Quote).
      </p>
    </main>
  );
}
