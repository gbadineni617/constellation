"use client";

/**
 * Read a JSON response without assuming it is JSON.
 *
 * A platform timeout, a crashed function, or a proxy error returns an HTML page.
 * Calling res.json() on that throws "Unexpected token '<'" — a message that tells
 * the user nothing and sends the developer looking in the wrong place. This
 * reads the body once and reports what actually happened.
 */
export async function readJson(res) {
  const text = await res.text();

  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Not JSON. Work out why from the status rather than the parse failure.
    if (res.status === 504 || res.status === 408) {
      throw new Error(
        "That took too long and the server gave up. Large documents can exceed the time limit on this plan — try fewer files, or a shorter one."
      );
    }
    if (res.status === 413) throw new Error("Those files are too large to send.");
    if (res.status >= 500) throw new Error("The server hit an error (" + res.status + ") and returned a page instead of a result.");
    throw new Error("The server returned something unreadable (" + res.status + ").");
  }

  if (!res.ok) throw new Error(data?.error || "Request failed (" + res.status + ").");
  return data;
}
