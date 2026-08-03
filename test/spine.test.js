import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceJourneyPlan, ANCHOR_IDS, MAX_PHASES, MAX_STEPS_PER_PHASE, MAX_STEPS_TOTAL, derivePerson } from "../lib/spine.js";
import { buildJourney, progressOf, assess } from "../lib/journey.js";

const ids = (plan) => plan.phases.map((p) => p.id);

test("the six gates always exist, even when the model omits every one", () => {
  const plan = coerceJourneyPlan({ phases: [{ label: "Just do the thing" }] });
  for (const id of ANCHOR_IDS) assert.ok(ids(plan).includes(id), id + " must be present");
  assert.ok(plan.generatedNotes.some((n) => /missing and has been added back/.test(n)), "and it must say it intervened");
});

test("the gates keep their order no matter what order the model returns them in", () => {
  const plan = coerceJourneyPlan({
    phases: [{ id: "hyper" }, { id: "golive" }, { id: "uat" }, { id: "setup" }, { id: "kickoff" }, { id: "prep" }],
  });
  assert.deepEqual(ids(plan), ANCHOR_IDS, "reversed input still comes out in methodology order");
});

test("generated phases land between setup and UAT", () => {
  const plan = coerceJourneyPlan({
    phases: [
      { id: "prep" }, { id: "kickoff" }, { id: "setup" },
      { label: "Cornerstone integration", steps: [{ text: "Connect the LMS" }] },
      { label: "SCORM integrity QA", steps: [{ text: "Check interactions survive" }] },
      { id: "uat" }, { id: "golive" }, { id: "hyper" },
    ],
  });
  const order = ids(plan);
  assert.ok(order.indexOf("gen-cornerstone-integration") > order.indexOf("setup"));
  assert.ok(order.indexOf("gen-scorm-integrity-qa") < order.indexOf("uat"));
  assert.equal(plan.phases.filter((p) => p.custom).length, 2);
});

test("an anchor cannot be duplicated to smuggle in extra required phases", () => {
  const plan = coerceJourneyPlan({
    phases: [{ id: "golive", label: "Go-live" }, { id: "golive", label: "Go-live again" }],
  });
  assert.equal(ids(plan).filter((i) => i === "golive").length, 1);
});

test("two different documents produce genuinely different journeys", () => {
  const simple = coerceJourneyPlan({
    phases: ANCHOR_IDS.map((id) => ({ id, steps: [{ text: "do a thing" }] })),
  });
  const complex = coerceJourneyPlan({
    phases: [
      ...ANCHOR_IDS.slice(0, 3).map((id) => ({ id, steps: [{ text: "do a thing" }] })),
      { label: "Cornerstone integration", steps: [{ text: "a" }, { text: "b" }, { text: "c" }] },
      { label: "SCORM integrity QA", steps: [{ text: "a" }, { text: "b" }] },
      { label: "TMX validation", steps: [{ text: "a" }] },
      ...ANCHOR_IDS.slice(3).map((id) => ({ id, steps: [{ text: "do a thing" }] })),
    ],
  });
  assert.equal(simple.phases.length, 6);
  assert.equal(complex.phases.length, 9);
  assert.ok(
    progressOf(buildJourney({ phases: complex.phases })).total >
    progressOf(buildJourney({ phases: simple.phases })).total,
    "the complex engagement must cost more steps"
  );
});

test("runaway output is capped", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    label: "Phase " + i,
    steps: Array.from({ length: 30 }, (_, j) => ({ text: "step " + j })),
  }));
  const plan = coerceJourneyPlan({ phases: many });
  assert.ok(plan.phases.length <= MAX_PHASES);
  assert.ok(plan.phases.every((p) => p.steps.length <= MAX_STEPS_PER_PHASE));
  assert.ok(plan.phases.reduce((n, p) => n + p.steps.length, 0) <= MAX_STEPS_TOTAL);
});

test("step keys are stable, so due dates and overrides survive", () => {
  const input = { phases: [{ id: "prep", steps: [{ text: "Confirm locales" }, { text: "Chase the TMX" }] }] };
  const a = coerceJourneyPlan(input);
  const b = coerceJourneyPlan(input);
  assert.deepEqual(
    a.phases[0].steps.map((s) => s.k),
    b.phases[0].steps.map((s) => s.k),
    "the same plan must key identically both times"
  );

  const rec = { phases: a.phases, dueDates: { "prep-2": "2026-07-01" }, overrides: { "prep-1": "done" } };
  const built = buildJourney(rec).find((p) => p.id === "prep");
  assert.equal(built.items[0].s, "done", "an override lands on the right step");
  assert.equal(built.items[1].due, "2026-07-01", "so does a due date");
});

test("an invalid status falls back to open rather than claiming work is finished", () => {
  const plan = coerceJourneyPlan({
    phases: [{ id: "prep", steps: [{ text: "x", status: "finished-ish" }, { text: "y", status: "done" }] }],
  });
  assert.equal(plan.phases[0].steps[0].status, "open");
  assert.equal(plan.phases[0].steps[1].status, "done");
});

test("owners named in a document become renderable people", () => {
  const plan = coerceJourneyPlan({
    phases: [{ id: "prep", steps: [{ text: "Chase the agency", owner: "Sofia Lindqvist" }] }],
  });
  const pid = plan.phases[0].steps[0].who[0];
  assert.ok(pid, "the step has an owner id");
  assert.equal(plan.people[pid].name, "Sofia Lindqvist");
  assert.equal(plan.people[pid].initials, "SL");
  assert.ok(/^#/.test(plan.people[pid].color), "and a colour to render with");
});

test("the same name always gets the same colour", () => {
  assert.equal(derivePerson("Tobias Krenz").color, derivePerson("Tobias Krenz").color);
  assert.equal(derivePerson(""), null, "an empty name yields nothing at all");
});

test("garbage from the model still yields a usable journey", () => {
  for (const junk of [null, undefined, "nope", 42, { phases: "not an array" }, { phases: [null, 7, "x"] }]) {
    const plan = coerceJourneyPlan(junk);
    assert.equal(plan.phases.length, 6, "the six gates, with their standard steps");
    assert.ok(progressOf(buildJourney({ phases: plan.phases })).total > 0, "and it is not empty");
  }
});

test("a generated journey works with the risk engine unchanged", () => {
  const plan = coerceJourneyPlan({
    stage: "kickoff",
    phases: [
      { id: "prep", steps: [{ text: "Confirm locales", owner: "Marike", status: "done" }] },
      { id: "kickoff", steps: [{ text: "Agree success criteria", owner: "Marike", status: "active" }] },
      { label: "Cornerstone integration", steps: [{ text: "Connect the LMS", owner: "Rahul" }] },
    ],
  });
  const rec = {
    id: "adidas", customer: "adidas Retail Academy", phases: plan.phases, people: plan.people,
    stage: plan.stage, startDate: "2026-07-14", goLiveDate: "2026-08-01",
    lastActivityDate: "2026-07-25", health: [0, 0, 0, 0, 0, 0],
    dueDates: { "kickoff-1": "2026-07-10" },
  };
  const a = assess(rec, buildJourney(rec));
  assert.equal(a.level, "at_risk", "a generated journey is assessed by exactly the same rules");
  assert.equal(a.overdue.length, 1);
  assert.equal(a.overdue[0].owners[0], "Marike", "and the owner resolves from the document");
});
