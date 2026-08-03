import { test } from "node:test";
import assert from "node:assert/strict";
import {
  traitsOf, scoreSimilarity, pickReferences, formatReferences, editSignal,
  MIN_SCORE, MAX_REFERENCES, EDITED_BONUS,
} from "../lib/corpus.js";

const designed = (over = {}) => ({
  id: over.id || "x",
  customer: over.customer || "Someone",
  phases: over.phases || [{ id: "prep", label: "Discovery", steps: [{ k: "prep-1", t: "Confirm locales" }] }],
  ...over,
});

const adidasLike = {
  contentPath: "e-Learning", delivery: "connected", reviewModel: "hybrid",
  maturity: "mature", specialization: "Retail & e-commerce", industry: "Sportswear",
};

test("an identical customer scores at the ceiling", () => {
  assert.equal(scoreSimilarity(adidasLike, designed(adidasLike)), 100);
});

test("nothing in common scores nothing", () => {
  const opposite = designed({
    contentPath: "Document & text", delivery: "manual", reviewModel: "internal",
    maturity: "greenfield", specialization: "Legal & compliance", industry: "Insurance",
  });
  assert.equal(scoreSimilarity(adidasLike, opposite), 0);
});

test("the structural traits dominate the score", () => {
  const sameStructure = designed({ ...adidasLike, specialization: "Legal & compliance", industry: "Insurance" });
  const sameDomainOnly = designed({
    contentPath: "Document & text", delivery: "manual", reviewModel: "internal", maturity: "greenfield",
    specialization: "Retail & e-commerce", industry: "Sportswear",
  });
  assert.ok(
    scoreSimilarity(adidasLike, sameStructure) > scoreSimilarity(adidasLike, sameDomainOnly),
    "content type, delivery and review model matter more than industry"
  );
});

test("we never match on a trait we do not know", () => {
  const target = { contentPath: "e-Learning" };
  const a = designed({ contentPath: "e-Learning", delivery: "connected" });
  const b = designed({ contentPath: "e-Learning", delivery: "manual" });
  assert.equal(scoreSimilarity(target, a), scoreSimilarity(target, b), "an unknown trait cannot discriminate");
  assert.equal(scoreSimilarity({}, a), 0, "knowing nothing yields no score at all");
});

test("a hand-corrected journey outranks an untouched identical one", () => {
  const untouched = designed({ ...adidasLike, id: "a" });
  const corrected = designed({
    ...adidasLike, id: "b",
    phases: [{ id: "prep", label: "Discovery", steps: [{ k: "prep-1", t: "Confirm the seven priority locales" }] }],
    planOriginal: { phases: [{ id: "prep", label: "Discovery", steps: [{ k: "prep-1", t: "Confirm locales" }] }] },
  });
  assert.ok(editSignal(corrected).edited);
  assert.equal(editSignal(untouched).edited, false);

  const refs = pickReferences(adidasLike, [untouched, corrected]);
  assert.equal(refs[0].id, "b", "the corrected one leads, because the correction is the judgement");
  assert.ok(refs[0].reason.includes("corrected by hand"));
});

test("edit detection counts rewording, removal, and phase changes", () => {
  const before = { phases: [{ id: "prep", steps: [{ t: "a" }, { t: "b" }] }] };
  assert.equal(editSignal({ ...before, planOriginal: before }).changes, 0, "unchanged means unchanged");

  const reworded = { phases: [{ id: "prep", steps: [{ t: "a" }, { t: "b, but better" }] }], planOriginal: before };
  assert.equal(editSignal(reworded).changes, 2, "a reword is one removal plus one addition");

  const phaseAdded = {
    phases: [{ id: "prep", steps: [{ t: "a" }, { t: "b" }] }, { id: "gen-x", steps: [{ t: "c" }] }],
    planOriginal: before,
  };
  assert.ok(editSignal(phaseAdded).changes >= 3, "phase-level edits weigh more than step edits");
});

test("weak matches are filtered out rather than shown as noise", () => {
  const weak = designed({ id: "w", contentPath: "Document & text", delivery: "manual", reviewModel: "internal" });
  const refs = pickReferences(adidasLike, [weak]);
  assert.equal(refs.length, 0, "below MIN_SCORE it is not a reference, it is a distraction");
  assert.ok(MIN_SCORE > 0);
});

test("references are capped and never include the journey being designed", () => {
  const pool = Array.from({ length: 10 }, (_, i) => designed({ ...adidasLike, id: "j" + i, customer: "C" + i }));
  const refs = pickReferences({ ...adidasLike, id: "j3" }, pool);
  assert.ok(refs.length <= MAX_REFERENCES);
  assert.ok(!refs.some((r) => r.id === "j3"), "a journey cannot be its own reference");
});

test("only designed journeys are eligible — template ones have nothing to teach", () => {
  const template = { id: "t", customer: "Template", ...adidasLike };   // no phases array
  assert.equal(pickReferences(adidasLike, [template]).length, 0);
});

test("an empty corpus produces no prompt text at all", () => {
  assert.equal(formatReferences([]), "");
  assert.equal(formatReferences(null), "");
  assert.deepEqual(pickReferences(adidasLike, []), []);
  assert.deepEqual(pickReferences(adidasLike, null), []);
});

test("formatted references carry traits, phases, and the correction note", () => {
  const corrected = designed({
    ...adidasLike, id: "b", customer: "adidas Retail Academy",
    connector: "Cornerstone",
    rationale: "Cornerstone and SCORM integrity dominate this one.",
    phases: [
      { id: "prep", label: "Discovery", week: "Prep", steps: [{ t: "Confirm the seven priority locales" }] },
      { id: "gen-scorm", label: "SCORM integrity QA", week: "Weeks 2-3", custom: true, steps: [{ t: "Validate drag-and-drop survives" }] },
    ],
    planOriginal: { phases: [{ id: "prep", label: "Discovery", steps: [{ t: "Confirm locales" }] }] },
  });
  const text = formatReferences(pickReferences(adidasLike, [corrected]));

  assert.match(text, /adidas Retail Academy/);
  assert.match(text, /Cornerstone/);
  assert.match(text, /SCORM integrity QA/);
  assert.match(text, /\[added for them\]/, "bespoke phases are marked as such");
  assert.match(text, /corrected this journey/, "the model is told a human reviewed it");
  assert.match(text, /Do not copy their phases wholesale/, "and told not to plagiarise the reference");
});

test("garbage never throws", () => {
  for (const junk of [null, undefined, 42, "nope", {}, { phases: "no" }]) {
    assert.doesNotThrow(() => traitsOf(junk));
    assert.doesNotThrow(() => editSignal(junk));
    assert.doesNotThrow(() => scoreSimilarity(junk, junk));
    assert.doesNotThrow(() => pickReferences(junk, [junk]));
    assert.doesNotThrow(() => pickReferences(junk, junk), "a non-array candidate pool must not throw either");
  }
});

// ── Conventions: the whole corpus, as frequencies rather than examples ────
import { commonPatterns, formatPatterns, stepLibrary, MIN_CORPUS_FOR_PATTERNS, CONVENTION_THRESHOLD, PATTERN_FLOOR } from "../lib/corpus.js";

const traits = { contentPath: "e-Learning", delivery: "connected", reviewModel: "hybrid", maturity: "mature" };

const journey = (i, extra = []) => ({
  id: "j" + i, customer: "C" + i, ...traits,
  phases: [
    { id: "prep", label: "Discovery", steps: [{ t: "Confirm target locales" }, { t: "Audit source content" }] },
    { id: "setup", label: "Workspace setup", steps: [{ t: "Provision workspace" }] },
    ...extra,
  ],
});

const lms = [{ id: "gen-lms", label: "LMS integration", steps: [{ t: "Connect the LMS and confirm permissions" }] }];
const journeyWithLms = (i) => journey(i, lms);
const oneOff = [{ id: "gen-x", label: "One-off legal review", steps: [{ t: "Something bespoke" }] }];

test("conventions need a real corpus before they mean anything", () => {
  const few = [journey(1), journey(2), journey(3)];
  const p = commonPatterns(traits, few);
  assert.equal(p.enough, false, "three journeys is a coincidence, not a convention");
  assert.equal(formatPatterns(p), "", "and nothing is put in the prompt");
  assert.ok(MIN_CORPUS_FOR_PATTERNS >= 5);
});

test("a step recurring across most journeys becomes a convention; a one-off does not", () => {
  const pool = [
    ...Array.from({ length: 6 }, (_, i) => approve(journey(i, lms), "Gagan")),
    approve(journey(6, oneOff), "Gagan"),
    approve(journey(7), "Gagan"),
  ];
  const p = commonPatterns(traits, pool);
  assert.equal(p.enough, true);
  assert.equal(p.sampled, 8);

  const labels = p.phases.map((x) => x.label);
  assert.ok(labels.includes("LMS integration"), "6 of 8 is a convention");
  assert.ok(!labels.includes("One-off legal review"), "1 of 8 is one FDE's habit, not a rule");

  const universal = p.steps.find((s) => s.text === "Provision workspace");
  assert.equal(universal.count, 8, "and the frequency is reported, so a rule can be told from a habit");
});

test("only comparable journeys inform conventions", () => {
  const unrelated = Array.from({ length: 8 }, (_, i) => ({
    id: "u" + i, customer: "U" + i,
    contentPath: "Video & audio", delivery: "manual", reviewModel: "internal", maturity: "greenfield",
    phases: [{ id: "prep", label: "Totally different", steps: [{ t: "Something unrelated" }] }],
  }));
  const p = commonPatterns(traits, unrelated.map((u) => approve(u, "Gagan")));
  assert.equal(p.enough, false, "eight dissimilar journeys teach nothing, approved or not");
  assert.ok(PATTERN_FLOOR > 0);
});

test("worked examples stay bounded even when the corpus is large", () => {
  const pool = Array.from({ length: 50 }, (_, i) => approve(journey(i, lms), "Gagan"));
  const refs = pickReferences(traits, pool);
  assert.ok(refs.length <= MAX_REFERENCES, "examples are capped to avoid the model averaging them");

  const p = commonPatterns(traits, pool);
  assert.equal(p.sampled, 50, "but conventions are drawn from every one of them");
});

test("conventions are framed as rules, with their frequency attached", () => {
  const pool = Array.from({ length: 8 }, (_, i) => approve(journey(i, lms), "Gagan"));
  const text = formatPatterns(commonPatterns(traits, pool));
  assert.match(text, /across 8 comparable journeys/);
  assert.match(text, /signed off on/, "the prompt says these came from approved work");
  assert.match(text, /conventions, not suggestions/);
  assert.match(text, /8 of 8/, "frequency is shown so weight can be judged");
  assert.match(text, /Provision workspace/);
});

test("the step library is the team's vocabulary, most-used first", () => {
  const pool = [...Array.from({ length: 5 }, (_, i) => journey(i, lms)), journey(9, oneOff)];
  const lib = stepLibrary(pool);
  assert.equal(lib[0].count, 6, "the most-used phrasing leads");
  assert.ok(lib.some((s) => s.text === "Something bespoke"), "rare phrasings are still available");
  assert.ok(lib.every((s, i) => i === 0 || lib[i - 1].count >= s.count), "sorted by use");
});

test("pattern extraction survives garbage", () => {
  for (const junk of [null, undefined, 42, [null, "x", {}], [{ phases: "no" }]]) {
    assert.doesNotThrow(() => commonPatterns(traits, junk));
    assert.doesNotThrow(() => stepLibrary(junk));
    assert.equal(commonPatterns(traits, junk).enough, false);
  }
});

// ── Approval: the feedback loop ───────────────────────────────────────────
import { isApproved, approve, unapprove, trustBonus, APPROVED_BONUS } from "../lib/corpus.js";

test("approval is explicit, reversible, and records who and when", () => {
  const draft = designed({ id: "d" });
  assert.equal(isApproved(draft), false, "nothing is approved by default");

  const ok = approve(draft, "Gagan");
  assert.equal(isApproved(ok), true);
  assert.equal(ok.approval.by, "Gagan");
  assert.match(ok.approval.at, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(isApproved(unapprove(ok)), false, "sign-off can be withdrawn");
});

test("trust stacks: approved beats corrected beats untouched", () => {
  const raw = designed({ id: "raw" });
  const edited = designed({
    id: "e",
    phases: [{ id: "prep", label: "Discovery", steps: [{ k: "prep-1", t: "Confirm the seven locales" }] }],
    planOriginal: { phases: [{ id: "prep", label: "Discovery", steps: [{ k: "prep-1", t: "Confirm locales" }] }] },
  });
  assert.equal(trustBonus(raw), 0);
  assert.equal(trustBonus(edited), EDITED_BONUS);
  assert.equal(trustBonus(approve(raw)), APPROVED_BONUS);
  assert.equal(trustBonus(approve(edited)), EDITED_BONUS + APPROVED_BONUS, "both signals count");
  assert.ok(APPROVED_BONUS > EDITED_BONUS, "a signature outweighs an edit");
});

test("similarity and trust are separate, so neither disappears at the ceiling", () => {
  const identical = { ...adidasLike };
  const raw = designed({ id: "raw", ...identical });
  const ok = approve(designed({ id: "ok", ...identical }), "Gagan");

  assert.equal(scoreSimilarity(adidasLike, raw), 100);
  assert.equal(scoreSimilarity(adidasLike, ok), 100, "trust must not inflate a similarity score");

  const refs = pickReferences(adidasLike, [raw, ok]);
  assert.equal(refs[0].id, "ok", "but it must still decide the order");
  assert.ok(refs[0].rank > refs[1].rank);
  assert.equal(refs[0].score, refs[1].score, "with identical similarity underneath");
});

test("conventions come only from approved journeys", () => {
  const drafts = Array.from({ length: 8 }, (_, i) => journeyWithLms(i));
  const p = commonPatterns(traits, drafts);
  assert.equal(p.enough, false, "eight unapproved drafts define nothing");
  assert.equal(p.sampled, 0, "and none of them are even counted");
  assert.equal(p.needed, MIN_CORPUS_FOR_PATTERNS, "the shortfall is reported so the UI can explain it");

  const signed = drafts.map((d) => approve(d, "Gagan"));
  const q = commonPatterns(traits, signed);
  assert.equal(q.enough, true);
  assert.equal(q.sampled, 8);
});

test("a mixed pool counts only the signed-off half", () => {
  const pool = [
    ...Array.from({ length: 5 }, (_, i) => approve(journeyWithLms(i), "Gagan")),
    ...Array.from({ length: 5 }, (_, i) => journeyWithLms(i + 10)),
  ];
  const p = commonPatterns(traits, pool);
  assert.equal(p.sampled, 5, "the five drafts are ignored entirely");
  assert.equal(p.enough, true);
});

test("approval is visible in the reason line, so the FDE can see why it ranked", () => {
  const ok = approve(designed({ id: "ok", ...adidasLike }), "Gagan");
  const refs = pickReferences(adidasLike, [ok]);
  assert.ok(refs[0].approved);
  assert.match(refs[0].reason, /approved/);
});
