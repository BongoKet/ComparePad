(function () {
  "use strict";

  // ── DOM refs ──
  const addTabBtn      = document.getElementById("add-tab-btn");
  const addWindowBtn   = document.getElementById("add-window-btn");
  const productsList   = document.getElementById("products-list");
  const emptyState     = document.getElementById("empty-state");
  const compareSection = document.getElementById("compare-section");
  const compareBtn     = document.getElementById("compare-btn");
  const loading        = document.getElementById("loading");
  const resultsContainer = document.getElementById("results-container");
  const resultsBody    = document.getElementById("results-body");
  const resultsClear   = document.getElementById("results-clear");
  const chatSection    = document.getElementById("chat-section");
  const chatMessages   = document.getElementById("chat-messages");
  const chatInputBar   = document.getElementById("chat-input-bar");
  const chatInput      = document.getElementById("chat-input");
  const chatSend       = document.getElementById("chat-send");
  const settingsBtn    = document.getElementById("settings-btn");
  const settingsOverlay = document.getElementById("settings-overlay");
  const settingsClose  = document.getElementById("settings-close");
  const apiKeyInput    = document.getElementById("api-key-input");
  const saveKeyBtn     = document.getElementById("save-key-btn");
  const keyStatus      = document.getElementById("key-status");
  const toast          = document.getElementById("toast");

  // ── Proxy config ──
  const API_BASE = location.hostname === "localhost"
    ? "http://localhost:8787"
    : "https://comparepad-api.YOUR_SUBDOMAIN.workers.dev";

  let products = [];
  let apiKey = "";

  // Multi-turn conversation state
  let chatHistory = [];   // Gemini contents array: [{ role, parts }]

  if (typeof marked !== "undefined") {
    marked.setOptions({ breaks: true, gfm: true });
  }

  // ══════════════════════════════════════════
  //  STORAGE
  // ══════════════════════════════════════════

  async function loadProducts() {
    try {
      const r = await browser.storage.local.get("comparepad_products");
      products = r.comparepad_products || [];
    } catch { products = []; }
    render();
  }

  async function saveProducts() {
    await browser.storage.local.set({ comparepad_products: products });
  }

  async function loadKey() {
    try {
      const r = await browser.storage.local.get("comparepad_gemini_key");
      apiKey = r.comparepad_gemini_key || "";
      apiKeyInput.value = apiKey;
    } catch { apiKey = ""; }
  }

  async function saveKey() {
    apiKey = apiKeyInput.value.trim();
    await browser.storage.local.set({ comparepad_gemini_key: apiKey });
    showKeyStatus("Saved", "success");
  }

  function showKeyStatus(msg, type) {
    keyStatus.textContent = msg;
    keyStatus.className = type;
    keyStatus.classList.remove("hidden");
    setTimeout(() => keyStatus.classList.add("hidden"), 2000);
  }

  // ══════════════════════════════════════════
  //  RENDERING
  // ══════════════════════════════════════════

  function render() {
    productsList.innerHTML = "";

    if (products.length === 0) {
      emptyState.classList.remove("hidden");
      compareSection.classList.add("hidden");
      return;
    }

    emptyState.classList.add("hidden");
    compareSection.classList.toggle("hidden", products.length < 2);

    products.forEach((p) => {
      productsList.appendChild(buildCard(p));
    });
  }

  function buildCard(product) {
    const card = document.createElement("div");
    card.className = "product-card";

    const icon = document.createElement("div");
    icon.className = "product-card__icon";
    if (product.image) {
      const img = document.createElement("img");
      img.src = product.image;
      img.alt = product.title || "";
      img.loading = "lazy";
      img.onerror = () => { img.replaceWith(placeholderSvg()); };
      icon.appendChild(img);
    } else {
      icon.appendChild(placeholderSvg());
    }

    const info = document.createElement("div");
    info.className = "product-card__info";

    const name = document.createElement("div");
    name.className = "product-card__name";
    name.textContent = product.title || "Unknown Product";
    name.title = product.title || "";
    info.appendChild(name);

    if (product.price) {
      const price = document.createElement("div");
      price.className = "product-card__price";
      price.textContent = product.price;
      info.appendChild(price);
    }

    const removeBtn = document.createElement("button");
    removeBtn.className = "product-card__remove";
    removeBtn.title = "Remove";
    removeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    removeBtn.addEventListener("click", () => {
      products = products.filter((p) => p.id !== product.id);
      saveProducts();
      render();
    });

    card.appendChild(icon);
    card.appendChild(info);
    card.appendChild(removeBtn);
    return card;
  }

  function placeholderSvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.5");
    svg.innerHTML = `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>`;
    return svg;
  }

  // ══════════════════════════════════════════
  //  ADD FROM TAB / WINDOW
  // ══════════════════════════════════════════

  async function scrapeTab(tab) {
    try {
      const data = await browser.tabs.sendMessage(tab.id, { type: "comparepad-scrape" });
      if (!data || !data.title) return null;

      return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: data.title,
        price: data.price || null,
        image: data.image || null,
        specs: data.specs || null,
        description: data.description || null,
        url: data.url || tab.url,
      };
    } catch {
      return null;
    }
  }

  function isDuplicate(url) {
    return products.some((p) => p.url === url);
  }

  addTabBtn.addEventListener("click", async () => {
    addTabBtn.disabled = true;
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) { showToast("No active tab found", "error"); return; }
      if (isDuplicate(tab.url)) { showToast("Already added", "error"); return; }

      const product = await scrapeTab(tab);
      if (product) {
        products.push(product);
        await saveProducts();
        render();
        showToast("Added: " + truncate(product.title, 40), "success");
      } else {
        showToast("Could not extract product data from this page", "error");
      }
    } catch (e) {
      showToast("Error: " + e.message, "error");
    } finally {
      addTabBtn.disabled = false;
    }
  });

  addWindowBtn.addEventListener("click", async () => {
    addWindowBtn.disabled = true;
    try {
      const tabs = await browser.tabs.query({ currentWindow: true });
      let added = 0;

      for (const tab of tabs) {
        if (!tab.url || tab.url.startsWith("about:") || tab.url.startsWith("moz-extension:")) continue;
        if (isDuplicate(tab.url)) continue;

        const product = await scrapeTab(tab);
        if (product) {
          products.push(product);
          added++;
        }
      }

      if (added > 0) {
        await saveProducts();
        render();
        showToast(`Added ${added} product${added > 1 ? "s" : ""}`, "success");
      } else {
        showToast("No new products found in open tabs", "error");
      }
    } catch (e) {
      showToast("Error: " + e.message, "error");
    } finally {
      addWindowBtn.disabled = false;
    }
  });

  // ══════════════════════════════════════════
  //  AI — SYSTEM PROMPT
  // ══════════════════════════════════════════

  const SYSTEM_PROMPT =
    `You are an expert, concise shopping assistant. ` +
    `Analyze the provided product data and output your response EXACTLY in this Markdown structure:\n\n` +
    `**The Verdict:** [1-2 sentences stating clearly which product is the best overall buy and why].\n\n` +
    `**Feature Comparison:**\n` +
    `[Create a Markdown table. The columns should be the products. ` +
    `The rows should be the 4 to 5 most important, category-specific specifications ` +
    `(e.g., Battery Life, Weight, Processor). Do not include unnecessary rows.]\n\n` +
    `**Pros & Cons:**\n` +
    `* **[Product 1 Name]:** [1 Pro, 1 Con]\n` +
    `* **[Product 2 Name]:** [1 Pro, 1 Con]\n\n` +
    `Do not add any conversational filler before or after this structure. Keep it highly scannable.\n\n` +
    `IMPORTANT: Complete your entire response. Do not stop mid-sentence. ` +
    `If the comparison is long, continue until the 'Pros & Cons' section is finished. ` +
    `If you run out of space, prioritize the comparison table and the final verdict.\n\n` +
    `After providing the initial Verdict, Table, and Pros/Cons, you must transition into a consultative assistant. ` +
    `End your very first message by asking 1 or 2 specific, highly relevant follow-up questions to help the user narrow down their choice. ` +
    `For example: 'What resolution is your monitor?' or 'Are you prioritizing battery life or screen size?' ` +
    `For all subsequent messages in the chat, respond conversationally and concisely based on the user's answers, keeping the original products in context.\n\n` +
    `After the Pros & Cons section, add a '**Where to Buy:**' section. ` +
    `For each product, output a Markdown link in this exact format:\n` +
    `[Search for PRODUCT_NAME on Google Shopping](https://www.google.com/search?tbm=shop&q=URL_ENCODED_PRODUCT_NAME)\n` +
    `Use the product's name, URL-encoded, as the query parameter. Only include this section in the initial comparison, not in follow-up chat messages.`;

  function buildUserPrompt() {
    const blocks = products.map((p, i) => {
      let block = `Product ${i + 1}: ${p.title}`;
      if (p.price) block += `\nPrice: ${p.price}`;
      if (p.url) block += `\nURL: ${p.url}`;
      if (p.specs) block += `\n\nSpecifications:\n${p.specs}`;
      if (p.description) block += `\n\nDescription:\n${p.description}`;
      return block;
    });
    return "Compare these products:\n\n" + blocks.join("\n\n---\n\n");
  }

  // ══════════════════════════════════════════
  //  API — Proxy-routed requests
  // ══════════════════════════════════════════

  async function proxyRequest(contents) {
    const resp = await fetch(`${API_BASE}/api/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemPrompt: SYSTEM_PROMPT,
        userApiKey: apiKey || null,
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      throw new Error(data.error || `Server error: HTTP ${resp.status}`);
    }

    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts || parts.length === 0) throw new Error("Empty response from server.");
    return parts.map((p) => p.text || "").join("\n\n");
  }

  async function sendMessage(userText) {
    chatHistory.push({ role: "user", parts: [{ text: userText }] });

    try {
      const reply = await proxyRequest(chatHistory);
      chatHistory.push({ role: "model", parts: [{ text: reply }] });
      return reply;
    } catch (e) {
      chatHistory.pop();
      throw e;
    }
  }

  // ══════════════════════════════════════════
  //  INITIAL COMPARISON
  // ══════════════════════════════════════════

  compareBtn.addEventListener("click", async () => {
    if (products.length < 2) return;

    compareBtn.disabled = true;
    resultsContainer.classList.add("hidden");
    chatSection.classList.add("hidden");
    chatInputBar.classList.add("hidden");
    chatMessages.innerHTML = "";
    loading.classList.remove("hidden");

    chatHistory = [];

    try {
      const text = await sendMessage(buildUserPrompt());
      resultsBody.innerHTML = renderMarkdown(text);
      resultsContainer.classList.remove("hidden");

      chatSection.classList.remove("hidden");
      chatInputBar.classList.remove("hidden");
      chatInput.focus();
    } catch (e) {
      resultsBody.innerHTML = `<div class="results-error">${escHtml(e.message)}</div>`;
      resultsContainer.classList.remove("hidden");
    } finally {
      loading.classList.add("hidden");
      compareBtn.disabled = false;
    }
  });

  resultsClear.addEventListener("click", () => {
    resultsContainer.classList.add("hidden");
    chatSection.classList.add("hidden");
    chatInputBar.classList.add("hidden");
    chatMessages.innerHTML = "";
    resultsBody.innerHTML = "";
    chatHistory = [];
  });

  // ══════════════════════════════════════════
  //  CHAT UI
  // ══════════════════════════════════════════

  function appendBubble(text, role) {
    const bubble = document.createElement("div");
    bubble.className = role === "user" ? "chat-bubble chat-bubble--user" : "chat-bubble chat-bubble--ai";
    bubble.innerHTML = role === "user" ? escHtml(text) : renderMarkdown(text);
    chatMessages.appendChild(bubble);
    scrollChatToBottom();
    return bubble;
  }

  function appendThinking() {
    const el = document.createElement("div");
    el.className = "chat-thinking";
    el.id = "chat-thinking";
    el.innerHTML = `<div class="thinking-dots"><span></span><span></span><span></span></div><span class="thinking-label">Thinking...</span>`;
    chatMessages.appendChild(el);
    scrollChatToBottom();
    return el;
  }

  function removeThinking() {
    const el = document.getElementById("chat-thinking");
    if (el) el.remove();
  }

  function scrollChatToBottom() {
    requestAnimationFrame(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
  }

  async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || chatHistory.length === 0) return;

    chatInput.value = "";
    chatSend.disabled = true;
    chatInput.disabled = true;

    appendBubble(text, "user");
    const thinking = appendThinking();

    try {
      const reply = await sendMessage(text);
      removeThinking();
      appendBubble(reply, "ai");
    } catch (e) {
      removeThinking();
      appendBubble("Error: " + e.message, "ai");
    } finally {
      chatSend.disabled = false;
      chatInput.disabled = false;
      chatInput.focus();
    }
  }

  chatSend.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // ══════════════════════════════════════════
  //  MARKDOWN RENDERING
  // ══════════════════════════════════════════

  function renderMarkdown(md) {
    if (typeof marked !== "undefined") {
      return marked.parse(md);
    }
    return fallbackMarkdown(md);
  }

  function fallbackMarkdown(md) {
    let html = escHtml(md);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\n{2,}/g, "</p><p>");
    return "<p>" + html + "</p>";
  }

  // ══════════════════════════════════════════
  //  SETTINGS MODAL
  // ══════════════════════════════════════════

  settingsBtn.addEventListener("click", () => {
    settingsOverlay.classList.remove("hidden");
    apiKeyInput.focus();
  });

  settingsClose.addEventListener("click", () => {
    settingsOverlay.classList.add("hidden");
  });

  settingsOverlay.addEventListener("click", (e) => {
    if (e.target === settingsOverlay) settingsOverlay.classList.add("hidden");
  });

  saveKeyBtn.addEventListener("click", () => {
    saveKey();
  });

  // ══════════════════════════════════════════
  //  TOAST
  // ══════════════════════════════════════════

  let toastTimer = null;

  function showToast(msg, type) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = type === "error" ? "toast-error" : "toast-success";
    toast.classList.remove("hidden");
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
  }

  // ══════════════════════════════════════════
  //  UTILS
  // ══════════════════════════════════════════

  function escHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + "..." : str;
  }

  // ══════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════

  loadKey();
  loadProducts();
})();
