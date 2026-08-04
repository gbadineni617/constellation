/**
 * Blockers.
 *
 * A step can sit open for three weeks and the journey has no idea why. That gap
 * matters more than it sounds: "waiting on Phillip's glossary" and "nobody has
 * looked at this" are the same open checkbox but completely different problems,
 * and only one of them is the customer's fault.
 *
 * A ticket is attached to the step it blocks rather than sitting between two
 * steps, because a blocker is always blocking something specific — and that is
 * what makes it answerable.
 */

export const TICKET_STATES = {
  open:     { label: "Open",     resolved: false },
  waiting:  { label: "Waiting",  resolved: false },
  resolved: { label: "Resolved", resolved: true },
};

export const TICKET_STATE_IDS = Object.keys(TICKET_STATES);

/** Past this many days an open blocker stops being news and starts being a problem. */
export const STALE_DAYS = 7;

export const MAX_TICKETS_PER_STEP = 10;

const clean = (v, max = 400) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

/** Normalise one ticket. Anything unrecognised becomes a safe default, never a throw. */
export function coerceTicket(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const text = clean(r.text, 400);
  if (!text) return null;

  return {
    id: clean(r.id, 40) || "t" + Math.random().toString(36).slice(2, 10),
    stepKey: clean(r.stepKey, 60),
    text,
    state: TICKET_STATE_IDS.includes(r.state) ? r.state : "open",
    owner: clean(r.owner, 40),          // person id, or empty
    ref: clean(r.ref, 80),              // external reference, e.g. SUP-4821 or a URL
    at: clean(r.at, 24) || new Date().toISOString().slice(0, 10),
    resolvedAt: clean(r.resolvedAt, 24),
  };
}

export function coerceTickets(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(coerceTicket).filter(Boolean).slice(0, 200);
}

export const isOpen = (t) => !TICKET_STATES[t?.state]?.resolved;

/** Tickets belonging to one step. */
export const ticketsFor = (rec, stepKey) =>
  (rec?.tickets || []).filter((t) => t.stepKey === stepKey);

/**
 * How long has this been open, and is that too long? Returns null for a resolved
 * ticket — a closed blocker has no age worth reporting.
 */
export function ticketAge(ticket, today) {
  if (!ticket || !isOpen(ticket)) return null;
  const then = new Date(ticket.at + "T00:00:00Z");
  if (Number.isNaN(+then)) return null;
  const days = Math.max(0, Math.round(((today || new Date()) - then) / 86400000));
  return { days, stale: days >= STALE_DAYS };
}

/**
 * Journey-wide view. Ordered oldest-first, because the one that has been open
 * longest is nearly always the one worth asking about.
 */
export function ticketSummary(rec, journey, today) {
  const stepLabel = new Map();
  const phaseLabel = new Map();
  for (const p of journey || []) {
    for (const it of p.items || []) {
      stepLabel.set(it.k, it.t);
      phaseLabel.set(it.k, p.label);
    }
  }

  // A blocker on a step that is no longer in the journey — removed by hand, or
  // dropped when an axis changed — is not blocking anything. Leaving it counted
  // would hold a journey at risk over work nobody is doing.
  const all = (rec?.tickets || []).filter((x) => stepLabel.has(x.stepKey));
  const open = all.filter(isOpen);

  const enriched = open
    .map((t) => ({
      ...t,
      age: ticketAge(t, today),
      step: stepLabel.get(t.stepKey) || "",
      phase: phaseLabel.get(t.stepKey) || "",
    }))
    .sort((a, b) => (b.age?.days || 0) - (a.age?.days || 0));

  return {
    total: all.length,
    open: enriched,
    stale: enriched.filter((t) => t.age?.stale),
    resolved: all.length - open.length,
  };
}
