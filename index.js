/**
 * Worker with static assets.
 *
 * Static files in ./public are served automatically. Anything that doesn't
 * match a file falls through to this script, which handles /api/*:
 *
 *   POST /api/indication                 -> POST {UPSTREAM}/indication
 *   GET  /api/{applicationId}/indication -> GET  {UPSTREAM}/{applicationId}/indication
 *
 * The page and the API share a domain, so there is no CORS involved.
 */

const API_KEY = "TESTCoverBadger:4bbba37a-66a2-4c09-8cb6-8e1ec5461185";

const UPSTREAM = "https://api.prod.nirvanatech.com/nirvana/v0/application";

// Only these shapes get forwarded, so this can't be used as a general tunnel.
const ROUTES = [
  { method: "POST", pattern: /^\/indication$/ },
  { method: "GET", pattern: /^\/[0-9a-fA-F-]{36}\/indication$/ },
];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Not an API call: hand it back to the static asset server.
    if (!url.pathname.startsWith("/api")) {
      return env.ASSETS.fetch(request);
    }

    const path = url.pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";

    const route = ROUTES.find(
      (r) => r.method === request.method && r.pattern.test(path)
    );
    if (!route) {
      return json({ error: "Unknown route", method: request.method, path }, 404);
    }

    const headers = {
      Accept: "application/json",
      "X-API-KEY": API_KEY,
    };
    if (request.method === "POST") headers["Content-Type"] = "application/json";

    let upstream;
    try {
      upstream = await fetch(UPSTREAM + path, {
        method: request.method,
        headers,
        body: request.method === "POST" ? await request.text() : undefined,
      });
    } catch (err) {
      return json({ error: "Upstream request failed", detail: String(err) }, 502);
    }

    // Pass the real status and body straight back to the page.
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  },
};
