/**
 * Who actually does the linguistic work.
 *
 * This is a structural axis, not a preference. If a customer is using Marketplace
 * linguists, then sourcing, trialling and approving a roster is real onboarding
 * work with its own phase — and go-live is genuinely blocked until every in-scope
 * language pair has an approved reviewer. If their own SMEs review, none of that
 * exists and the path is shorter.
 */

export const REVIEW_MODELS = {
  unknown: {
    label: "Not established yet",
    short: "Not established",
    blurb: "Nobody has said who reviews. This needs answering before UAT — it is the difference between a four-week path and a seven-week one.",
  },
  ai_only: {
    label: "AI only",
    short: "AI only",
    blurb: "Machine translation with no human review step. Fastest and cheapest, and appropriate for high-volume internal content where nobody's name is on it.",
  },
  internal: {
    label: "Their own reviewers",
    short: "Internal reviewers",
    blurb: "The customer's own subject-matter experts review. No sourcing needed, but their people need training and their time needs booking.",
  },
  marketplace: {
    label: "Marketplace linguists",
    short: "Marketplace",
    blurb: "Vetted linguists sourced from the Smartcat Marketplace. Needs scoping, sourcing, a paid trial, and customer sign-off on the roster before go-live.",
  },
  hybrid: {
    label: "Both",
    short: "Hybrid",
    blurb: "Marketplace linguists translate and review; the customer's SMEs sign off on terminology and claims. The most common enterprise shape.",
  },
};

export const REVIEW_MODEL_IDS = Object.keys(REVIEW_MODELS);

/** Marketplace matching is driven by domain, so this is an enum rather than free text. */
export const SPECIALIZATIONS = [
  "Life sciences & pharma",
  "Legal & compliance",
  "Retail & e-commerce",
  "Technical & engineering",
  "Financial services",
  "Marketing & creative",
  "HR & training",
  "Software & IT",
  "Manufacturing & industrial",
  "Travel & hospitality",
  "Public sector",
  "General business",
];

export const TURNAROUNDS = ["Standard", "Expedited", "Same-day"];

/** Some locales cannot go live without a credential — fr-CA legal being the classic. */
export const CERTIFICATIONS = ["None", "Legal / sworn", "Medical", "Technical", "Financial"];

/**
 * A language pair moves through this. The point of tracking it per pair rather
 * than per journey is that enterprise rollouts stall on two locales out of
 * thirteen, and a single percentage hides exactly that.
 */
export const PAIR_STATES = {
  scoping:  { label: "Scoping",  done: false, blurb: "Volume and requirements not yet confirmed." },
  sourcing: { label: "Sourcing", done: false, blurb: "Smartcat is finding candidate linguists." },
  trial:    { label: "In trial", done: false, blurb: "Candidates are completing a paid trial translation." },
  approved: { label: "Approved", done: true,  blurb: "The customer has signed off on this linguist." },
  active:   { label: "Active",   done: true,  blurb: "Working on live projects." },
};

export const PAIR_STATE_IDS = Object.keys(PAIR_STATES);

export const MAX_PAIRS = 40;

const clean = (v, max = 40) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

const pickFrom = (v, allowed, fallback) => {
  if (typeof v !== "string") return fallback;
  const hit = allowed.find((a) => a.toLowerCase() === v.trim().toLowerCase());
  return hit || fallback;
};

/** A locale code we are willing to store. Loose on purpose — real sheets are messy. */
const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/i;

/** Normalise whatever the model or a spreadsheet gave us into a usable pair list. */
export function coercePairs(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];

  for (const p of raw.slice(0, MAX_PAIRS * 2)) {
    if (out.length >= MAX_PAIRS) break;
    const source = clean(p?.source, 12);
    const target = clean(p?.target, 12);
    if (!LOCALE.test(source) || !LOCALE.test(target)) continue;
    if (source.toLowerCase() === target.toLowerCase()) continue;

    const key = source.toLowerCase() + ">" + target.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const reviewers = Number.isFinite(+p?.reviewers) ? Math.max(0, Math.min(20, Math.round(+p.reviewers))) : 1;

    out.push({
      source,
      target,
      state: PAIR_STATE_IDS.includes(p?.state) ? p.state : "scoping",
      reviewers,
      certification: pickFrom(p?.certification, CERTIFICATIONS, "None"),
      note: clean(p?.note, 120),
    });
  }
  return out;
}

/** Does this journey involve sourcing linguists at all? */
export const usesMarketplace = (rec) =>
  rec?.reviewModel === "marketplace" || rec?.reviewModel === "hybrid";

/** True when nobody has actually said who reviews. Not the same as "internal". */
export const reviewModelUnknown = (rec) =>
  !rec?.reviewModel || rec.reviewModel === "unknown";

/** Roster readiness, per pair rather than as one misleading average. */
export function rosterState(rec) {
  const pairs = rec?.pairs || [];
  const ready = pairs.filter((p) => PAIR_STATES[p.state]?.done);
  const blocked = pairs.filter((p) => !PAIR_STATES[p.state]?.done);
  const certified = pairs.filter((p) => p.certification !== "None");
  return {
    pairs,
    total: pairs.length,
    ready: ready.length,
    blocked,
    certified,
    pct: pairs.length ? Math.round((ready.length / pairs.length) * 100) : 0,
    complete: pairs.length > 0 && blocked.length === 0,
  };
}

/**
 * Steps that only exist because linguists have to be found and approved.
 * Ownership matters here: sourcing is Smartcat's job, approval is the customer's.
 */
export const MARKETPLACE_STEPS = [
  { k: "mp_tier",    t: "Confirm quality tier and turnaround per locale",            who: ["kat"] },
  { k: "mp_scope",   t: "Scope language pairs and expected annual volume",           who: ["kat"] },
  { k: "mp_domain",  t: "Set specialization and industry so matching is accurate",   who: ["kat", "sc"] },
  { k: "mp_source",  t: "Smartcat sources candidate linguists per pair",             who: ["sc"] },
  { k: "mp_trial",   t: "Run a paid trial translation for each language pair",       who: ["sc"] },
  { k: "mp_approve", t: "Approve the roster — you sign off on who works on your content", who: ["kat"] },
  { k: "mp_attach",  t: "Attach approved linguists to your workflow templates",      who: ["sc"] },
  { k: "mp_rates",   t: "Agree rates, SLA, and escalation path",                     who: ["kat", "sc"] },
];

export const MARKETPLACE_PHASE_COPY = {
  blurb:
    "We find the linguists, they prove themselves on a paid trial, and you decide who works on your content. Nobody is assigned to you sight-unseen.",
  proof: "Every language pair in scope has a linguist you have personally approved.",
};
