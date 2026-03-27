(function () {
  "use strict";

  // ────────────────────────────────────────────
  //  UNIVERSAL DOM SCRAPER
  //  Responds to "comparepad-scrape" messages
  //  from the sidebar / background script.
  // ────────────────────────────────────────────

  const PRICE_SELECTORS = [
    '[itemprop="price"]',
    '[data-testid="price"]',
    '[data-price]',
    ".price--main", ".price-current", ".price__current",
    ".product-price", ".product__price", ".pdp-price",
    ".price-value", ".priceView-hero-price span",
    ".a-price .a-offscreen",
    ".sale-price", ".offer-price", ".now-price",
    "#priceblock_ourprice", "#priceblock_dealprice",
    ".price", "[class*='Price']", "[class*='price']",
  ];

  const SPEC_SELECTORS = [
    '[itemprop="additionalProperty"]',
    "#productDetails_techSpec_section_1",
    "#technicalSpecifications_section_1",
    "#specifications", "#tech-specs", "#Specifications",
    ".specifications", ".product-specs", ".product-specifications",
    ".tech-specs", ".spec-table", ".specs-table",
    ".product__specs", ".product-attributes",
    '[class*="Specifications"]', '[class*="specifications"]',
    '[class*="techSpec"]', '[data-testid*="spec"]',
    "table.a-keyvalue",
    ".product-details", ".product-detail",
    "#product-details", "#product-detail",
  ];

  const DESC_SELECTORS = [
    '[itemprop="description"]',
    '[data-testid="product-description"]',
    "#productDescription", "#feature-bullets", "#product-description",
    ".product-description", ".product__description", ".pdp-description",
    ".product-info-description", ".description-content",
    ".item-description", ".listing-description",
    '[class*="ProductDescription"]', '[class*="product-description"]',
  ];

  function scrape() {
    const result = {
      title: null,
      price: null,
      image: null,
      specs: null,
      description: null,
      url: window.location.href,
    };

    // ── Title: try structured data first, then <h1> ──
    const jsonLdTitle = getJsonLdField("name");
    const ogTitle = getMeta("og:title");
    const h1 = document.querySelector("h1");

    result.title =
      jsonLdTitle ||
      ogTitle ||
      (h1 ? h1.innerText.trim() : null) ||
      document.title;

    // ── Price ──
    const jsonLdPrice = getJsonLdPrice();
    if (jsonLdPrice) {
      result.price = jsonLdPrice;
    } else {
      result.price = findPriceInDOM();
    }

    // ── Image ──
    const jsonLdImage = getJsonLdField("image");
    const ogImage = getMeta("og:image");
    result.image = jsonLdImage || ogImage || findHeroImage();

    // ── Specs ──
    result.specs = extractSpecs();

    // ── Description ──
    result.description = extractDescription();

    return result;
  }

  // ── JSON-LD helpers ──

  function getJsonLdData() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        let d = JSON.parse(s.textContent);
        if (Array.isArray(d)) d = d[0];
        if (d["@graph"]) {
          d = d["@graph"].find(
            (n) => n["@type"] === "Product" || n["@type"]?.includes?.("Product")
          ) || d["@graph"][0];
        }
        if (d["@type"] === "Product" || d["@type"]?.includes?.("Product")) return d;
      } catch { /* skip */ }
    }
    return null;
  }

  function getJsonLdField(field) {
    const d = getJsonLdData();
    if (!d) return null;
    if (field === "image") {
      const img = d.image;
      if (Array.isArray(img)) return img[0];
      if (typeof img === "object") return img.url || img.contentUrl;
      return img || null;
    }
    return d[field] || null;
  }

  function getJsonLdPrice() {
    const d = getJsonLdData();
    if (!d) return null;
    const offers = Array.isArray(d.offers) ? d.offers[0] : d.offers;
    if (!offers) return null;
    const amount = offers.price ?? offers.lowPrice ?? offers.highPrice;
    if (amount == null) return null;
    const currency = offers.priceCurrency || "USD";
    const sym = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CAD: "CA$", AUD: "A$" };
    return (sym[currency] || currency + " ") + parseFloat(amount).toFixed(2);
  }

  function getMeta(prop) {
    const el = document.querySelector(
      `meta[property="${prop}"], meta[name="${prop}"]`
    );
    return el ? el.content : null;
  }

  // ── DOM price finder ──

  function findPriceInDOM() {
    for (const sel of PRICE_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) {
        const txt = (el.getAttribute("content") || el.innerText || "").trim();
        const match = txt.match(/[\$£€¥]\s*[\d,]+\.?\d*/);
        if (match) return match[0].replace(/\s/g, "");
      }
    }

    const walker = document.createTreeWalker(
      document.body, NodeFilter.SHOW_TEXT, null
    );
    let node;
    while ((node = walker.nextNode())) {
      const txt = node.textContent.trim();
      if (txt.length > 3 && txt.length < 30) {
        const m = txt.match(/^[\$£€]\s?[\d,]+\.?\d{0,2}$/);
        if (m) return m[0].replace(/\s/g, "");
      }
    }
    return null;
  }

  // ── Hero image finder ──

  function findHeroImage() {
    const imgs = Array.from(document.querySelectorAll("img"))
      .filter((img) => img.naturalWidth >= 200 && img.naturalHeight >= 200)
      .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight));
    return imgs.length > 0 ? imgs[0].src : null;
  }

  // ── Specs extractor ──

  function extractSpecs() {
    for (const sel of SPEC_SELECTORS) {
      const els = document.querySelectorAll(sel);
      if (els.length === 0) continue;
      const text = Array.from(els).map((el) => el.innerText.trim()).join("\n");
      if (text.length > 20) return text.slice(0, 2000);
    }

    const tables = document.querySelectorAll("table");
    for (const table of tables) {
      const text = table.innerText.trim();
      if (text.length > 40 && text.length < 5000) {
        const lower = text.toLowerCase();
        const specKeywords = ["weight", "dimension", "battery", "processor", "display", "resolution", "storage", "memory", "ram", "screen", "camera"];
        if (specKeywords.some((kw) => lower.includes(kw))) {
          return text.slice(0, 2000);
        }
      }
    }
    return null;
  }

  // ── Description extractor ──

  function extractDescription() {
    for (const sel of DESC_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.innerText.trim();
        if (text.length > 30) return text.slice(0, 1500);
      }
    }
    return null;
  }

  // ── Message listener ──

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "comparepad-scrape") {
      return Promise.resolve(scrape());
    }
  });
})();
