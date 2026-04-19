import { getOfflineContext, adminGraphQL } from "@/lib/shopify";
import SettingsForm from "./SettingsForm";
import { saveSettings, bulkToggleQuoteOnly, type QuoteSettings } from "./actions";

const SETTINGS_QUERY = /* GraphQL */ `
  query ShopSettings {
    shop {
      id
      metafield(namespace: "quote", key: "settings") { value }
    }
  }
`;

async function loadSettings(): Promise<QuoteSettings> {
  const ctx = getOfflineContext();
  const data = await adminGraphQL<{ shop: { id: string; metafield: { value: string } | null } }>(
    ctx,
    SETTINGS_QUERY,
  );
  const raw = data.shop.metafield?.value;
  if (raw) {
    try { return JSON.parse(raw) as QuoteSettings; } catch { /* fallthrough */ }
  }
  return {
    merchantNotificationEmail: "",
    defaultQuoteExpiryDays: 14,
    collectPhone: true,
    collectProjectAddress: true,
    collectTimeline: true,
    collectBudgetRange: false,
    collectFloorPlan: true,
  };
}

export default async function AdminPage() {
  const settings = await loadSettings();
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <h1>Quote settings</h1>
      <p style={{ color: "#555" }}>
        Configure the quote-request form and mark products as quote-only.
        Quote submissions appear in Shopify Admin → Orders → Drafts, filtered by the tag <code>quote-request</code>.
      </p>
      <SettingsForm
        initial={settings}
        saveAction={saveSettings}
        bulkToggleAction={bulkToggleQuoteOnly}
      />
    </div>
  );
}
