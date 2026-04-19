"use client";

import { useState, useTransition } from "react";
import type { QuoteSettings } from "./actions";

type Props = {
  initial: QuoteSettings;
  saveAction: (fd: FormData) => Promise<void>;
  bulkToggleAction: (fd: FormData) => Promise<{ count: number }>;
};

export default function SettingsForm({ initial, saveAction, bulkToggleAction }: Props) {
  const [saved, setSaved] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave(fd: FormData) {
    setSaved(false);
    startTransition(async () => {
      await saveAction(fd);
      setSaved(true);
    });
  }

  function handleBulk(fd: FormData) {
    setBulkResult(null);
    startTransition(async () => {
      const r = await bulkToggleAction(fd);
      setBulkResult(`Updated ${r.count} product(s).`);
    });
  }

  return (
    <>
      <section style={card}>
        <h2>Form fields</h2>
        <form action={handleSave}>
          <label style={row}>
            Merchant notification email
            <input
              type="email"
              name="merchantNotificationEmail"
              defaultValue={initial.merchantNotificationEmail}
              style={input}
            />
          </label>
          <label style={row}>
            Default quote expiry (days)
            <input
              type="number"
              name="defaultQuoteExpiryDays"
              defaultValue={initial.defaultQuoteExpiryDays}
              min={1}
              max={365}
              style={input}
            />
          </label>
          <Check name="collectPhone" label="Collect phone" defaultChecked={initial.collectPhone} />
          <Check name="collectProjectAddress" label="Collect project address" defaultChecked={initial.collectProjectAddress} />
          <Check name="collectTimeline" label="Collect project timeline" defaultChecked={initial.collectTimeline} />
          <Check name="collectBudgetRange" label="Collect budget range" defaultChecked={initial.collectBudgetRange} />
          <Check name="collectFloorPlan" label="Allow floor plan upload" defaultChecked={initial.collectFloorPlan} />
          <button type="submit" disabled={pending} style={button}>
            {pending ? "Saving…" : "Save settings"}
          </button>
          {saved && <span style={{ marginLeft: 12, color: "#0a0" }}>Saved.</span>}
        </form>
      </section>

      <section style={card}>
        <h2>Mark products as quote-only</h2>
        <p style={{ color: "#555", fontSize: 14 }}>
          Paste product IDs or full GIDs (one per line or comma-separated). This sets the{" "}
          <code>quote.quote_only</code> metafield and toggles the <code>quote-only</code> tag.
        </p>
        <form action={handleBulk}>
          <textarea
            name="productIds"
            rows={5}
            placeholder="7384729384&#10;gid://shopify/Product/7384729384"
            style={{ ...input, width: "100%", fontFamily: "monospace" }}
          />
          <Check name="quoteOnly" label="Mark as quote-only (uncheck to un-mark)" defaultChecked />
          <button type="submit" disabled={pending} style={button}>
            {pending ? "Applying…" : "Apply"}
          </button>
          {bulkResult && <span style={{ marginLeft: 12, color: "#0a0" }}>{bulkResult}</span>}
        </form>
      </section>
    </>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label style={{ display: "block", margin: "8px 0" }}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} /> {label}
    </label>
  );
}

const card: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  margin: "16px 0",
  background: "#fff",
};
const row: React.CSSProperties = { display: "block", margin: "8px 0" };
const input: React.CSSProperties = {
  display: "block",
  marginTop: 4,
  padding: "6px 8px",
  border: "1px solid #ccc",
  borderRadius: 4,
  minWidth: 280,
};
const button: React.CSSProperties = {
  marginTop: 12,
  padding: "8px 16px",
  border: 0,
  borderRadius: 6,
  background: "#008060",
  color: "#fff",
  cursor: "pointer",
};
