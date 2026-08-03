/**
 * Smartcat API client.
 *
 * Server-side only — these credentials must never reach the browser.
 *
 * Auth is Basic: the Account ID is the username, an API key is the password.
 * People routinely mistake the Account ID for the key itself; it is not, and
 * you need both.
 *
 * The API is documented at 4 requests per second, and computing something like
 * "how many projects have a TM attached" means one call per project. So every
 * request goes through a queue rather than trusting call sites to behave.
 */

const SERVERS = {
  eu: "https://smartcat.ai",
  us: "https://us.smartcat.ai",
  ea: "https://ea.smartcat.ai",
};

/** Documented limit is 4/sec. Sit under it — a 429 costs more than the wait. */
const MIN_GAP_MS = 320;
const MAX_RETRIES = 2;
const TIMEOUT_MS = 20_000;

export function smartcatConfigured() {
  return Boolean(process.env.SMARTCAT_ACCOUNT_ID && process.env.SMARTCAT_API_KEY);
}

export function smartcatBase() {
  const region = (process.env.SMARTCAT_SERVER || "us").toLowerCase();
  return SERVERS[region] || SERVERS.us;
}

/** Serialised queue. Every call in this process waits its turn. */
let lastCall = 0;
let chain = Promise.resolve();

function throttle() {
  chain = chain.then(async () => {
    const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastCall));
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
  });
  return chain;
}

function authHeader() {
  const id = process.env.SMARTCAT_ACCOUNT_ID || "";
  const key = process.env.SMARTCAT_API_KEY || "";
  return "Basic " + Buffer.from(id + ":" + key).toString("base64");
}

/**
 * One API call. Throws a plain Error whose message is safe to show a human —
 * "that key was rejected" is actionable, "request failed" is not.
 */
export async function smartcat(path, { method = "GET", body, query } = {}) {
  if (!smartcatConfigured()) {
    throw new Error("Smartcat is not connected. Set SMARTCAT_ACCOUNT_ID and SMARTCAT_API_KEY.");
  }

  const url = new URL(smartcatBase() + "/api/integration" + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, String(x)));
    else url.searchParams.set(k, String(v));
  }

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await throttle();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: authHeader(),
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 401 || res.status === 403) {
        throw new Error(
          "Smartcat rejected those credentials. Check that SMARTCAT_ACCOUNT_ID is the Account ID from Settings > API, and SMARTCAT_API_KEY is a key created there — they are two different values."
        );
      }
      if (res.status === 404) throw new Error("No such Smartcat resource: " + path);

      if (res.status === 429) {
        // Backed off harder each time rather than hammering.
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        lastErr = new Error("Smartcat rate limit reached.");
        continue;
      }

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error("Smartcat returned " + res.status + (detail ? ": " + detail.slice(0, 200) : ""));
      }

      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        throw new Error("Smartcat returned something that was not JSON.");
      }
    } catch (e) {
      clearTimeout(timer);
      if (e.name === "AbortError") {
        lastErr = new Error("Smartcat did not respond in time.");
        continue;
      }
      // Credential and 404 errors are final — retrying changes nothing.
      if (/rejected those credentials|No such Smartcat resource/.test(e.message)) throw e;
      lastErr = e;
    }
  }
  throw lastErr || new Error("Smartcat request failed.");
}

/* ── The handful of calls we actually need ───────────────────────────── */

export const getAccount = () => smartcat("/v1/account");

export const listProjects = () => smartcat("/v1/project/list");

export const getProject = (id) => smartcat("/v1/project/" + encodeURIComponent(id));

/** v1 statistics is obsolete; v2 is the current one. */
export const getProjectStats = (id) =>
  smartcat("/v2/project/" + encodeURIComponent(id) + "/statistics");

/**
 * Verify a connection and report what it can see. Deliberately returns a result
 * object rather than throwing: "connected, 40 projects" and "the key is wrong"
 * are both useful answers, and only one of them is an error.
 */
export async function testConnection() {
  if (!smartcatConfigured()) {
    return { ok: false, configured: false, error: "Not connected. Set SMARTCAT_ACCOUNT_ID and SMARTCAT_API_KEY in .env.local." };
  }
  try {
    const account = await getAccount();
    const projects = await listProjects();
    return {
      ok: true,
      configured: true,
      server: smartcatBase(),
      account: { id: account?.id || "", name: account?.name || "" },
      projectCount: Array.isArray(projects) ? projects.length : 0,
    };
  } catch (e) {
    return { ok: false, configured: true, server: smartcatBase(), error: e.message };
  }
}
