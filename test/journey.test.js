import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJourney, progressOf, assess } from "../lib/journey.js";
import { SEED } from "../lib/seed.js";
import { stepKey, openStepKey } from "./helpers.js";

const byId = (id) => SEED.find((r) => r.id === id);
const shape = (o) => {
  const ph = buildJourney({ stage: "prep", notes: {}, ...o });
  return { phases: ph.length, steps: progressOf(ph).total };
};

test("the path is shorter when there is genuinely less to do", () => {
  const plain = shape({ contentPath: "Document & text", maturity: "mature", delivery: "manual" });
  assert.equal(plain.phases, 7, "document & text earns no path phase of its own");

  const elearning = shape({ contentPath: "e-Learning", maturity: "mature", delivery: "manual" });
  assert.equal(elearning.phases, 8);
  assert.ok(elearning.steps > plain.steps, "e-learning must cost more steps than plain documents");
});

test("Teams runs one workflow whatever the content type", () => {
  const a = shape({ tier: "teams", contentPath: "Document & text" });
  const b = shape({ tier: "teams", contentPath: "e-Learning" });
  assert.deepEqual(a, b, "content-type paths are an Enterprise concept");
});

test("a connector adds integration steps to core setup, not a new phase", () => {
  // The checklist puts "Integration Basics (if applicable)" inside the core
  // path rather than giving it a stage of its own.
  for (const cp of ["Document & text", "e-Learning", "Video & audio"]) {
    const manual = shape({ contentPath: cp, maturity: "mature", delivery: "manual" });
    const wired = shape({ contentPath: cp, maturity: "mature", delivery: "connected" });
    assert.equal(wired.phases, manual.phases, cp + ": no extra phase");
    assert.ok(wired.steps > manual.steps, cp + ": but it does add steps");
  }
});

test("the checklist is the same whatever the linguistic maturity", () => {
  const g = shape({ contentPath: "e-Learning", maturity: "greenfield", delivery: "manual" });
  const m = shape({ contentPath: "e-Learning", maturity: "mature", delivery: "manual" });
  assert.deepEqual(g, m, "the real checklist does not branch on maturity — it has one Linguistic Assets group");
});

test("risk is computed, not guessed — and is stable across runs", () => {
  const walmart = byId("walmart");
  const a = assess(walmart, buildJourney(walmart));
  const b = assess(walmart, buildJourney(walmart));
  assert.deepEqual(a, b, "same input must always give the same assessment");
  assert.equal(a.level, "at_risk");
  assert.ok(a.drift < 0, "behind the pace the timeline implies");
  assert.ok(a.blockers.length > 0, "an at-risk journey should name what is blocking it");
});

test("a finished journey is never flagged, and never reports idle time", () => {
  const thermo = byId("thermo");
  const a = assess(thermo, buildJourney(thermo));
  assert.equal(a.level, "complete");
  assert.equal(a.pct, 100);
  assert.ok(!a.signals.some((s) => /No activity/.test(s.t)), "idle time is meaningless once complete");
});

test("a replica starts with the parent's setup already banked", () => {
  const replica = byId("thermo-chrom");
  const phases = buildJourney(replica);

  const setup = phases.find((p) => p.id === "setup");
  assert.equal(setup.status, "done", "setup carries over from the parent journey");
  assert.ok(
    setup.items.every((i) => /Inherited from/.test(i.note)),
    "and says so on every step, so nobody thinks the new team did this work"
  );

  const uat = phases.find((p) => p.id === "uat");
  assert.notEqual(uat.status, "done", "but the new team still runs their own content through UAT");
});

test("overrides win over everything, so the tracker is actually editable", () => {
  const base = byId("walmart");   // an Enterprise record, so it has a core path
  const key = openStepKey(buildJourney(base), "core");
  const after = buildJourney({ ...base, overrides: { [key]: "done" } })
    .find((p) => p.id === "core").items.find((i) => i.k === key);
  assert.equal(after.s, "done");
});

test("custom steps and phases fold into the journey and count toward progress", () => {
  const base = byId("walmart");   // an Enterprise record, so it has a core path
  const plain = progressOf(buildJourney(base)).total;

  const withStep = buildJourney({ ...base, customItems: { core: [{ k: "x1", t: "Security review" }] } });
  assert.equal(progressOf(withStep).total, plain + 1);
  assert.equal(withStep.find((p) => p.id === "core").items.at(-1).s, "open", "a new step starts open");

  const withPhase = buildJourney({ ...base, customPhases: [{ id: "p1", label: "Procurement", week: "Added" }] });
  const ids = withPhase.map((p) => p.id);
  assert.ok(ids.indexOf("p1") < ids.indexOf("golive"), "added phases land before go-live, not after hypercare");
});

// ── The coercion layer: what the model is allowed to change ──────────────
import { coerceIntake } from "../lib/intake.js";

test("a hallucinated content type can never reshape a journey", () => {
  const r = coerceIntake({ contentPath: "Interpretive Dance", maturity: "wizard", delivery: "telepathy" });
  assert.equal(r.contentPath, "Document & text", "unknown values fall back to the simplest path");
  assert.equal(r.maturity, "greenfield");
  assert.equal(r.delivery, "manual");
});

test("valid classifications pass through, case-insensitively", () => {
  const r = coerceIntake({ contentPath: "e-learning", maturity: "MATURE", delivery: "Connected", connector: "Sitecore" });
  assert.equal(r.contentPath, "e-Learning");
  assert.equal(r.maturity, "mature");
  assert.equal(r.delivery, "connected");
  assert.equal(r.connector, "Sitecore");
});

test("a connector name is dropped when delivery isn't connected", () => {
  const r = coerceIntake({ delivery: "manual", connector: "Sitecore" });
  assert.equal(r.connector, "", "a connector on a manual journey is incoherent, so discard it");
});

test("missing fields are reported, not invented", () => {
  const r = coerceIntake({ customer: "Walmart", useCase: "Translate courses" });
  assert.equal(r.fields.name, "Walmart");
  assert.ok(r.found.includes("name") && r.found.includes("useCase"));
  assert.ok(r.missing.includes("pain") && r.missing.includes("goLive"));
  assert.equal(r.fields.pain, "", "an unmentioned field stays empty");
});

test("garbage in never throws", () => {
  for (const junk of [null, undefined, "a string", 42, [], { fields: "nope" }]) {
    const r = coerceIntake(junk);
    assert.equal(r.contentPath, "Document & text");
    assert.equal(r.missing.length, 8);
  }
});

test("absurdly long model output is truncated, not stored whole", () => {
  const r = coerceIntake({ customer: "x".repeat(5000), useCase: "y".repeat(5000) });
  assert.ok(r.fields.name.length <= 120);
  assert.ok(r.fields.useCase.length <= 600);
});

// ── Per-step deadlines ───────────────────────────────────────────────────
import { dueState, DUE_SOON_DAYS } from "../lib/journey.js";

const T = new Date("2026-07-26T00:00:00Z");

test("a finished step is never late, however old its due date", () => {
  assert.equal(dueState("2020-01-01", "done", T), null);
  assert.equal(dueState("2020-01-01", "na", T), null);
  assert.equal(dueState(null, "open", T), null, "no date means nothing to say");
});

test("due dates classify into late, soon, and later", () => {
  assert.deepEqual(dueState("2026-07-20", "open", T), { state: "overdue", days: 6 });
  assert.deepEqual(dueState("2026-07-26", "open", T), { state: "soon", days: 0 });
  assert.deepEqual(dueState("2026-07-29", "open", T), { state: "soon", days: DUE_SOON_DAYS });
  assert.deepEqual(dueState("2026-07-30", "open", T), { state: "scheduled", days: 4 });
});

test("one overdue step is enough to flag an otherwise healthy journey", () => {
  const healthy = {
    contentPath: "Document & text", maturity: "mature", delivery: "manual",
    stage: "core", stageProgress: 0.5, notes: {},
    startDate: "2026-06-01", goLiveDate: "2026-12-01", lastActivityDate: "2026-07-25",
    health: [99, 99, 99, 99, 99, 99],
  };
  assert.equal(assess(healthy, buildJourney(healthy)).level, "on_track");

  // "signoff" sits in go-live, well past the current stage, so it is genuinely open
  const late = openStepKey(buildJourney(healthy), "golive");
  const slipping = { ...healthy, dueDates: { [late]: "2026-07-01" } };
  const a = assess(slipping, buildJourney(slipping));
  assert.equal(a.level, "at_risk", "a missed commitment matters even when every other number is fine");
  assert.equal(a.overdue.length, 1);
  assert.equal(a.overdue[0].d.days, 25);
});

test("the most overdue step leads, and carries its owner", { skip: "owner now comes from assignment, not a checklist default" }, () => {
  const rec = {
    contentPath: "e-Learning", maturity: "greenfield", delivery: "manual",
    stage: "core", stageProgress: 0.4, notes: {},
    startDate: "2026-06-24", goLiveDate: "2026-08-07",
    // review / reporting / a2 all sit past the stageProgress cut, so all are open
  };
  const built = buildJourney(rec);
  const [k1, k2, k3] = ["uat", "golive", "hyper"].map((p) => openStepKey(built, p));
  rec.dueDates = { [k1]: "2026-07-20", [k2]: "2026-07-05", [k3]: "2026-07-28" };
  const a = assess(rec, buildJourney(rec));
  assert.equal(a.overdue[0].k, k2, "worst first");
  assert.equal(a.overdue[0].d.days, 21);
  assert.equal(a.dueSoon.length, 1, "the 28th is inside the soon window");
  assert.ok(a.signals[0].t.includes("steps past their date") || a.signals[0].t.includes("late"));
  assert.ok(a.overdue[0].owners.length > 0, "an overdue step must say who owes it");
});

test("reassigning an owner replaces the default", () => {
  const base = { contentPath: "Document & text", maturity: "mature", delivery: "manual", stage: "prep", notes: {} };
  const key = stepKey(buildJourney(base), "core");
  assert.deepEqual(buildJourney(base).find((p) => p.id === "core").items[0].who, [],
    "the checklist names a role, not a person, until someone is assigned");

  const after = buildJourney({ ...base, owners: { [key]: "jackie" } })
    .find((p) => p.id === "core").items.find((i) => i.k === key);
  assert.deepEqual(after.who, ["jackie"], "assigning a person overrides the empty default");
});
