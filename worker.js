const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>ComparePad API</title><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;align-items:center;justify-content:center;min-height:100vh}
.container{text-align:center;max-width:420px;padding:40px 24px}
h1{font-size:28px;font-weight:700;margin-bottom:8px}
.badge{display:inline-block;padding:3px 10px;background:#1a3a2a;color:#4ade80;border-radius:12px;font-size:12px;font-weight:600;margin-bottom:20px}
p{color:#888;font-size:15px;line-height:1.6}
</style></head><body><div class="container"><h1>ComparePad</h1>
<span class="badge">API Online</span>
<p>This is the backend API for the ComparePad browser extension. Install the extension in Firefox to get started.</p>
</div></body></html>`;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/compare") {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      if (request.method === "GET") {
        const hasKey = !!(env.GEMINI_API_KEY);
        return jsonResponse({ status: "ok", model: GEMINI_MODEL, hasServerKey: hasKey });
      }

      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      const { contents, systemPrompt, userApiKey } = body;

      if (!contents || !Array.isArray(contents) || contents.length === 0) {
        return jsonResponse({ error: "Missing or empty 'contents' array" }, 400);
      }

      const apiKey = userApiKey || env.GEMINI_API_KEY;
      if (!apiKey) {
        return jsonResponse({ error: "No API key available. Please provide your own key in Settings." }, 500);
      }

      const geminiBody = {
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
      };

      if (systemPrompt) {
        geminiBody.system_instruction = { parts: [{ text: systemPrompt }] };
      }

      try {
        const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiBody),
        });

        const data = await resp.json();

        if (!resp.ok) {
          const msg = data.error?.message || `Gemini API error: HTTP ${resp.status}`;
          return jsonResponse({ error: msg }, resp.status);
        }

        return jsonResponse(data);
      } catch (e) {
        return jsonResponse({ error: "Failed to reach Gemini API: " + e.message }, 502);
      }
    }

    return new Response(LANDING_HTML, {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  },
};
