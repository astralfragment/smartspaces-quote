(function () {
  const STORAGE_KEY = "qr:cart";
  const PROXY_BASE = "/apps/quote";

  // ---------- cart store ----------

  function readLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { items: [], updatedAt: 0 };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return { items: [], updatedAt: 0 };
      return parsed;
    } catch {
      return { items: [], updatedAt: 0 };
    }
  }

  function writeLocal(cart) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch { /* ignore quota errors */ }
  }

  async function syncServer(cart, customerId) {
    if (!customerId) return;
    try {
      await fetch(PROXY_BASE + "/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cart),
        credentials: "same-origin",
      });
    } catch { /* offline ok */ }
  }

  async function pullServer(customerId) {
    if (!customerId) return null;
    try {
      const res = await fetch(PROXY_BASE + "/cart", { credentials: "same-origin" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // Merge two carts by variantId, preferring the newer updatedAt as tiebreaker.
  function mergeCarts(a, b) {
    const byVariant = new Map();
    for (const item of a.items) byVariant.set(item.variantId, { ...item });
    for (const item of b.items) {
      const prev = byVariant.get(item.variantId);
      if (!prev) byVariant.set(item.variantId, { ...item });
      else byVariant.set(item.variantId, { ...prev, qty: Math.max(prev.qty, item.qty), note: prev.note || item.note });
    }
    return {
      items: [...byVariant.values()],
      updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0, Date.now()),
    };
  }

  const store = {
    cart: readLocal(),
    listeners: new Set(),
    customerId: null,
    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    notify() { for (const fn of this.listeners) fn(this.cart); },
    async add(item) {
      const next = { ...this.cart };
      const existing = next.items.find((i) => i.variantId === item.variantId);
      if (existing) existing.qty += item.qty;
      else next.items.push(item);
      next.updatedAt = Date.now();
      this.cart = next;
      writeLocal(next);
      await syncServer(next, this.customerId);
      this.notify();
    },
    async remove(variantId) {
      this.cart = {
        items: this.cart.items.filter((i) => i.variantId !== variantId),
        updatedAt: Date.now(),
      };
      writeLocal(this.cart);
      await syncServer(this.cart, this.customerId);
      this.notify();
    },
    async setQty(variantId, qty) {
      const next = { ...this.cart, items: this.cart.items.map((i) => i.variantId === variantId ? { ...i, qty } : i) };
      next.updatedAt = Date.now();
      this.cart = next;
      writeLocal(next);
      await syncServer(next, this.customerId);
      this.notify();
    },
    async clear() {
      this.cart = { items: [], updatedAt: Date.now() };
      writeLocal(this.cart);
      await syncServer(this.cart, this.customerId);
      this.notify();
    },
    async hydrateFromServer() {
      const server = await pullServer(this.customerId);
      if (server) {
        this.cart = mergeCarts(this.cart, server);
        writeLocal(this.cart);
        await syncServer(this.cart, this.customerId);
        this.notify();
      }
    },
  };

  // ---------- UI: product CTAs ----------

  function wireProductCtas() {
    document.querySelectorAll("[data-qr-product]").forEach((root) => {
      const btn = root.querySelector("[data-qr-add-to-quote]");
      if (!btn) return;
      btn.addEventListener("click", async () => {
        const item = {
          variantId: "gid://shopify/ProductVariant/" + root.dataset.variantId,
          productId: "gid://shopify/Product/" + root.dataset.productId,
          title: root.dataset.productTitle || "",
          image: root.dataset.productImage || "",
          qty: 1,
        };
        await store.add(item);
        openDrawer();
      });
    });
  }

  // ---------- UI: drawer ----------

  function setHidden(el, hidden) {
    if (!el) return;
    el.setAttribute("aria-hidden", hidden ? "true" : "false");
    el.classList.toggle("is-open", !hidden);
  }

  function openDrawer() {
    const panel = document.querySelector("[data-qr-panel]");
    const scrim = document.querySelector("[data-qr-scrim]");
    setHidden(panel, false);
    if (scrim) scrim.classList.add("is-open");
    document.body.classList.add("qr-noscroll");
  }

  function closeDrawer() {
    const panel = document.querySelector("[data-qr-panel]");
    const scrim = document.querySelector("[data-qr-scrim]");
    setHidden(panel, true);
    if (scrim) scrim.classList.remove("is-open");
    document.body.classList.remove("qr-noscroll");
  }

  function renderDrawer() {
    const root = document.querySelector("[data-qr-drawer]");
    if (!root) return;
    const count = store.cart.items.reduce((sum, i) => sum + i.qty, 0);
    const countEl = root.querySelector("[data-qr-count]");
    if (countEl) countEl.textContent = String(count);

    const itemsEl = root.querySelector("[data-qr-items]");
    if (!itemsEl) return;

    if (store.cart.items.length === 0) {
      itemsEl.innerHTML = '<p class="qr-empty">Your quote is empty.</p>';
      return;
    }

    itemsEl.innerHTML = "";
    for (const item of store.cart.items) {
      const row = document.createElement("div");
      row.className = "qr-row";
      row.innerHTML = `
        <img class="qr-row__img" src="${escape(item.image || "")}" alt="" />
        <div class="qr-row__main">
          <div class="qr-row__title">${escape(item.title)}</div>
          <div class="qr-row__qty">
            <button type="button" data-qr-dec>-</button>
            <input type="number" min="1" value="${item.qty}" data-qr-qty />
            <button type="button" data-qr-inc>+</button>
            <button type="button" class="qr-row__remove" data-qr-remove>Remove</button>
          </div>
        </div>`;
      row.querySelector("[data-qr-dec]").addEventListener("click", () =>
        store.setQty(item.variantId, Math.max(1, item.qty - 1)),
      );
      row.querySelector("[data-qr-inc]").addEventListener("click", () =>
        store.setQty(item.variantId, item.qty + 1),
      );
      row.querySelector("[data-qr-qty]").addEventListener("change", (ev) => {
        const v = Math.max(1, parseInt(ev.target.value, 10) || 1);
        store.setQty(item.variantId, v);
      });
      row.querySelector("[data-qr-remove]").addEventListener("click", () => store.remove(item.variantId));
      itemsEl.appendChild(row);
    }
  }

  function wireDrawer() {
    const root = document.querySelector("[data-qr-drawer]");
    if (!root) return;

    const customerId = root.dataset.loggedInCustomerId;
    store.customerId = customerId || null;

    root.querySelector("[data-qr-open-drawer]")?.addEventListener("click", openDrawer);
    root.querySelector("[data-qr-close-drawer]")?.addEventListener("click", closeDrawer);
    root.querySelector("[data-qr-scrim]")?.addEventListener("click", closeDrawer);
    root.querySelector("[data-qr-clear]")?.addEventListener("click", () => store.clear());
    const goto = root.querySelector("[data-qr-goto]");
    if (goto) goto.setAttribute("href", root.dataset.quotePage || "/pages/request-quote");

    store.subscribe(renderDrawer);
    renderDrawer();

    if (store.customerId) store.hydrateFromServer();
  }

  // ---------- UI: request page form ----------

  function renderSummary() {
    const page = document.querySelector("[data-qr-request-page]");
    if (!page) return;
    const ul = page.querySelector("[data-qr-summary-items]");
    const empty = page.querySelector("[data-qr-summary-empty]");
    if (!ul || !empty) return;

    ul.innerHTML = "";
    if (store.cart.items.length === 0) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    for (const item of store.cart.items) {
      const li = document.createElement("li");
      li.className = "qr-summary-item";
      li.innerHTML = `<span>${escape(item.title)}</span><span>× ${item.qty}</span>`;
      ul.appendChild(li);
    }
  }

  function wireForm() {
    const page = document.querySelector("[data-qr-request-page]");
    if (!page) return;
    const form = page.querySelector("[data-qr-form]");
    if (!form) return;

    const statusEl = form.querySelector("[data-qr-status]");
    const submitBtn = form.querySelector("[data-qr-submit]");

    store.subscribe(renderSummary);
    renderSummary();

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if (!store.cart.items.length) {
        setStatus(statusEl, "error", "Your quote is empty.");
        return;
      }

      const fd = new FormData(form);
      const payload = {
        contact_name: String(fd.get("contact_name") || ""),
        contact_email: String(fd.get("contact_email") || ""),
        contact_phone: String(fd.get("contact_phone") || ""),
        project_address: String(fd.get("project_address") || ""),
        timeline: String(fd.get("timeline") || ""),
        budget_range: String(fd.get("budget_range") || ""),
        notes: String(fd.get("notes") || ""),
        honeypot: String(fd.get("honeypot") || ""),
        line_items: store.cart.items.map((i) => ({
          variantId: i.variantId,
          productId: i.productId,
          title: i.title,
          qty: i.qty,
        })),
      };

      const multipart = new FormData();
      multipart.append("payload", JSON.stringify(payload));
      const file = fd.get("floor_plan");
      if (file instanceof File && file.size > 0) multipart.append("floor_plan", file);

      submitBtn.disabled = true;
      setStatus(statusEl, "pending", "Sending…");
      try {
        const res = await fetch(PROXY_BASE + "/submit", {
          method: "POST",
          body: multipart,
          credentials: "same-origin",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setStatus(statusEl, "error", err.error || "Something went wrong. Please try again.");
          submitBtn.disabled = false;
          return;
        }
        await store.clear();
        setStatus(statusEl, "success", "Thanks — we’ve received your request and will be in touch shortly.");
        form.reset();
      } catch {
        setStatus(statusEl, "error", "Network error. Please try again.");
        submitBtn.disabled = false;
      }
    });
  }

  function setStatus(el, kind, text) {
    if (!el) return;
    el.dataset.kind = kind;
    el.textContent = text;
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // ---------- boot ----------

  function boot() {
    wireProductCtas();
    wireDrawer();
    wireForm();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
