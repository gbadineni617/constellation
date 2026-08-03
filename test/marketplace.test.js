import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJourney, progressOf, assess } from "../lib/journey.js";
import { coerceJourneyPlan } from "../lib/spine.js";
import { coercePairs, rosterState, usesMarketplace, reviewModelUnknown, MAX_PAIRS, PAIR_STATE_IDS } from "../lib/marketplace.js";
import { coerceIntake } from "../lib/intake.js";
import { SEED } from "../lib/seed.js";

const base = {
  contentPath: "Document & text", maturity: "mature", delivery: "manual",
  stage: "core", stageProgress: 0.5, notes: {},
  startDate: "2026-06-20", goLiveDate: "2026-09-20", lastActivityDate: "2026-07-25",
  health: [99, 99, 99, 99, 99, 99],
};

test("marketplace adds a sourcing phase; internal review does not", () => {
  const internal = buildJourney({ ...base, reviewModel: "internal" });
  const market = buildJourney({ ...base, reviewModel: "marketplace" });
  const hybrid = buildJourney({ ...base, reviewModel: "hybrid" });

  assert.ok(!internal.some((p) => p.id === "roster"), "no roster phase when their own people review");
  assert.ok(market.some((p) => p.id === "roster"));
  assert.ok(hybrid.some((p) => p.id === "roster"), "hybrid still needs linguists sourced");
  assert.equal(market.length, internal.length + 1);
  assert.ok(progressOf(market).total > progressOf(internal).total);
});

test("marketplace adds a go-live gate that internal review does not have", () => {
  const gate = (rm) =>
    buildJourney({ ...base, reviewModel: rm })
      .find((p) => p.id === "golive").items.some((i) => i.k === "gl_roster");
  assert.equal(gate("marketplace"), true, "you cannot sign off with unstaffed locales");
  assert.equal(gate("internal"), false);
});

test("the roster phase sits before UAT — you cannot validate with nobody hired", () => {
  const ids = buildJourney({ ...base, reviewModel: "marketplace" }).map((p) => p.id);
  assert.ok(ids.indexOf("roster") < ids.indexOf("uat"));
  assert.ok(ids.indexOf("roster") > ids.indexOf("setup"));
});

test("pair coercion rejects junk, duplicates, and same-language pairs", () => {
  const pairs = coercePairs([
    { source: "en-GB", target: "de-DE" },
    { source: "en-GB", target: "de-DE" },      // duplicate
    { source: "EN-gb", target: "DE-de" },      // duplicate, different case
    { source: "en-GB", target: "en-GB" },      // same language
    { source: "not a locale!", target: "de-DE" },
    { source: "en-GB", target: "" },
    { source: "en-GB", target: "fr-CA", certification: "Interpretive Dance" },
    { source: "en-GB", target: "ja-JP", state: "definitely-hired" },
    { source: "en-GB", target: "ko-KR", reviewers: 9999 },
  ]);
  assert.equal(pairs.length, 4, "only the four real, distinct pairs survive");
  assert.equal(pairs.find((p) => p.target === "fr-CA").certification, "None", "an unknown certification is discarded");
  assert.equal(pairs.find((p) => p.target === "ja-JP").state, "scoping", "an unknown state falls back to the start");
  assert.equal(pairs.find((p) => p.target === "ko-KR").reviewers, 20, "reviewer count is clamped");
});

test("pair lists are capped", () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ source: "en", target: "x" + i }));
  assert.ok(coercePairs(many).length <= MAX_PAIRS);
  assert.deepEqual(coercePairs(null), []);
  assert.deepEqual(coercePairs("nope"), []);
});

test("roster readiness counts approved pairs, not an average of progress", () => {
  const rec = {
    ...base, reviewModel: "marketplace",
    pairs: coercePairs([
      { source: "en", target: "de", state: "active" },
      { source: "en", target: "fr", state: "approved" },
      { source: "en", target: "ja", state: "trial" },
      { source: "en", target: "ko", state: "sourcing" },
    ]),
  };
  const r = rosterState(rec);
  assert.equal(r.ready, 2);
  assert.equal(r.blocked.length, 2);
  assert.equal(r.pct, 50);
  assert.equal(r.complete, false);
  assert.deepEqual(r.blocked.map((p) => p.target), ["ja", "ko"]);
});

test("two unstaffed locales flag an otherwise healthy journey near go-live", () => {
  const pairs = coercePairs([
    { source: "en", target: "de", state: "active" },
    { source: "en", target: "el", state: "trial" },
  ]);
  const far = assess({ ...base, reviewModel: "marketplace", pairs }, buildJourney({ ...base, reviewModel: "marketplace", pairs }));
  assert.equal(far.level, "on_track", "months out, sourcing in progress is fine");

  const near = { ...base, reviewModel: "marketplace", pairs, goLiveDate: "2026-08-05" };
  const a = assess(near, buildJourney(near));
  assert.equal(a.level, "at_risk", "two weeks out with an unstaffed locale is not fine");
  assert.ok(a.signals.some((s) => /no approved linguist/.test(s.t)));
});

test("a fully approved roster raises no signal", () => {
  const pairs = coercePairs([
    { source: "en", target: "de", state: "active" },
    { source: "en", target: "fr", state: "approved" },
  ]);
  const rec = { ...base, reviewModel: "marketplace", pairs, goLiveDate: "2026-08-05" };
  const a = assess(rec, buildJourney(rec));
  assert.equal(a.roster.complete, true);
  assert.ok(!a.signals.some((s) => /no approved linguist/.test(s.t)));
});

test("roster is null when marketplace is not in play, so nothing false is reported", () => {
  const rec = { ...base, reviewModel: "internal", pairs: [] };
  assert.equal(assess(rec, buildJourney(rec)).roster, null);
  assert.equal(usesMarketplace(rec), false);
});

test("a generated journey gets the roster gate injected when marketplace applies", () => {
  const proposed = { phases: [{ id: "prep" }, { id: "kickoff" }, { id: "setup" }, { id: "uat" }, { id: "golive" }, { id: "hyper" }] };

  const withMp = coerceJourneyPlan(proposed, { reviewModel: "hybrid" });
  assert.ok(withMp.phases.some((p) => p.id === "roster"), "the model cannot skip it");
  assert.ok(withMp.generatedNotes.some((n) => /Linguist roster/.test(n)), "and it says it intervened");

  const withoutMp = coerceJourneyPlan(proposed, { reviewModel: "internal" });
  assert.ok(!withoutMp.phases.some((p) => p.id === "roster"), "and does not invent it when it does not apply");
});

test("no seeded record claims Marketplace, because none of their source material said so", () => {
  for (const r of SEED) {
    assert.ok(
      !usesMarketplace(r),
      r.customer + " must not assert a Marketplace engagement that its notes never mentioned"
    );
    assert.equal((r.pairs || []).length, 0, r.customer + " must not carry invented language pairs");
  }
});

test("silence is recorded as unknown, never as internal", () => {
  const silent = coerceIntake({ customer: "Someone" });
  assert.equal(silent.reviewModel, "unknown", "an unstated review model is not a claim of internal review");
  assert.equal(silent.specialization, "", "and no domain is guessed either");
  assert.deepEqual(silent.pairs, []);
  assert.ok(reviewModelUnknown({ reviewModel: silent.reviewModel }));
  assert.ok(reviewModelUnknown({}), "a record with no field at all is also unknown");
});

test("an unknown review model adds no phase, but is reported as a gap", () => {
  const rec = { ...base, reviewModel: "unknown" };
  const j = buildJourney(rec);
  assert.ok(!j.some((p) => p.id === "roster"), "unknown must not conjure a sourcing phase");
  assert.ok(!j.find((p) => p.id === "golive").items.some((i) => i.k === "gl_roster"), "nor a gate");

  const a = assess(rec, j);
  assert.equal(a.roster, null);
  assert.ok(a.signals.some((s) => /who reviews/.test(s.t)), "but the absence is surfaced, not swallowed");
});

test("the gap becomes urgent as go-live approaches", () => {
  const far = assess({ ...base, reviewModel: "unknown" }, buildJourney({ ...base, reviewModel: "unknown" }));
  assert.equal(far.signals.find((s) => /who reviews/.test(s.t)).hot, false);

  const near = { ...base, reviewModel: "unknown", goLiveDate: "2026-08-05" };
  assert.equal(assess(near, buildJourney(near)).signals.find((s) => /who reviews/.test(s.t)).hot, true);
});

test("marketplace still works when a document does establish it", () => {
  const pairs = coercePairs([
    { source: "en-GB", target: "ja-JP", state: "sourcing" },
    { source: "en-GB", target: "ko-KR", state: "trial" },
    { source: "en-GB", target: "de-DE", state: "active" },
  ]);
  const rec = { ...base, reviewModel: "hybrid", pairs, goLiveDate: "2026-08-05" };
  const j = buildJourney(rec);
  assert.ok(j.some((p) => p.id === "roster"), "an explicit hybrid engagement gets its phase");
  const a = assess(rec, j);
  assert.equal(a.roster.ready, 1);
  assert.equal(a.roster.blocked.length, 2);
  assert.equal(a.level, "at_risk");
  assert.ok(!a.signals.some((s) => /who reviews/.test(s.t)), "and the unknown-gap signal is gone");
});

test("every pair state is reachable by cycling, so the UI cannot get stuck", () => {
  let state = "scoping";
  const seen = new Set([state]);
  for (let i = 0; i < PAIR_STATE_IDS.length; i++) {
    state = PAIR_STATE_IDS[(PAIR_STATE_IDS.indexOf(state) + 1) % PAIR_STATE_IDS.length];
    seen.add(state);
  }
  assert.equal(seen.size, PAIR_STATE_IDS.length);
});
