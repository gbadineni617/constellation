import { stagesFor as checklistStages } from "./checklist.js";
/**
 * The spine.
 *
 * A generated journey is not a blank slate. These six phases are gates in the
 * onboarding methodology — you cannot onboard an enterprise customer without
 * discovery, a kickoff, workspace setup, customer-run UAT, a go-live check and
 * a hypercare window. The model may add phases, retitle these, and write their
 * steps, but it cannot delete them and it cannot reorder them.
 *
 * Everything interesting happens in the middle: between SETUP and UAT the model
 * is free to invent whatever the document actually calls for.
 */

/**
 * Conditional gate. Only exists when the customer is using Marketplace linguists,
 * but when it does exist it is as non-negotiable as the rest: you cannot sign off
 * go-live on a locale whose reviewer nobody has approved.
 */
export const ROSTER_ANCHOR = {
  id: "roster",
  label: "Linguist roster",
  week: "Weeks 2-3",
  surface: "marketplace",
  blurb: "We find the linguists, they prove themselves on a paid trial, and you decide who works on your content. Nobody is assigned to you sight-unseen.",
  proof: "Every language pair in scope has a linguist you have personally approved.",
};

export const ANCHORS = [
  {
    id: "prep",
    label: "Discovery",
    week: "Prep",
    surface: "demo",
    blurb: "We learn your content, your languages, and who's involved — so nothing gets asked twice later.",
    proof: "Your goals, file types, and target locales are written down and agreed.",
  },
  {
    id: "kickoff",
    label: "Kickoff",
    week: "Week 1",
    surface: "demo",
    blurb: "We walk the plan together and agree what success looks like before any work starts.",
    proof: "A shared definition of done, and a weekly time on the calendar.",
  },
  {
    id: "setup",
    label: "Workspace setup",
    week: "Week 1",
    surface: "workspace",
    blurb: "Your workspace, templates, and AI settings get configured around your content — not a generic default.",
    proof: "Your team can log in and start a project without asking us first.",
  },
  {
    id: "uat",
    label: "UAT",
    week: "Week 3",
    surface: "translations",
    blurb: "You run your real content through, not a sample we picked.",
    proof: "You've seen your own file come out the other side and you're happy with it.",
  },
  {
    id: "golive",
    label: "Go-live",
    week: "Week 4",
    surface: "reporting",
    blurb: "We check the health numbers together and hand you the keys.",
    proof: "Every target is met, and you've signed off.",
  },
  {
    id: "hyper",
    label: "Hypercare",
    week: "Day 1-30",
    surface: "demo",
    blurb: "Thirty days of priority support while your team gets up to speed.",
    proof: "Your account manager takes over and the numbers hold without us.",
  },
];

export const ANCHOR_IDS = ANCHORS.map((a) => a.id);

/** Where a generated phase is allowed to sit: the open stretch in the middle. */
export const BODY_AFTER = "setup";
export const BODY_BEFORE = "uat";

/** Fallback steps, used when the model returns an anchor with nothing in it. */
const ANCHOR_FALLBACK_STEPS = {
  roster: ["Confirm quality tier and turnaround per locale", "Scope language pairs and expected volume", "Smartcat sources candidate linguists", "Run a paid trial per language pair", "Approve the roster", "Attach approved linguists to workflow templates"],
  prep: ["Goals & primary use case", "Content & file types", "Languages / locales", "Existing TMs, glossaries & style guides", "Who's involved"],
  kickoff: ["Welcome, goals & success criteria", "Confirm the plan and the phases", "Set a weekly cadence"],
  setup: ["Workspace provisioning", "Smartwords allocation", "Project & assignment templates", "AI translation profile"],
  uat: ["Run your real content end-to-end", "Check output quality and formatting", "Run a project yourself between sessions", "Confirm the run meets your acceptance criteria"],
  golive: ["Confirm health metrics meet targets", "Walk Enterprise Reports as your live dashboard", "Confirm go-live & sign off"],
  hyper: ["Account manager becomes main contact", "30-day priority support as you ramp", "Re-check health metrics before hypercare closes"],
};

export const MAX_PHASES = 14;
export const MAX_STEPS_PER_PHASE = 12;
export const MAX_STEPS_TOTAL = 90;
export const STATUSES = ["open", "active", "done", "na"];

const AVATAR_PALETTE = ["#8B6DFF", "#2DD4BF", "#F5B544", "#F471B5", "#6A4DFF", "#4ADE80"];

const clean = (v, max = 400) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "x";

/** Stable, deterministic colour so the same person is always the same colour. */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Turn a name found in a document into something the avatar component can render. */
export function derivePerson(name) {
  const n = clean(name, 60);
  if (!n) return null;
  const words = n.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  const initials = (words.slice(0, 2).map((w) => w[0]).join("") || n.slice(0, 2)).toUpperCase();
  return { name: n, initials, color: AVATAR_PALETTE[hash(n) % AVATAR_PALETTE.length] };
}

/**
 * Take whatever the model returned and turn it into a journey plan the app can
 * trust: anchors guaranteed present and in order, ids stable, statuses valid,
 * everything capped and sanitised. This is the reason a generated journey is
 * still defensible to whoever owns the methodology.
 */
/**
 * The stages a generated journey must contain, for a given tier.
 *
 * Previously a fixed six, inferred from one account. Now taken from the real
 * checklist, so "you cannot drop a required stage" means the actual
 * methodology rather than my guess at it.
 */
function requiredStages(opts) {
  const stages = checklistStages({
    tier: opts.tier || "enterprise",
    contentPath: opts.contentPath || "Document & text",
    connected: opts.connected,
    sourcing: opts.reviewModel === "marketplace" || opts.reviewModel === "hybrid",
    session3: opts.session3,
  });
  return stages.map((st) => ({
    id: st.id,
    label: st.label,
    week: st.week,
    surface: st.surface,
    blurb: st.blurb,
    proof: st.proof,
    optional: Boolean(st.optional),
    fallbackSteps: (st.groups || []).flatMap((g) => (g.items || []).map((i) => i.t)),
  }));
}

export function coerceJourneyPlan(raw, opts = {}) {
  const r = raw && typeof raw === "object" ? raw : {};
  const notes = [];
  const ANCHORS_FOR_TIER = requiredStages(opts);

  // Marketplace turns the roster phase into a required gate for this journey
  // The roster stage is already included by the checklist when sourcing applies,
  // so nothing extra to splice in here.
  const anchors = ANCHORS_FOR_TIER;
  const anchorIds = anchors.map((a) => a.id);

  const proposed = Array.isArray(r.phases) ? r.phases : [];
  if (!proposed.length) notes.push("The model returned no phases, so the standard path was used.");

  const people = {};
  const seenIds = new Set();
  let stepBudget = MAX_STEPS_TOTAL;

  const takePhase = (p, anchor) => {
    // The checklist's name wins for a known stage. The model was renaming
    // "Getting started — before kickoff" to "Discovery" and "Kickoff" to
    // "Solution-Design Workshop" — reasonable names, but not the ones on the
    // spreadsheet an FDE and the customer are both looking at. A stage the model
    // adds keeps whatever it called it.
    const label = anchor ? anchor.label : clean(p?.label, 60) || "Phase";
    let id = anchor ? anchor.id : "gen-" + slug(label);
    while (seenIds.has(id)) id = id + "x";
    seenIds.add(id);

    const rawSteps = Array.isArray(p?.steps) ? p.steps.slice(0, MAX_STEPS_PER_PHASE) : [];
    const steps = [];

    for (const [i, st] of rawSteps.entries()) {
      if (stepBudget <= 0) break;
      const text = clean(typeof st === "string" ? st : st?.text, 220);
      if (!text) continue;

      const owners = [];
      const rawOwners = typeof st === "object" && st ? [].concat(st.owner || st.owners || []) : [];
      for (const o of rawOwners.slice(0, 2)) {
        const person = derivePerson(o);
        if (!person) continue;
        const pid = slug(person.name);
        people[pid] = person;
        owners.push(pid);
      }

      const status = STATUSES.includes(typeof st === "object" ? st?.status : null) ? st.status : "open";

      steps.push({
        k: id + "-" + (i + 1),          // stable forever: dates and overrides key off this
        t: text,
        note: clean(typeof st === "object" ? st?.note : "", 220),
        who: owners,
        status,
        // Why the model believes this is already done. A claim about completed
        // work must be traceable to the sentence that justified it — an FDE
        // confirms these before they are committed.
        evidence: status === "done" || status === "active"
          ? clean(typeof st === "object" ? st?.evidence : "", 220)
          : "",
      });
      stepBudget--;
    }

    if (!steps.length && anchor) {
      // A stage the model returned empty falls back to the checklist's own
      // steps, not to a paraphrase of them.
      (anchor.fallbackSteps || []).forEach((t, i) => {
        if (stepBudget <= 0) return;
        steps.push({ k: id + "-" + (i + 1), t, note: "", who: [], status: "open" });
        stepBudget--;
      });
      notes.push("Phase \u201c" + label + "\u201d came back empty, so the standard steps were used.");
    }

    return {
      id,
      label,
      week: anchor?.week || clean(p?.week, 24) || "TBC",
      surface: ["workspace", "translations", "demo"].includes(p?.surface) ? p.surface : anchor?.surface || "workspace",
      // Blurb and proof are the opposite case: the checklist has generic copy,
      // and the model's version is written for this customer. Model wins here.
      blurb: clean(p?.blurb, 400) || anchor?.blurb || "",
      proof: clean(p?.proof, 300) || anchor?.proof || "",
      custom: !anchor,
      steps,
    };
  };

  // Match each proposed phase to an anchor if it claims one
  const byAnchor = new Map();
  const body = [];
  for (const p of proposed.slice(0, MAX_PHASES)) {
    const claimed = anchorIds.includes(clean(p?.id, 40)) ? clean(p.id, 40) : null;
    if (claimed && !byAnchor.has(claimed)) byAnchor.set(claimed, p);
    else if (!claimed) body.push(p);
  }

  // Anchors always exist, in canonical order, whether the model returned them or not
  const built = [];
  for (const a of anchors) {
    if (a.id === BODY_BEFORE) {
      for (const p of body) built.push(takePhase(p, null));
      body.length = 0;
    }
    if (!byAnchor.has(a.id)) notes.push("Required phase \u201c" + a.label + "\u201d was missing and has been added back.");
    built.push(takePhase(byAnchor.get(a.id) || {}, a));
  }
  for (const p of body) built.push(takePhase(p, null));   // anything left over

  // A generated phase that ended up with no steps is noise, not methodology.
  // Anchors are exempt: they always keep their fallback steps.
  const kept = built.filter((p) => !p.custom || p.steps.length > 0);

  const stage = anchorIds.includes(clean(r.stage, 40)) || kept.some((b) => b.id === clean(r.stage, 40))
    ? clean(r.stage, 40)
    : "prep";

  const phases = kept.slice(0, MAX_PHASES);

  // Everything the model claims is already finished or underway, with its
  // justification. Nothing here is trusted until a human says so — marking UAT
  // complete when it is not says a customer signed off when they did not, which
  // is worse than starting from zero.
  const claims = phases.flatMap((p) =>
    p.steps
      .filter((st) => st.status === "done" || st.status === "active")
      .map((st) => ({
        k: st.k,
        phase: p.label,
        phaseId: p.id,
        text: st.t,
        status: st.status,
        evidence: st.evidence || "",
      }))
  );

  return {
    phases,
    people,
    stage,
    generatedNotes: notes,
    rationale: clean(r.rationale, 600),
    claims,
    // A claim with nothing behind it is the one to look at hardest
    unevidenced: claims.filter((c) => !c.evidence).length,
  };
}
