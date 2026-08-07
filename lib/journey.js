import { PEOPLE } from "./theme.js";
import { MARKETPLACE_STEPS, MARKETPLACE_PHASE_COPY, usesMarketplace, reviewModelUnknown, rosterState, PAIR_STATES } from "./marketplace.js";
import { ticketsFor, ticketSummary, isOpen } from "./tickets.js";
import { markerSummary, isOpenIssue } from "./markers.js";
import { phasesFor, sequenceState, HEALTH_METRICS, resolveTier, GATES } from "./checklist.js";



export const CONTENT_PATHS = {
  "e-Learning": [
    { k: "c1", t: "Connect Rise / Storyline or export XLIFF / SCORM" },
    { k: "c2", t: "Upload; preserve structure, interactivity & SCORM compliance" },
    { k: "c3", t: "Translate text, images, audio & video assets" },
    { k: "c4", t: "QA tags / placeholders" },
    { k: "c5", t: "Re-import / export back to your LMS" },
  ],
  "Video & audio": [
    { k: "c1", t: "Upload video / audio / subtitle file or connect source" },
    { k: "c2", t: "Auto-transcribe / generate subtitles" },
    { k: "c3", t: "Translate; adjust timing & reading speed" },
    { k: "c4", t: "Add AI dubbing / voiceover (if needed)" },
    { k: "c5", t: "Preview in context; export subtitles or dubbed audio" },
  ],
  // Document & text intentionally has no path of its own — the core path already
  // covers it end to end, so the phase is dropped rather than filled with a placeholder.
  "Document & text": [],
};

export const INTEGRATION_STEPS = [
  { k: "i1", t: "Connect the source system & confirm permissions", who: ["sc"] },
  { k: "i2", t: "Map content types and fields to Smartcat projects", who: ["sc", "kat"] },
  { k: "i3", t: "Set sync rules — what triggers a job, and how often", who: ["kat"] },
  { k: "i4", t: "Run a test sync in both directions", who: ["paul"] },
  { k: "i5", t: "Confirm translated content publishes back to the right place", who: ["kat"] },
];

export const ASSET_STEPS = {
  greenfield: [
    { k: "a1", t: "Understand what TMs & glossaries do", who: ["paul"] },
    { k: "a2", t: "Create a glossary + style guide", who: ["phil"] },
    { k: "a3", t: "TM builds automatically from your first projects", who: ["paul"] },
  ],
  mature: [
    { k: "a1", t: "Upload existing TMX from prior vendor", who: ["kat"] },
    { k: "a2", t: "Validate locale codes & match rates (asset QA)", who: ["paul"] },
    { k: "a3", t: "Upload termbase / glossary to workspace", who: ["kat"] },
  ],
};

export const PHASE_ORDER = ["prep", "kickoff", "setup", "integration", "core", "content", "roster", "uat", "golive", "hyper"];

export /**
 * Thirteen metrics from the Enterprise checklist, recorded at go-live and again
 * at Day 30. A number that was met at go-live and has since slipped is exactly
 * what hypercare exists to catch, so one reading is not enough.
 */
const HEALTH_TARGETS = HEALTH_METRICS;

/* ────────────────────────────────────────────────────────────
   Seeded journeys — the "past journeys" shelf
   ──────────────────────────────────────────────────────────── */

export /**
 * What a second team at the same customer does not have to redo.
 *
 * Matched by stage rather than by an explicit key list: step keys now derive
 * from the checklist wording, so a hardcoded list would silently stop matching
 * the moment a line was reworded. Setup is inherited wholesale; the linguistic
 * asset uploads within the core path are too.
 */
const INHERITED_STAGES = new Set(["setup"]);
const INHERITED_PATTERNS = [
  /upload-glossary/, /upload-translation-memory/, /understand-how-assets/,
  /connect-to-your-integration/, /test-file-sync/,
];

function isInherited(key) {
  const stage = String(key || "").split("__")[0];
  if (INHERITED_STAGES.has(stage)) return true;
  return INHERITED_PATTERNS.some((re) => re.test(String(key || "")));
}

export function resolveStatus(rec, phaseId, key, idx, count, custom) {
  if (rec.overrides && rec.overrides[key]) return rec.overrides[key];
  if (custom) return "open";
  if (rec.explicit && rec.explicit[key]) return rec.explicit[key];
  // A replica starts with the setup and linguistic work already banked
  if (rec.inheritedFrom && isInherited(key)) return "done";
  // Phase order comes from the journey being built, not a fixed list — the two
  // tiers have different stages and neither matches a hardcoded order.
  const order = rec._order || PHASE_ORDER;
  const pi = order.indexOf(phaseId);
  const si = order.indexOf(rec.stage || order[0]);
  if (pi < si) return "done";
  if (pi > si) return "open";
  const cut = Math.round((rec.stageProgress == null ? 0.5 : rec.stageProgress) * count);
  if (idx < cut) return "done";
  if (idx === cut) return "active";
  return "open";
}

function buildFromPlan(rec) {
  const dues = rec.dueDates || {};
  const owners = rec.owners || {};
  const overrides = rec.overrides || {};

  const raw = rec.phases.slice();
  const customPhases = (rec.customPhases || []).map((p) => ({ ...p, custom: true, surface: p.surface || "workspace", steps: [] }));
  if (customPhases.length) {
    const at = raw.findIndex((p) => p.id === "golive");
    raw.splice(at < 0 ? raw.length : at, 0, ...customPhases);
  }

  const removed = new Set(rec.removedSteps || []);
  const renames = rec.renames || {};

  const phaseRenames = rec.phaseRenames || {};

  const order = raw.map((p) => p.id);
  rec = { ...rec, _order: order };

  return raw.map((p0) => {
    const phase = phaseRenames[p0.id] ? { ...p0, label: phaseRenames[p0.id] } : p0;
    const extra = ((rec.customItems || {})[phase.id] || []).map((x) => ({ ...x, custom: true }));
    const all = (phase.steps || []).concat(extra).filter((st) => !removed.has(st.k));

    const items = all.map((st, idx) => ({
      k: st.k,
      // Carried through from the checklist: who owns this in the source document,
      // which group it sits under, and whether it is the stage's sign-off.
      role: st.role || null,
      group: st.group || "",
      signoff: Boolean(st.signoff),
      optional: Boolean(st.optional),
      // A step can be renamed. The key never changes, so dates, owners, tickets
      // and overrides all survive a rename — that is the point of stable keys.
      t: renames[st.k] || st.t,
      custom: st.custom || false,
      // An override wins. Otherwise a generated plan carries its own status, and
      // a checklist journey derives one from where the customer has got to —
      // which is what lets a record say "they are mid-UAT" without listing every
      // completed step by hand.
      s: overrides[st.k]
        || (st.custom ? "open" : st.status && st.status !== "open" ? st.status
        : resolveStatus(rec, phase.id, st.k, idx, all.length, st.custom)),
      // An inherited step should say so, or a second team looks like it did work
      // it never did.
      note: (rec.inheritedFrom && isInherited(st.k)
              ? "Inherited from " + rec.inheritedFrom.customer + "."
              : "") || st.note || "",
      due: dues[st.k] || null,
      who: owners[st.k] ? [owners[st.k]] : st.who || [],
      tickets: ticketsFor(rec, st.k),
      renamed: Boolean((rec.renames || {})[st.k]),
    }));

    if (!items.length) return { ...phase, items, status: "open" };
    const stt = items.map((i) => i.s);
    const status = stt.every((x) => x === "done" || x === "na")
      ? "done"
      : stt.some((x) => x === "active" || x === "done")
      ? "active"
      : "open";
    return { ...phase, items, status };
  });
}

export function buildJourney(rec) {
  // A generated journey carries its own phase plan; a template journey is built
  // from the real implementation checklist for its tier. Everything downstream —
  // assess, progressOf, the star map — sees the same shape either way.
  if (Array.isArray(rec.phases) && rec.phases.length) return buildFromPlan(rec);

  // The checklist is the spine now. It replaced a version inferred from one
  // account, and the wording is verbatim so an FDE recognises every line.
  return buildFromPlan({
    ...rec,
    phases: phasesFor({
      tier: resolveTier(rec.tier),
      contentPath: rec.contentPath,
      connected: rec.delivery === "connected",
      session3: rec.session3,
      sourcing: usesMarketplace(rec),
    }),
  });

  const cp = rec.contentPath;
  const mat = rec.maturity;
  const connected = rec.delivery === "connected";
  const market = usesMarketplace(rec);
  // Notes that re-write themselves when an axis flips
  const FALLBACK = {
    assets: mat === "greenfield"
      ? "No TMs to port — glossary + style guide still to be created."
      : "TMX + termbase inherited from the prior vendor.",
    path: cp + " as the primary path.",
  };
  const N = rec.notes || {};

  const raw = [
    { id: "prep", label: "Before kickoff", week: "Prep", surface: "demo", items: [
      { k: "goals",  t: "Goals & primary use case",              who: ["kat"] },
      { k: "content", t: "Content & file types",                  who: ["phil"] },
      { k: "langs",  t: "Languages / locales",                    who: ["kat"] },
      { k: "assets", t: "Existing TMs / glossaries / style guides", who: ["kat"] },
      { k: "who",    t: "Who's involved",                         who: ["kat", "phil"] },
    ] },
    { id: "kickoff", label: "Kickoff", week: "Week 1", surface: "demo", items: [
      { k: "welcome", t: "Welcome, goals & success criteria",     who: ["kat", "paul"] },
      { k: "3pvm",    t: "Review 3-Phase Customer Value Map",     who: ["paul"] },
      { k: "path",    t: "Confirm content-type path(s)",          who: ["kat", "paul"] },
      { k: "cadence", t: "Set weekly cadence",                    who: ["kat"] },
    ] },
    { id: "setup", label: "Core setup", week: "Week 1", surface: "workspace", items: [
      { k: "provision",  t: "Workspace provisioning",             who: ["sc"] },
      { k: "smartwords", t: "Smartwords allocation",              who: ["sc"] },
      { k: "sso",        t: "Confirm SSO in/out of scope",        who: ["sc"] },
      { k: "templates",  t: "Project & assignment templates",     who: ["sc"] },
      { k: "aiprofile",  t: "AI Translation Profile + AI Agents", who: ["sc"] },
    ] },
    connected && { id: "integration", label: "Integration", week: "Weeks 1-2", surface: "workspace",
      items: INTEGRATION_STEPS.map((x) => ({ ...x })) },
    { id: "core", label: "Core path", week: "Weeks 2-3", surface: "translations", items: [
      { k: "users",    t: "User management & access (roles, dashboard, backup admin)", who: ["kat"] },
      { k: "projects", t: "Project creation & templates",         who: ["kat"] },
      { k: "workflow", t: "Translation workflow (upload, AI, linguist, CAT, export)", who: ["kat"] },
      ...ASSET_STEPS[mat],
      { k: "review",    t: "Review & QA (assign reviewers, checks, comments)", who: ["ryan"] },
      { k: "reporting", t: "AI, reporting & support (Enterprise Reports, tickets, Academy)", who: ["kat"] },
    ] },
    CONTENT_PATHS[cp].length > 0 && { id: "content", label: cp + " path", week: "Weeks 2-3", surface: "translations",
      items: CONTENT_PATHS[cp].map((x) => ({ k: x.k, t: x.t, who: ["kat"] })) },
    market && { id: "roster", label: "Linguist roster", week: "Weeks 2-3", surface: "marketplace",
      items: MARKETPLACE_STEPS.map((x) => ({ ...x })) },
    { id: "uat", label: "UAT", week: "Week 3", surface: "translations", items: [
      { k: "e2e",     t: "Run your real content end-to-end",      who: ["kat", "paul"] },
      { k: "quality", t: "Check output quality, formatting & TM/glossary use", who: ["kat", "paul"] },
      { k: "selfrun", t: "Run a project yourself between sessions", who: ["kat"] },
      ...(cp === "e-Learning" ? [{ k: "lms", t: "Re-import the translated course and confirm it still works in your LMS", who: ["kat", "phil"] }] : []),
      ...(cp === "Video & audio" ? [{ k: "sync", t: "Check subtitle timing and audio sync on a full-length asset", who: ["kat"] }] : []),
      ...(connected ? [{ k: "isync", t: "Confirm a real sync round-trips without manual cleanup", who: ["paul"] }] : []),
      { k: "accept",  t: "Confirm the run meets your acceptance criteria", who: ["kat"] },
    ] },
    { id: "golive", label: "Go-live", week: "Week 4", surface: "reporting", items: [
      { k: "health",  t: "Confirm health metrics meet targets",   who: ["sc"] },
      { k: "reports", t: "Walk Enterprise Reports as your live dashboard", who: ["sc"] },
      ...(market ? [{ k: "gl_roster", t: "Confirm every language pair has an approved linguist", who: ["kat"] }] : []),
      { k: "signoff", t: "Confirm go-live & sign off",            who: ["kat"] },
    ] },
    { id: "hyper", label: "Hypercare", week: "Day 1-30", surface: "demo", items: [
      { k: "am",      t: "Account Manager becomes main contact",  who: ["james"] },
      { k: "support", t: "30-day priority support as you ramp",   who: ["sc"] },
      { k: "recheck", t: "Re-check health metrics before hypercare closes", who: ["kat", "paul"] },
    ] },
  ];

  const customPhases = (rec.customPhases || []).map((p) => ({ ...p, custom: true, surface: p.surface || "workspace", items: [] }));
  if (customPhases.length) {
    const at = raw.findIndex((p) => p && p.id === "golive");
    raw.splice(at < 0 ? raw.length : at, 0, ...customPhases);
  }

  const phaseRenames = rec.phaseRenames || {};

  return raw.filter(Boolean).map((p0) => {
    const phase = phaseRenames[p0.id] ? { ...p0, label: phaseRenames[p0.id] } : p0;
    const dues = rec.dueDates || {};
    const owners = rec.owners || {};
    const removed = new Set(rec.removedSteps || []);
    const renames = rec.renames || {};
    const extra = ((rec.customItems || {})[phase.id] || []).map((x) => ({ ...x, custom: true }));
    const all = phase.items.concat(extra).filter((it) => !removed.has(it.k));
    const items = all.map((it, i) => ({
      ...it,
      // Renaming changes the words, never the key — so a renamed step keeps its
      // due date, owner, tickets and status.
      t: renames[it.k] || it.t,
      s: resolveStatus(rec, phase.id, it.k, i, phase.items.length, it.custom || phase.custom),
      note: N[it.k]
        || (rec.inheritedFrom && isInherited(it.k) ? "Inherited from " + rec.inheritedFrom.customer + "." : "")
        || (rec.connector && phase.id === "integration" ? rec.connector + "." : "")
        || FALLBACK[it.k] || "",
      due: dues[it.k] || it.due || null,
      who: owners[it.k] ? [owners[it.k]] : it.who || [],
      tickets: ticketsFor(rec, it.k),
      renamed: Boolean((rec.renames || {})[it.k]),
    }));
    const st = items.map((i) => i.s);
    if (!st.length) return { ...phase, items, status: "open" };
    const status = st.every((s) => s === "done" || s === "na")
      ? "done"
      : st.some((s) => s === "active" || s === "done")
      ? "active"
      : "open";
    return { ...phase, items, status };
  });
}

export function progressOf(phases) {
  const all = phases.flatMap((p) => p.items);
  const done = all.filter((i) => i.s === "done" || i.s === "na").length;
  return { done, total: all.length, pct: Math.round((done / all.length) * 100) };
}

/* ────────────────────────────────────────────────────────────
   Risk engine — pure arithmetic. No model runs here, on purpose:
   whether a journey is at risk must be reproducible and auditable.
   The model only writes the message once this decides one is due.
   ──────────────────────────────────────────────────────────── */

export const TODAY = new Date("2026-07-26T00:00:00Z");

export const DAY = 86400000;

/** How many days before a due date counts as "coming up" rather than "later". */
export const DUE_SOON_DAYS = 3;

/**
 * The state of a single dated step. Returns null when there is nothing to say:
 * no date set, or the work is already done. A finished step is never late.
 */
export function dueState(due, status, today) {
  if (!due || status === "done" || status === "na") return null;
  const d = daysBetween(today || TODAY, due);
  if (d < 0) return { state: "overdue", days: -d };
  if (d <= DUE_SOON_DAYS) return { state: "soon", days: d };
  return { state: "scheduled", days: d };
}

export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / DAY);

export function assess(rec, journey) {
  const { done, total, pct } = progressOf(journey);
  // Generated journeys bring their own cast; template journeys use the shared map.
  const cast = { ...PEOPLE, ...((rec && rec.people) || {}) };

  const daysLeft = rec.goLiveDate ? daysBetween(TODAY, rec.goLiveDate) : null;
  const span = rec.startDate && rec.goLiveDate ? daysBetween(rec.startDate, rec.goLiveDate) : null;
  const burned = rec.startDate ? daysBetween(rec.startDate, TODAY) : null;
  const expected = span && span > 0 ? Math.max(0, Math.min(100, Math.round((burned / span) * 100))) : null;
  const drift = expected == null ? null : pct - expected;
  const idle = rec.lastActivityDate ? daysBetween(rec.lastActivityDate, TODAY) : null;

  // Steps with their own deadline — the specific thing someone owes by a specific day
  const dated = journey
    .flatMap((p) => p.items.map((it) => ({ ...it, phase: p.label, d: dueState(it.due, it.s) })))
    .filter((x) => x.d)
    .map((x) => ({ ...x, owners: (x.who || []).map((w) => (cast[w] || {}).name).filter(Boolean) }));

  const overdue = dated.filter((x) => x.d.state === "overdue").sort((a, b) => b.d.days - a.d.days);
  const dueSoon = dated.filter((x) => x.d.state === "soon").sort((a, b) => a.d.days - b.d.days);

  // Marketplace: a rollout stalls on two locales out of thirteen, and one
  // aggregate percentage is exactly what hides that.
  const roster = usesMarketplace(rec) ? rosterState(rec) : null;

  // A blocker explains an open step. "Waiting on Phillip's glossary" and "nobody
  // has looked at this" are the same checkbox and completely different problems.
  const tickets = ticketSummary(rec, journey, TODAY);

  // Issues recorded in the gaps between phases — two weeks lost to procurement
  // belongs to no step, but it is exactly the thing an FDE needs surfaced.
  const markers = markerSummary(rec, journey, TODAY);

  const missed = HEALTH_TARGETS
    .map((m, i) => ({ ...m, now: (rec.health || [])[i] || 0 }))
    .filter((m) => m.now < m.target);

  // Open work in phases the customer should already be through
  const stageIdx = PHASE_ORDER.indexOf(rec.stage || "prep");
  const blockers = journey
    .filter((p) => PHASE_ORDER.indexOf(p.id) <= stageIdx)
    .flatMap((p) => p.items
      .filter((it) => it.s === "open" || it.s === "active")
      .map((it) => ({ phase: p.label, text: it.t, note: it.note, who: (it.who || []).map((w) => (PEOPLE[w] || {}).name).filter(Boolean) })))
    .slice(0, 4);

  let level = "on_track";
  if (pct >= 100) level = "complete";
  else if (daysLeft != null && daysLeft < 0) level = "overdue";
  else if (
    tickets.stale.length > 0 ||
    markers.stale.length > 0 ||
    overdue.length > 0 ||
    (roster && roster.blocked.length > 0 && daysLeft != null && daysLeft <= 21) ||
    (daysLeft != null && daysLeft <= 14 && pct < 85) ||
    (drift != null && drift <= -20) ||
    (idle != null && idle >= 10)
  ) level = "at_risk";

  const signals = [];
  if (overdue.length && level !== "complete") {
    const worst = overdue[0];
    signals.push({
      t: overdue.length === 1
        ? "\"" + worst.t.slice(0, 44) + (worst.t.length > 44 ? "…" : "") + "\" is " + worst.d.days + " days late"
        : overdue.length + " steps past their date",
      hot: true,
    });
  }
  if (tickets.open.length && level !== "complete") {
    const worst = tickets.open[0];
    signals.push({
      t: tickets.open.length === 1
        ? "Blocked " + (worst.age?.days ?? 0) + " days: " + worst.text.slice(0, 46) + (worst.text.length > 46 ? "…" : "")
        : tickets.open.length + " open blockers, oldest " + (worst.age?.days ?? 0) + " days",
      hot: tickets.stale.length > 0,
    });
  }
  if (markers.issues.length && level !== "complete") {
    const worst = markers.issues[0];
    signals.push({
      t: markers.issues.length === 1
        ? "Issue after " + (worst.afterLabel || "a phase") + ", " + (worst.age?.days ?? 0) + " days open"
        : markers.issues.length + " unresolved issues between phases",
      hot: markers.stale.length > 0,
    });
  }
  if (reviewModelUnknown(rec) && level !== "complete" && (daysLeft == null || daysLeft > 0))
    signals.push({ t: "Nobody has said who reviews", hot: daysLeft != null && daysLeft <= 21 });
  if (roster && roster.blocked.length && level !== "complete")
    signals.push({
      t: roster.blocked.length + " of " + roster.total + " language pairs have no approved linguist",
      hot: daysLeft != null && daysLeft <= 21,
    });
  if (dueSoon.length && level !== "complete")
    signals.push({ t: dueSoon.length + " due in the next " + DUE_SOON_DAYS + " days", hot: dueSoon[0].d.days <= 1 });
  if (daysLeft != null && level !== "complete")
    signals.push({ t: daysLeft < 0 ? Math.abs(daysLeft) + " days past go-live" : daysLeft + " days to go-live", hot: daysLeft <= 14 });
  signals.push({ t: pct + "% complete · " + done + " of " + total + " steps", hot: false });
  if (drift != null && drift <= -10 && level !== "complete")
    signals.push({ t: Math.abs(drift) + " points behind pace", hot: true });
  if (idle != null && idle >= 7 && level !== "complete")
    signals.push({ t: "No activity for " + idle + " days", hot: idle >= 10 });
  if (missed.length && level !== "complete")
    signals.push({ t: missed.length + " of " + HEALTH_TARGETS.length + " health targets short", hot: missed.length > 3 });
  if (blockers.length)
    signals.push({ t: blockers.length + " step" + (blockers.length > 1 ? "s" : "") + " still open in earlier phases", hot: false });

  return { level, pct, done, total, daysLeft, expected, drift, idle, missed, blockers, signals, overdue, dueSoon, dated, roster, tickets, markers };
}

export const PHASE_COPY = {
  prep: {
    blurb: "We learn your content, your languages, and who's involved — so nothing gets asked twice later.",
    proof: "Your goals, file types, and target locales are written down and agreed.",
  },
  kickoff: {
    blurb: "We walk the plan together and agree what success looks like before any work starts.",
    proof: "A shared definition of done, and a weekly time on the calendar.",
  },
  setup: {
    blurb: "Your workspace, templates, and AI settings get configured around your content — not a generic default.",
    proof: "Your team can log in and start a project without asking us first.",
  },
  integration: {
    blurb: "We connect your source system so content flows in and translated content flows back — no one exporting files by hand.",
    proof: "A change in your system creates a job here, and the finished translation lands back where it belongs.",
  },
  core: {
    blurb: "The everyday path: upload, translate, review, export — plus the translation memory and glossary that make every next project cheaper.",
    proof: "Someone on your team runs a project end-to-end without help.",
  },
  roster: MARKETPLACE_PHASE_COPY,
  uat: {
    blurb: "You run your real content through, not a sample we picked.",
    proof: "You've seen your own file come out the other side and you're happy with it.",
  },
  golive: {
    blurb: "We check the health numbers together and hand you the keys.",
    proof: "Every target below is met, and you've signed off.",
  },
  hyper: {
    blurb: "Thirty days of priority support while your team gets up to speed.",
    proof: "Your account manager takes over and the numbers hold without us.",
  },
};

export const CONTENT_COPY = {
  "e-Learning": {
    blurb: "Your courses keep their structure — SCORM packaging, interactions, and quiz logic survive the round trip.",
    proof: "A translated course imports back into your LMS and still works.",
  },
  "Video & audio": {
    blurb: "Transcription, subtitles, and optional AI dubbing — with timing adjusted so the reading speed still works.",
    proof: "A finished video plays in the target language with subtitles that keep up.",
  },
  "Document & text": {
    blurb: "Nothing extra to set up — the core path already handles 80+ formats end to end.",
    proof: "Covered by the core path.",
  },
};

export const copyFor = (p, cp) =>
  (p.custom ? { blurb: p.blurb || "", proof: p.proof || "" } : p.id === "content" ? CONTENT_COPY[cp] : PHASE_COPY[p.id])
  || { blurb: "", proof: "" };
