/**
 * Letting a Smartcat custom app call this backend.
 *
 * A custom app runs on a Smartcat domain and this API lives on Vercel, so every
 * request is cross-origin and the browser blocks it by default. That is not a
 * security feature we are defeating — it is the browser refusing to let one site
 * read another's data without permission. These headers are that permission.
 *
 * Two things are deliberately narrow:
 *
 * - Only Smartcat regions and localhost are allowed, not "*". An open API on a
 *   public URL is an open API, regardless of who was supposed to use it.
 * - Credentials are not allowed, because the app authenticates with a shared
 *   secret rather than cookies. Nothing here should ride on a browser session.
 */

const ALLOWED = [
  "https://smartcat.ai",
  "https://us.smartcat.ai",
  "https://ea.smartcat.ai",
  "https://smartcat.com",
  "https://us.smartcat.com",
  "https://ea.smartcat.com",
  "http://localhost:3000",
  "http://localhost:5173",   // vite, which is what a custom app runs on locally
];

/** Extra origins for development, comma separated. Never set this in production. */
const extra = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

export function corsHeaders(req) {
  const origin = req?.headers?.get?.("origin") || "";
  const allowed = [...ALLOWED, ...extra];

  // Echo the origin only when we recognise it. An unrecognised origin gets no
  // CORS header at all, and the browser stops the response reaching the page.
  const match = allowed.find((a) => a === origin);
  if (!match) return {};

  return {
    "Access-Control-Allow-Origin": match,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Constellation-Key",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** JSON response with CORS applied. Use this instead of Response.json in API routes. */
export function json(req, body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: { ...(init.headers || {}), ...corsHeaders(req) },
  });
}

/** The browser's pre-flight check before any non-trivial cross-origin request. */
export function preflight(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/**
 * Is this request allowed to touch the API?
 *
 * If CONSTELLATION_KEY is unset the check is skipped, so local development is
 * unaffected. Once it is set — which it should be anywhere reachable from the
 * internet — every request must present it.
 *
 * This is a shared secret, not a user identity. It answers "is this our app",
 * not "who is this person". Real per-user auth arrives with the move into the
 * workspace, where the session already identifies the user.
 */
export function authorised(req) {
  const expected = process.env.CONSTELLATION_KEY;
  if (!expected) return true;

  const supplied =
    req?.headers?.get?.("x-constellation-key") ||
    new URL(req.url).searchParams.get("key") ||
    "";

  // Constant-time-ish comparison. Length is not secret; content is.
  if (supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function unauthorised(req) {
  return json(req, { error: "Not authorised. Send X-Constellation-Key." }, { status: 401 });
}
