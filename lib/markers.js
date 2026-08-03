/**
 * Markers — what happened *between* phases.
 *
 * A blocker (lib/tickets.js) attaches to the step it blocks. But plenty of what
 * matters in an onboarding happens in the gaps: two weeks lost waiting on a
 * procurement signature, a decision to drop a locale from the first wave, a
 * change of contact. None of that belongs to a step, and today it lives in
 * someone's memory or an email thread nobody else can see.
 *
 * A marker is anchored to the phase it follows, not to both sides, because a gap
 * is uniquely identified by what came before it.
 */

/**
 * Colour encodes KIND, never urgency.
 *
 * This was wrong at first: an open issue shifted from amber to pink as it aged,
 * which meant hue carried two meanings at once and a gap holding a decision
 * looked identical to one holding context. Kind is now fixed to a hue and
 * urgency is shown separately, in the age text. Every kind also carries a
 * distinct icon, so the code survives colourblindness and greyscale printing.
 */
export const MARKER_KINDS = {
  issue: {
    label: "Issue",
    verb: "Log an issue",
    blurb: "Something went wrong or stalled here.",
    color: "#F471B5",       // pink — the only kind that means something is wrong
    stateful: true,         // can be resolved
    weight: 3,              // decides the colour of a gap holding several kinds
  },
  decision: {
    label: "Decision",
    verb: "Record a decision",
    blurb: "A choice was made that changes the plan.",
    color: "#2DD4BF",       // teal — settled, and not to be reopened
    stateful: false,
    weight: 2,
  },
  note: {
    label: "Context",
    verb: "Add context",
    blurb: "Something worth knowing that is not a task.",
    color: "#8B6DFF",       // violet — informational
    stateful: false,
    weight: 1,
  },
};

export const MARKER_KIND_IDS = Object.keys(MARKER_KINDS);

/** An unresolved issue older than this stops being news. */
export const MARKER_STALE_DAYS = 10;

export const MAX_MARKERS = 100;

const clean = (v, max = 400) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

export function coerceMarker(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const text = clean(r.text, 400);
  if (!text) return null;

  const kind = MARKER_KIND_IDS.includes(r.kind) ? r.kind : "note";

  return {
    id: clean(r.id, 40) || "m" + Math.random().toString(36).slice(2, 10),
    after: clean(r.after, 60),                 // the phase this gap follows
    kind,
    text,
    ref: clean(r.ref, 80),
    owner: clean(r.owner, 40),
    at: clean(r.at, 24) || new Date().toISOString().slice(0, 10),
    // Only issues carry state. A decision is not something you resolve.
    state: kind === "issue" ? (r.state === "resolved" ? "resolved" : "open") : "recorded",
  };
}

export function coerceMarkers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceMarker).filter(Boolean).slice(0, MAX_MARKERS);
}

export const isOpenIssue = (m) => m?.kind === "issue" && m.state === "open";

/** Markers sitting in the gap after a given phase. */
export const markersAfter = (rec, phaseId) =>
  (rec?.markers || []).filter((m) => m.after === phaseId);

export function markerAge(marker, today) {
  if (!isOpenIssue(marker)) return null;
  const then = new Date(marker.at + "T00:00:00Z");
  if (Number.isNaN(+then)) return null;
  const days = Math.max(0, Math.round(((today || new Date()) - then) / 86400000));
  return { days, stale: days >= MARKER_STALE_DAYS };
}

/** Journey-wide view, open issues oldest-first. */
export function markerSummary(rec, journey, today) {
  const all = rec?.markers || [];
  const label = new Map((journey || []).map((p) => [p.id, p.label]));

  const issues = all
    .filter(isOpenIssue)
    .map((m) => ({ ...m, age: markerAge(m, today), afterLabel: label.get(m.after) || "" }))
    .sort((a, b) => (b.age?.days || 0) - (a.age?.days || 0));

  return {
    total: all.length,
    issues,
    stale: issues.filter((m) => m.age?.stale),
    decisions: all.filter((m) => m.kind === "decision"),
    notes: all.filter((m) => m.kind === "note"),
  };
}

/**
 * The colour a gap node should take when it holds several kinds at once: the
 * most consequential one wins, and an unresolved issue always outranks
 * everything. A resolved issue stops shouting.
 */
export function dominantKind(markers) {
  const live = (markers || []).filter((m) => m && (m.kind !== "issue" || m.state === "open"));
  if (!live.length) return null;
  return live.reduce((best, m) =>
    (MARKER_KINDS[m.kind]?.weight || 0) > (MARKER_KINDS[best.kind]?.weight || 0) ? m : best
  ).kind;
}
