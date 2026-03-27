const GEMINI_MODEL = "gemini-1.5-flash-8b";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
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
  },
};
