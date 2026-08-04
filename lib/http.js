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
