/**
 * Recovering a JSON object the model ran out of room to finish.
 *
 * When a response hits `max_tokens`, the text is valid JSON up to the cut and
 * garbage after it. Throwing the whole thing away loses a nearly-complete
 * journey over a missing brace — so instead we find the last position where the
 * document was structurally sound and close it there.
 *
 * The approach is a single scan that records, at every point, whether the text
 * so far could be legally closed. Regex trimming was tried first and is a trap:
 * every fix creates a new dangling case (a cut string leaves an orphaned key, a
 * removed key leaves an orphaned comma, and so on). Tracking validity while
 * parsing gets it right in one pass.
 */

/**
 * @returns {{ ok: boolean, value?: any, repaired: boolean }}
 */
export function parseLoose(text) {
  const src = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!src) return { ok: false, repaired: false };

  // The common case: it is simply valid.
  try {
    return { ok: true, value: JSON.parse(src), repaired: false };
  } catch {
    // fall through to recovery
  }

  const stack = [];          // "{" or "["
  let inString = false;
  let escaped = false;
  // Position after the last token that left the document closeable, plus the
  // stack depth at that moment.
  let safeEnd = -1;
  let safeStack = null;
  // Inside an object, a key with a colon but no value yet cannot be closed.
  const awaitingValue = [];
  // Index of a string that just closed, before we know if it was a key or a value.
  let pendingStringEnd = -1;

  /** The character after a closed string tells us what it was. */
  const resolvePendingString = (ch) => {
    if (pendingStringEnd < 0) return;
    if (ch === ":") {
      // It was a key. The object now owes a value.
      if (awaitingValue.length) awaitingValue[awaitingValue.length - 1] = true;
    } else {
      // It was a value: complete, and the document is closeable here.
      if (awaitingValue.length) awaitingValue[awaitingValue.length - 1] = false;
      markSafe(pendingStringEnd);
    }
    pendingStringEnd = -1;
  };

  const markSafe = (i) => {
    // Closeable only if we are not mid-string and no object is waiting on a value.
    if (inString) return;
    if (awaitingValue.length && awaitingValue[awaitingValue.length - 1]) return;
    safeEnd = i + 1;
    safeStack = [...stack];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inString) {
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') {
        inString = false;
        // A closed string might be a key or a value — the next non-space
        // character decides, so defer rather than marking safe here.
        pendingStringEnd = i;
      }
      continue;
    }

    if (!/\s/.test(ch)) resolvePendingString(ch);

    switch (ch) {
      case '"':
        inString = true;
        break;

      case "{":
        stack.push("{");
        awaitingValue.push(false);
        break;

      case "[":
        stack.push("[");
        break;

      case "}":
        stack.pop();
        awaitingValue.pop();
        markSafe(i);
        break;

      case "]":
        stack.pop();
        markSafe(i);
        break;

      case ":":
        // The string just closed was a key, so this object now needs a value.
        if (awaitingValue.length) awaitingValue[awaitingValue.length - 1] = true;
        break;

      case ",":
        // A comma proves the previous value completed.
        if (awaitingValue.length) awaitingValue[awaitingValue.length - 1] = false;
        break;

      default:
        // A literal or number ending here is a complete value.
        if (/[\d}\]eln]/.test(ch) && !/\s/.test(ch)) {
          const next = src[i + 1];
          if (next === undefined || /[\s,}\]]/.test(next)) {
            if (awaitingValue.length) awaitingValue[awaitingValue.length - 1] = false;
            markSafe(i);
          }
        }
    }
  }

  // A string that closed right at the end of the input was a value.
  if (!inString) resolvePendingString("");

  if (safeEnd < 0 || !safeStack) return { ok: false, repaired: false };

  let out = src.slice(0, safeEnd);
  for (let i = safeStack.length - 1; i >= 0; i--) {
    out += safeStack[i] === "{" ? "}" : "]";
  }

  try {
    return { ok: true, value: JSON.parse(out), repaired: true };
  } catch {
    return { ok: false, repaired: false };
  }
}
