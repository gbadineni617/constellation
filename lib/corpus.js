/**
 * The corpus.
 *
 * Institutional memory, not model training. Claude accumulates nothing between
 * calls — so when a new document arrives we retrieve the most comparable past
 * journeys and put them in the prompt as worked examples. Every onboarding the
 * team runs makes the next generation better, and nothing is fine-tuned.
 *
 * Retrieval is deliberately categorical rather than embedding-based. Similarity
 * between onboardings really is discrete — an e-Learning engagement through a
 * connector with hybrid review resembles another one of those. A WHERE clause
 * captures that, costs nothing, and can be explained to the person reading the
 * output. Vector search earns its keep at a few hundred documents with free-text
 * similarity that metadata cannot express; `pgvector` slots in behind
 * findReferences() when that day comes.
 */

/** The dimensions we match on, and what each is worth. */
export const TRAIT_WEIGHTS = {
  contentPath: 30,     // biggest structural driver
  delivery: 25,        // a connector changes the whole middle of the path
  reviewModel: 20,     // decides whether sourcing exists at all
  maturity: 10,
  specialization: 10,
  industry: 5,
};

/**
 * How many full journeys to show as worked examples.
 *
 * Not limited by context window — six outlines is a couple of thousand tokens.
 * Limited by dilution: past a handful the model averages the examples and output
 * regresses toward their mean instead of reflecting the closest match. Two strong
 * references beat ten mediocre ones.
 *
 * The whole corpus still contributes — through commonPatterns() below, which is
 * statistics rather than examples and therefore has no ceiling.
 */
export const MAX_REFERENCES = 6;
export const MIN_SCORE = 35;          // below this, a reference is noise
export const EDITED_BONUS = 15;       // human-corrected journeys are worth more
export const APPROVED_BONUS = 30;     // an approved one is worth more still

/**
 * Approval is the feedback loop, and it works like a translation memory: you do
 * not reuse unapproved segments. An FDE signing off on a journey is the moment it
 * becomes trustworthy enough to teach the next one.
 *
 * Consequence, and it is deliberate: conventions are drawn from approved journeys
 * ONLY. If nothing is approved, the system claims no conventions at all rather
 * than inferring them from drafts nobody has checked.
 */
export const isApproved = (rec) => rec?.approval?.state === "approved";

export function approve(rec, by) {
  return {
    ...rec,
    approval: { state: "approved", by: by || "", at: new Date().toISOString().slice(0, 10) },
  };
}

export function unapprove(rec) {
  return { ...rec, approval: { ...(rec?.approval || {}), state: "draft" } };
}

export function traitsOf(rec) {
  if (!rec) return {};
  return {
    contentPath: rec.contentPath || "",
    delivery: rec.delivery || "",
    reviewModel: rec.reviewModel || "",
    maturity: rec.maturity || "",
    specialization: rec.specialization || "",
    industry: rec.industry || "",
  };
}

const norm = (s) => String(s || "").trim().toLowerCase();

/**
 * How much did a human change after generation? This is the most valuable signal
 * in the system: a journey the FDE rewrote encodes judgment the model did not have.
 */
export function editSignal(rec) {
  const now = rec?.phases;
  const then = rec?.planOriginal?.phases;
  if (!Array.isArray(now) || !Array.isArray(then)) return { edited: false, changes: 0 };

  const flat = (ps) => ps.flatMap((p) => (p.steps || []).map((s) => p.id + "|" + norm(s.t)));
  const a = new Set(flat(then));
  const b = new Set(flat(now));

  let changes = 0;
  for (const k of b) if (!a.has(k)) changes++;      // added or reworded
  for (const k of a) if (!b.has(k)) changes++;      // removed
  changes += Math.abs(now.length - then.length) * 2; // phase-level edits count double

  return { edited: changes > 0, changes };
}

/** 0-100. Shared traits score their weight; blanks on either side score nothing. */
export function scoreSimilarity(target, candidate) {
  const t = traitsOf(target);
  const c = traitsOf(candidate);
  let score = 0;
  let possible = 0;

  for (const [k, w] of Object.entries(TRAIT_WEIGHTS)) {
    if (!t[k]) continue;                 // we cannot match on what we do not know
    possible += w;
    if (norm(t[k]) === norm(c[k])) score += w;
  }
  if (!possible) return 0;

  // Pure trait match. Trust is a separate axis — see trustBonus() — because
  // folding them together and clamping to 100 made both invisible once a
  // candidate matched on every trait.
  return Math.round((score / possible) * 100);
}

/**
 * How much this journey has earned. Similarity says "is this comparable"; trust
 * says "is this worth copying". A hand-corrected journey carries an FDE's
 * judgement; an approved one carries their signature.
 */
export function trustBonus(rec) {
  let bonus = 0;
  if (editSignal(rec).edited) bonus += EDITED_BONUS;
  if (isApproved(rec)) bonus += APPROVED_BONUS;
  return bonus;
}

/**
 * Pick the references worth showing the model. Returns them scored and with a
 * plain-English reason, so the UI can say why each one was chosen.
 */
export function pickReferences(target, candidates, limit = MAX_REFERENCES) {
  const t = traitsOf(target);

  const scored = (Array.isArray(candidates) ? candidates : [])
    .filter((c) => c && c.id !== target?.id)
    .filter((c) => Array.isArray(c.phases) && c.phases.length)   // only real designed journeys
    .map((c) => {
      const score = scoreSimilarity(target, c);
      const shared = Object.keys(TRAIT_WEIGHTS).filter((k) => t[k] && norm(t[k]) === norm(traitsOf(c)[k]));
      const edit = editSignal(c);
      const trust = trustBonus(c);
      return {
        id: c.id,
        customer: c.customer,
        score,
        rank: score + trust,
        trust,
        shared,
        edited: edit.edited,
        changes: edit.changes,
        approved: isApproved(c),
        reason:
          (shared.length ? shared.map((k) => traitsOf(c)[k]).join(" · ") : "loosely comparable") +
          (edit.edited ? " · corrected by hand" : "") +
          (isApproved(c) ? " · approved" : ""),
        rec: c,
      };
    })
    .filter((x) => x.score >= MIN_SCORE)
    // Similarity gets a journey onto the shortlist; trust decides the order.
    .sort((a, b) => b.rank - a.rank || b.changes - a.changes);

  return scored.slice(0, limit);
}

/**
 * Condense chosen references into prompt text. Outlines only — full step detail
 * would crowd out the document we are actually reading.
 */
export function formatReferences(refs) {
  if (!refs?.length) return "";

  const blocks = refs.map((r, i) => {
    const rec = r.rec;
    const traits = [rec.contentPath, rec.maturity, rec.delivery === "connected" ? "connected: " + (rec.connector || "yes") : "manual upload", rec.reviewModel]
      .filter(Boolean).join(", ");

    const phases = (rec.phases || []).map((p) => {
      const tag = p.custom ? " [added for them]" : "";
      const steps = (p.steps || []).slice(0, 4).map((s) => "      - " + s.t).join("\n");
      return "    " + p.label + " (" + (p.week || "?") + ")" + tag + "\n" + steps;
    }).join("\n");

    return [
      "### Reference " + (i + 1) + ": " + rec.customer,
      "Traits: " + traits,
      rec.rationale ? "Why their path looked like this: " + rec.rationale : "",
      r.edited ? "An FDE corrected this journey after it was generated, so it reflects real judgement." : "",
      "Phases:",
      phases,
    ].filter(Boolean).join("\n");
  });

  return [
    "",
    "## Comparable journeys already built by this team",
    "",
    "These are real onboardings for similar customers. Match their level of specificity and their phrasing — this is how this team writes a journey. Do not copy their phases wholesale; the document you are reading describes a different customer.",
    "",
    blocks.join("\n\n"),
    "",
  ].join("\n");
}


/* ────────────────────────────────────────────────────────────
   Communal, and rigid.
   Every comparable journey contributes here, not just the closest few.
   These are frequencies computed in code — reproducible, unbounded, and
   immune to the dilution that limits worked examples.
   ──────────────────────────────────────────────────────────── */

/** Below this many comparable journeys, frequencies are noise, not convention. */
export const MIN_CORPUS_FOR_PATTERNS = 5;

/** A step or phase must appear this often to count as something the team always does. */
export const CONVENTION_THRESHOLD = 0.6;

/** Only journeys at least this similar inform conventions for a given target. */
export const PATTERN_FLOOR = 30;

const normalise = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * What does this team consistently do for customers like this one?
 *
 * Returns phase labels and step phrasings that recur across comparable journeys,
 * with the frequency behind each. The frequency matters: "in 23 of 23" is a
 * convention, "in 4 of 23" is one FDE's habit.
 */
export function commonPatterns(target, candidates) {
  const pool = (Array.isArray(candidates) ? candidates : [])
    .filter((c) => c && c.id !== target?.id)
    .filter((c) => Array.isArray(c.phases) && c.phases.length)
    .filter(isApproved)          // unapproved drafts do not get to define conventions
    .map((c) => ({ rec: c, score: scoreSimilarity(target, c) }))
    .filter((x) => x.score >= PATTERN_FLOOR)
    .map((x) => x.rec);

  if (pool.length < MIN_CORPUS_FOR_PATTERNS) {
    return {
      enough: false,
      sampled: pool.length,
      needed: MIN_CORPUS_FOR_PATTERNS,
      phases: [],
      steps: [],
    };
  }

  const phaseHits = new Map();   // label -> { label, count }
  const stepHits = new Map();    // text  -> { text, phase, count }

  for (const rec of pool) {
    const seenPhase = new Set();
    const seenStep = new Set();

    for (const p of rec.phases) {
      const pk = normalise(p.label);
      if (pk && !seenPhase.has(pk)) {
        seenPhase.add(pk);
        const e = phaseHits.get(pk) || { label: p.label, count: 0 };
        e.count++;
        phaseHits.set(pk, e);
      }
      for (const st of p.steps || []) {
        const sk = normalise(st.t);
        if (!sk || seenStep.has(sk)) continue;
        seenStep.add(sk);
        const e = stepHits.get(sk) || { text: st.t, phase: p.label, count: 0 };
        e.count++;
        stepHits.set(sk, e);
      }
    }
  }

  const min = Math.ceil(pool.length * CONVENTION_THRESHOLD);
  const rank = (a, b) => b.count - a.count || a.text?.localeCompare?.(b.text) || 0;

  return {
    enough: true,
    sampled: pool.length,
    needed: MIN_CORPUS_FOR_PATTERNS,
    phases: [...phaseHits.values()].filter((x) => x.count >= min).sort(rank),
    steps: [...stepHits.values()].filter((x) => x.count >= min).sort(rank).slice(0, 40),
  };
}

/**
 * Every distinct step phrasing the team has used, most-used first. This is the
 * vocabulary — the model should reach for these words before inventing its own.
 */
export function stepLibrary(candidates, limit = 60) {
  const hits = new Map();
  for (const rec of Array.isArray(candidates) ? candidates : []) {
    if (!Array.isArray(rec?.phases)) continue;
    for (const p of rec.phases) {
      for (const st of p.steps || []) {
        const k = normalise(st.t);
        if (!k) continue;
        const e = hits.get(k) || { text: st.t, count: 0 };
        e.count++;
        hits.set(k, e);
      }
    }
  }
  return [...hits.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** Conventions as prompt text. Deliberately framed as rules, not suggestions. */
export function formatPatterns(patterns) {
  if (!patterns?.enough) return "";
  const { sampled, phases, steps } = patterns;
  if (!phases.length && !steps.length) return "";

  const freq = (c) => c + " of " + sampled;
  const out = [
    "",
    "## What this team always does for customers like this",
    "",
    "Measured across " + sampled + " comparable journeys this team has delivered and signed off on. These are conventions, not suggestions — use this wording unless the document actively contradicts it.",
    "",
  ];

  if (phases.length) {
    out.push("Phases that recur:");
    for (const p of phases) out.push("- " + p.label + "  (" + freq(p.count) + ")");
    out.push("");
  }
  if (steps.length) {
    out.push("Steps that recur, with the team's own phrasing:");
    for (const s of steps) out.push('- "' + s.text + '"  (' + freq(s.count) + ", usually in " + s.phase + ")");
    out.push("");
  }
  return out.join("\n");
}
