"use client";

/**
 * Are we running inside Smartcat as a custom app, or standalone?
 *
 * This changes what "open" means. Standalone, a link opens a new tab. Embedded,
 * opening a new tab to somewhere else in the same platform is jarring — the host
 * should navigate instead.
 *
 * Detection is deliberately conservative: if we cannot tell, assume standalone,
 * because a new tab is a harmless fallback while a failed postMessage is a dead
 * button.
 */

export function isEmbedded() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin frame throws on that comparison, which itself means framed.
    return true;
  }
}

/**
 * Ask the host to navigate. Falls back to a normal tab if nothing is listening,
 * so the button always does something.
 *
 * The message shape is a guess until the custom-app SDK is confirmed — that is
 * the one thing here that needs checking against real docs.
 */
export function navigateHost({ path, href }) {
  if (isEmbedded() && path) {
    try {
      window.parent.postMessage({ type: "smartcat:navigate", path }, "*");
      return true;
    } catch {
      // fall through
    }
  }
  if (href) window.open(href, "_blank", "noopener,noreferrer");
  return false;
}
