"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type QuoteSettings } from "@/lib/settings";

type Status = { kind: "idle" | "loading" | "saving" | "ok" | "error"; message?: string };

declare global {
  interface Window {
    shopify?: {
      idToken: () => Promise<string>;
      config: { shop?: string };
    };
  }
}

async function waitForAppBridge(timeoutMs = 8000): Promise<NonNullable<Window["shopify"]>> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const bridge = (globalThis as unknown as { shopify?: Window["shopify"] }).shopify;
    if (bridge?.idToken) return bridge;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("App Bridge failed to load. Open this app from Shopify admin (Apps \u2192 SmartSpaces Quote).");
}

async function getToken(): Promise<string> {
  const bridge = await waitForAppBridge();
  return await bridge.idToken();
}

export default function AdminClient() {
  const [settings, setSettings] = useState<QuoteSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [embedded, setEmbedded] = useState(true);

  useEffect(() => {
    const inIframe = typeof window !== "undefined" && window.top !== window.self;
    setEmbedded(inIframe);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/admin/settings", {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { settings: QuoteSettings };
        setSettings(data.settings);
        setStatus({ kind: "idle" });
      } catch (err) {
        setStatus({ kind: "error", message: (err as Error).message });
      }
    })();
  }, []);

  async function save() {
    setStatus({ kind: "saving" });
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setStatus({ kind: "ok", message: "Settings saved." });
    } catch (err) {
      setStatus({ kind: "error", message: (err as Error).message });
    }
  }

  if (!embedded) {
    return (
      <main style={main}>
        <h1>Open this app from your Shopify admin.</h1>
        <p style={{ color: "#666" }}>
          This page is only accessible inside the Shopify admin iframe. Navigate to your
          Shopify admin → Apps → SmartSpaces Quote.
        </p>
      </main>
    );
  }

  return (
    <main style={main}>
      <h1 style={{ marginBottom: 4 }}>Quote settings</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        These settings are read by the storefront blocks. Quote requests appear in{" "}
        <strong>Orders → Drafts</strong> filtered by tag <code>quote-request</code>.
      </p>

      {status.kind === "loading" && <p>Loading…</p>}
      {status.kind === "error" && (
        <div style={errBox}>
          <strong>Error:</strong> {status.message}
        </div>
      )}

      <section style={card}>
        <h2 style={h2}>Quote-only scope</h2>
        <Label>
          Tag used to mark a product as quote-only
          <input
            style={input}
            value={settings.quoteOnlyTag}
            onChange={(e) => setSettings({ ...settings, quoteOnlyTag: e.target.value })}
          />
          <p style={hint}>
            Any product with this tag — or with the pinned <code>Quote only</code> metafield set
            to True — is treated as quote-only. Price is hidden and the Add to Cart button is
            relabeled to your &ldquo;Add to Quote&rdquo; CTA.
          </p>
        </Label>
      </section>

      <section style={card}>
        <h2 style={h2}>Storefront behavior</h2>
        <Check
          label="Hide price on quote-only product pages"
          checked={settings.hidePriceOnPDP}
          onChange={(v) => setSettings({ ...settings, hidePriceOnPDP: v })}
        />
        <Check
          label="Hide price on collection cards (requires the tag)"
          checked={settings.hidePriceOnCollection}
          onChange={(v) => setSettings({ ...settings, hidePriceOnCollection: v })}
        />
      </section>

      <section style={card}>
        <h2 style={h2}>Button text</h2>
        <Label>
          Add to Quote button
          <input
            style={input}
            value={settings.ctaAddToQuote}
            onChange={(e) => setSettings({ ...settings, ctaAddToQuote: e.target.value })}
          />
        </Label>
        <Label>
          Request Quote link
          <input
            style={input}
            value={settings.ctaRequestQuote}
            onChange={(e) => setSettings({ ...settings, ctaRequestQuote: e.target.value })}
          />
        </Label>
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
        <button type="button" style={primary} disabled={status.kind === "saving"} onClick={save}>
          {status.kind === "saving" ? "Saving…" : "Save settings"}
        </button>
        {status.kind === "ok" && <span style={{ color: "#0a7a3f" }}>{status.message}</span>}
      </div>
    </main>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", marginBottom: 14, fontSize: 14 }}>{children}</label>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "block", margin: "8px 0" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

const main: React.CSSProperties = { padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "0 auto", color: "#1a1a1a" };
const card: React.CSSProperties = { border: "1px solid #e1e1e1", borderRadius: 8, padding: 16, margin: "16px 0", background: "#fff" };
const h2: React.CSSProperties = { fontSize: 16, margin: "0 0 12px" };
const input: React.CSSProperties = { display: "block", width: "100%", marginTop: 4, padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14, boxSizing: "border-box" };
const primary: React.CSSProperties = { padding: "10px 18px", background: "#111", color: "#fff", border: 0, borderRadius: 6, fontWeight: 600, cursor: "pointer" };
const errBox: React.CSSProperties = { padding: 12, background: "#fff3f0", border: "1px solid #ffb4a2", borderRadius: 6, marginBottom: 12, color: "#931c00" };
const hint: React.CSSProperties = { color: "#666", fontSize: 13, marginTop: 4 };
