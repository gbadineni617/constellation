"use client";

/**
 * Read a JSON response without assuming it is JSON.
 *
 * A platform timeout, a crashed function, or a proxy error returns an HTML page.
 * Calling res.json() on that throws "Unexpected token '<'" — a message that tells
 * the user nothing and sends the developer looking in the wrong place. This
 * reads the body once and reports what actually happened.
 */
/**
 * Headers for a call to our own API.
 *
 * Same-origin calls do not need the key, but this code also runs inside a
 * Smartcat custom app, where it does. Sending it always is simpler than two
 * paths, and NEXT_PUBLIC_ is correct here: a shared client secret is not a
 * server secret, and pretending otherwise would mean hiding it from the very
 * code that has to send it.
 */
export function apiHeaders(extra = {}) {
  const key = process.env.NEXT_PUBLIC_CONSTELLATION_KEY;
  return { ...extra, ...(key ? { "X-Constellation-Key": key } : {}) };
}

/** fetch, with the key attached. Use this for anything under /api. */
export function apiFetch(url, init = {}) {
  return fetch(url, { ...init, headers: apiHeaders(init.headers || {}) });
}

export async function readJson(res) {
  const text = await res.text();

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Not JSON. Work out why from the status rather than the parse failure.
    if (res.status === 504 || res.status === 408) {
      throw new Error(
        "That took longer than the server allows. Try one document rather than several, or a shorter one — a long transcript plus a full tracker is a lot to read at once."
      );
    }
    if (res.status === 413) throw new Error("Those files are too large to send.");
    if (res.status >= 500) throw new Error("The server hit an error (" + res.status + ") and returned a page instead of a result.");
    throw new Error("The server returned something unreadable (" + res.status + ").");
  }

  if (!res.ok) throw new Error(data?.error || "Request failed (" + res.status + ").");
  return data;
}
