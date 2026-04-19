(function () {
  "use strict";

  var PROXY = "/apps/quote";

  var defaults = {
    quoteOnlyTag: "quote-only",
    ctaAddToQuote: "Add to Quote",
    ctaRequestQuote: "Request Quote",
    hidePriceOnPDP: true,
    hidePriceOnCollection: true,
  };

  function el(tag, props, children) {
    var e = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === "style" && typeof props[k] === "object") Object.assign(e.style, props[k]);
      else if (k === "class") e.className = props[k];
      else if (k === "html") e.innerHTML = props[k];
      else e.setAttribute(k, props[k]);
    });
    (children || []).forEach(function (c) {
      if (c == null) return;
      e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function money(cents) {
    try {
      var fmt = new Intl.NumberFormat(document.documentElement.lang || "en", {
        style: "currency",
        currency: (window.Shopify && Shopify.currency && Shopify.currency.active) || "USD",
      });
      return fmt.format(cents / 100);
    } catch (_) {
      return "$" + (cents / 100).toFixed(2);
    }
  }

  function getSettings() {
    return fetch(PROXY + "/config", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.settings) ? Object.assign({}, defaults, j.settings) : defaults; })
      .catch(function () { return defaults; });
  }

  function getCart() {
    return fetch("/cart.js", { credentials: "same-origin" }).then(function (r) { return r.json(); });
  }

  function removeLinesFromCart(keys) {
    var ops = keys.map(function (key) {
      return fetch("/cart/change.js", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ id: key, quantity: 0 }),
      }).catch(function () {});
    });
    return Promise.all(ops);
  }

  function isProductPage() { return /^\/products\//.test(location.pathname); }
  function isCartPage() { return /^\/cart($|\/)/.test(location.pathname); }
  function isRequestQuotePage() { return /^\/pages\/request-quote/.test(location.pathname); }

  function runPDP(settings) {
    var productJson = document.querySelector('script[type="application/json"][data-product-json], #ProductJson-main-product, [id^="ProductJson-"]');
    var product = null;
    if (productJson) {
      try { product = JSON.parse(productJson.textContent || "{}"); } catch (_) {}
    }
    if (!product && window.ShopifyAnalytics && ShopifyAnalytics.meta && ShopifyAnalytics.meta.product) {
      product = ShopifyAnalytics.meta.product;
    }
    var handle = (location.pathname.match(/\/products\/([^/?#]+)/) || [])[1];
    var url = "/products/" + handle + ".js";
    fetch(url, { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (p) {
        if (!p) return;
        var tags = (p.tags || "").toString().split(",").map(function (s) { return s.trim(); });
        var isQuoteOnly = tags.indexOf(settings.quoteOnlyTag) !== -1;
        if (!isQuoteOnly) return;

        if (settings.hidePriceOnPDP) {
          var style = document.createElement("style");
          style.textContent = ".price, .product__price, [data-product-price] { display: none !important; }";
          document.head.appendChild(style);
        }

        var hideDyn = document.createElement("style");
        hideDyn.textContent = [
          ".shopify-payment-button",
          "button[name=\"checkout\"]",
          ".product-form__payment-container",
          "[data-shopify=\"payment-button\"]",
          ".dynamic-checkout",
        ].join(",") + " { display: none !important; }";
        document.head.appendChild(hideDyn);

        var btns = Array.from(document.querySelectorAll(".product-form__submit, button[name=\"add\"], [data-add-to-cart]"));
        var seen = new Set();
        btns.forEach(function (btn) {
          if (seen.has(btn)) return;
          seen.add(btn);
          var textSpan = btn.querySelector('span:not([class*="icon"]):not([hidden])');
          if (textSpan && textSpan.childNodes.length) textSpan.textContent = settings.ctaAddToQuote;
          else {
            var replaced = false;
            for (var i = 0; i < btn.childNodes.length; i++) {
              var n = btn.childNodes[i];
              if (n.nodeType === 3 && n.textContent.trim().length > 0) {
                n.textContent = settings.ctaAddToQuote;
                replaced = true;
                break;
              }
            }
            if (!replaced) btn.textContent = settings.ctaAddToQuote;
          }
          btn.setAttribute("data-qr-relabeled", "true");
        });
      });
  }

  function loadItemTags(items) {
    return Promise.all(items.map(function (it) {
      if (it.product_tags) return Promise.resolve(it);
      if (!it.handle) return Promise.resolve(it);
      return fetch("/products/" + it.handle + ".js", { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (p) {
          if (p && p.tags) it.product_tags = Array.isArray(p.tags) ? p.tags : String(p.tags).split(",").map(function (s) { return s.trim(); });
          return it;
        })
        .catch(function () { return it; });
    }));
  }

  function filterQuoteItems(items, settings) {
    return items.filter(function (i) {
      var rawTags = i.product_tags || [];
      var tags = Array.isArray(rawTags) ? rawTags : String(rawTags).split(",").map(function (s) { return s.trim(); });
      return tags.indexOf(settings.quoteOnlyTag) !== -1;
    });
  }

  function renderCartSection(settings, cart) {
    var items = cart.items || [];
    var quoteItems = filterQuoteItems(items, settings);
    var sellableCount = items.length - quoteItems.length;

    // Remove any previous injection
    var prev = document.getElementById("qr-cart-section");
    if (prev) prev.remove();

    if (quoteItems.length === 0) return;

    // Build section
    var list = el("ul", { class: "qr-cart-section__list" },
      quoteItems.map(function (li) {
        return el("li", { class: "qr-cart-item", "data-qr-line-id": li.key }, [
          li.image ? el("img", { class: "qr-cart-item__img", src: li.image, alt: li.product_title, width: 60, height: 60, loading: "lazy" }) : el("div", { class: "qr-cart-item__img qr-cart-item__img--placeholder" }),
          el("div", { class: "qr-cart-item__main" }, [
            el("div", { class: "qr-cart-item__title" }, [li.product_title]),
            li.variant_title && li.variant_title !== "Default Title" ? el("div", { class: "qr-cart-item__variant" }, [li.variant_title]) : null,
            el("div", { class: "qr-cart-item__qty" }, ["Qty " + li.quantity]),
          ]),
        ]);
      })
    );
    var cta = el("a", { class: "qr-btn qr-btn--primary", href: "/pages/request-quote" }, [settings.ctaRequestQuote]);

    var section = el("section", { id: "qr-cart-section", class: "qr-cart-section" }, [
      el("header", { class: "qr-cart-section__header" }, [
        el("h2", { class: "qr-cart-section__title" }, ["Quote required"]),
        el("p", { class: "qr-cart-section__desc" }, ["These items require a custom quote and cannot be purchased directly."]),
      ]),
      list,
      el("div", { class: "qr-cart-section__cta" }, [cta]),
    ]);

    // Insert before the main cart form, or append to main
    var cartRoot = document.querySelector("form[action*='/cart']") || document.querySelector(".cart") || document.querySelector("main");
    if (cartRoot && cartRoot.parentNode) {
      cartRoot.parentNode.insertBefore(section, cartRoot);
    } else {
      (document.querySelector("main") || document.body).appendChild(section);
    }

    var checkoutSelectors = [
      '[name="checkout"]',
      'button[type="submit"][name="checkout"]',
      '.cart__checkout-button',
      '.cart__ctas button[type="submit"]',
    ];
    var selectorsJoined = checkoutSelectors.join(",");

    if (sellableCount === 0) {
      var s = document.createElement("style");
      s.textContent = selectorsJoined + " { display: none !important; }";
      document.head.appendChild(s);
    } else {
      var quoteOnlyKeys = quoteItems.map(function (i) { return i.key; });
      document.addEventListener("click", function (e) {
        var btn = e.target.closest(selectorsJoined);
        if (!btn) return;
        if (btn.getAttribute("data-qr-wrapped") === "true") return;
        e.preventDefault();
        e.stopPropagation();
        btn.setAttribute("data-qr-wrapped", "true");
        if ("disabled" in btn) btn.disabled = true;
        removeLinesFromCart(quoteOnlyKeys).then(function () {
          window.location = "/checkout";
        });
      }, true);
    }
  }

  var cartRendered = false;
  function runCart(settings) {
    if (cartRendered) return;
    cartRendered = true;
    getCart().then(function (cart) {
      return loadItemTags(cart.items || []).then(function (hydrated) {
        cart.items = hydrated;
        renderCartSection(settings, cart);
      });
    });
  }

  function runRequestQuotePage(settings) {
    // Inject form + summary into the /pages/request-quote page content
    var host = document.querySelector(".shopify-page .rte, .page-content, main .page, main article, main") || document.body;

    // Only inject once
    if (document.getElementById("qr-request-root")) return;

    var root = el("div", { id: "qr-request-root", class: "qr-request-page" });

    var header = el("header", { class: "qr-request-page__header" }, [
      el("h1", null, ["Request a Quote"]),
      el("p", { class: "qr-intro" }, ["Tell us about your project and we'll get back with a tailored estimate."]),
    ]);

    var summaryAside = el("aside", { class: "qr-summary" }, [
      el("h2", null, ["Items in your quote"]),
      el("ul", { class: "qr-summary__list", id: "qr-summary-list" }, []),
      el("p", { class: "qr-empty", id: "qr-summary-empty", style: { display: "none" } }, ["Your quote is empty — browse the shop to add items, then come back here."]),
    ]);

    function field(label, name, type, required, placeholder) {
      var input;
      if (type === "textarea") {
        input = el("textarea", { name: name, rows: 4, placeholder: placeholder || "" });
      } else if (type === "file") {
        input = el("input", { type: "file", name: name, accept: ".pdf,image/*" });
      } else {
        input = el("input", { type: type || "text", name: name, placeholder: placeholder || "" });
      }
      if (required) input.setAttribute("required", "required");
      return el("label", null, [el("span", { class: "qr-label" }, [label + (required ? " *" : "")]), input]);
    }

    var form = el("form", { class: "qr-form", novalidate: "novalidate" }, [
      field("Name", "contact_name", "text", true),
      field("Email", "contact_email", "email", true),
      field("Phone", "contact_phone", "tel", false),
      field("Project address", "project_address", "textarea", false),
      field("Timeline", "timeline", "text", false, "e.g. next 3 months"),
      field("Budget range (optional)", "budget_range", "text", false),
      field("Project details", "notes", "textarea", false, "Rooms, zones, existing systems, integrations, etc."),
      field("Floor plan (optional, max 10 MB)", "floor_plan", "file", false),
      el("input", { type: "text", name: "honeypot", tabindex: "-1", autocomplete: "off", "aria-hidden": "true", style: { position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: "0" } }),
      el("button", { type: "submit", class: "qr-btn qr-btn--primary" }, ["Submit Quote Request"]),
      el("p", { class: "qr-status", "data-qr-status": "" }, []),
    ]);

    var layout = el("div", { class: "qr-layout" }, [summaryAside, form]);
    root.appendChild(header);
    root.appendChild(layout);

    // Inject styles
    if (!document.getElementById("qr-storefront-styles")) {
      var link = el("link", { id: "qr-storefront-styles", rel: "stylesheet", href: "https://smartspaces-quote.vercel.app/storefront.css" });
      document.head.appendChild(link);
    }

    host.innerHTML = "";
    host.appendChild(root);

    function refreshSummary() {
      getCart().then(function (cart) {
        return loadItemTags(cart.items || []).then(function (hyd) {
          var qs = filterQuoteItems(hyd, settings);
          var list = document.getElementById("qr-summary-list");
          var empty = document.getElementById("qr-summary-empty");
          list.innerHTML = "";
          if (qs.length === 0) { empty.style.display = ""; return; }
          empty.style.display = "none";
          qs.forEach(function (li) {
            var row = el("li", { class: "qr-summary-item", "data-qr-line-id": li.key }, [
              li.image ? el("img", { class: "qr-summary-item__img", src: li.image, alt: li.product_title, width: 48, height: 48 }) : el("div", { class: "qr-summary-item__img qr-summary-item__img--placeholder" }),
              el("div", { class: "qr-summary-item__main" }, [
                el("div", { class: "qr-summary-item__title" }, [li.product_title]),
                li.variant_title && li.variant_title !== "Default Title" ? el("div", { class: "qr-summary-item__variant" }, [li.variant_title]) : null,
                el("div", { class: "qr-summary-item__qty" }, ["Qty " + li.quantity]),
              ]),
            ]);
            list.appendChild(row);
          });
        });
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var status = form.querySelector("[data-qr-status]");
      status.setAttribute("data-kind", "pending");
      status.textContent = "Sending…";

      getCart().then(function (cart) {
        return loadItemTags(cart.items || []).then(function (hyd) {
          return filterQuoteItems(hyd, settings);
        });
      }).then(function (quoteItems) {
        if (quoteItems.length === 0) {
          status.setAttribute("data-kind", "error");
          status.textContent = "Your quote is empty.";
          return;
        }
        var fd = new FormData(form);
        var payload = {
          contact_name: String(fd.get("contact_name") || ""),
          contact_email: String(fd.get("contact_email") || ""),
          contact_phone: String(fd.get("contact_phone") || ""),
          project_address: String(fd.get("project_address") || ""),
          timeline: String(fd.get("timeline") || ""),
          budget_range: String(fd.get("budget_range") || ""),
          notes: String(fd.get("notes") || ""),
          honeypot: String(fd.get("honeypot") || ""),
          line_items: quoteItems.map(function (i) {
            return {
              variant_id: i.variant_id,
              product_id: i.product_id,
              product_title: i.product_title,
              quantity: i.quantity,
              key: i.key,
              variant_title: i.variant_title,
              image: i.image,
              line_price: i.line_price,
            };
          }),
        };
        var body = new FormData();
        body.append("payload", JSON.stringify(payload));
        var fp = fd.get("floor_plan");
        if (fp instanceof File && fp.size > 0) body.append("floor_plan", fp);
        fetch(PROXY + "/submit", { method: "POST", body: body, credentials: "same-origin" })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, json: j }; }); })
          .then(function (res) {
            if (!res.ok) throw new Error(res.json.error || "Network error");
            return removeLinesFromCart(quoteItems.map(function (i) { return i.key; })).then(function () {
              status.setAttribute("data-kind", "success");
              status.innerHTML = "Thanks — we\u2019ll be in touch. <a href=\"/collections/all\">Continue shopping</a> or <a href=\"/cart\">return to your cart</a>.";
              form.reset();
            });
          })
          .catch(function (err) {
            status.setAttribute("data-kind", "error");
            status.textContent = err.message || "Something went wrong.";
          });
      });
    });

    refreshSummary();
  }

  function boot() {
    getSettings().then(function (settings) {
      if (isProductPage()) runPDP(settings);
      if (isCartPage()) runCart(settings);
      if (isRequestQuotePage()) runRequestQuotePage(settings);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
