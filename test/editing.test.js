import { test } from "node:test";
import assert from "node:assert/strict";
import { buildJourney, progressOf, assess } from "../lib/journey.js";
import { coerceJourneyPlan } from "../lib/spine.js";
import { openStepKey } from "./helpers.js";

const template = {
  contentPath: "e-Learning", maturity: "mature", delivery: "manual", reviewModel: "internal",
  stage: "core", stageProgress: 0.4, notes: {},
};

const generated = () => {
  const plan = coerceJourneyPlan({
    phases: [
      { id: "prep", label: "Discovery", steps: [{ text: "Confirm locales" }, { text: "Audit content" }] },
      { id: "uat", label: "UAT", steps: [{ text: "Run real content" }, { text: "Check quality" }] },
    ],
  });
  return { phases: plan.phases, stage: "prep", notes: {} };
};

test("a step can be renamed, in a template journey", () => {
  const before = buildJourney(template).find((p) => p.id === "uat");
  const key = before.items[0].k;

  const after = buildJourney({ ...template, renames: { [key]: "Run the fr-CA legal module end to end" } })
    .find((p) => p.id === "uat");
  assert.equal(after.items[0].t, "Run the fr-CA legal module end to end");
  assert.equal(after.items[0].renamed, true, "so the UI can show it was changed");
});

test("a step can be renamed, in a generated journey", () => {
  const rec = generated();
  const key = rec.phases[0].steps[0].k;
  const after = buildJourney({ ...rec, renames: { [key]: "Confirm the eight priority locales" } })
    .find((p) => p.id === "prep");
  assert.equal(after.items[0].t, "Confirm the eight priority locales");
});

test("renaming keeps everything keyed off the step", () => {
  const before = buildJourney(template).find((p) => p.id === "uat");
  const key = before.items[0].k;

  const rec = {
    ...template,
    renames: { [key]: "Renamed" },
    dueDates: { [key]: "2026-08-01" },
    owners: { [key]: "jackie" },
    overrides: { [key]: "done" },
  };
  const it = buildJourney(rec).find((p) => p.id === "uat").items[0];

  assert.equal(it.t, "Renamed");
  assert.equal(it.due, "2026-08-01", "the due date survives a rename");
  assert.deepEqual(it.who, ["jackie"], "so does the owner");
  assert.equal(it.s, "done", "and the status");
});

test("a step can be removed, including from a required phase", () => {
  const before = buildJourney(template);
  const uat = before.find((p) => p.id === "uat");
  const total = progressOf(before).total;

  const after = buildJourney({ ...template, removedSteps: [uat.items[1].k, uat.items[2].k] });
  assert.equal(progressOf(after).total, total - 2);
  assert.equal(after.find((p) => p.id === "uat").items.length, uat.items.length - 2);
  assert.ok(after.some((p) => p.id === "uat"), "removing steps does not remove the phase");
});

test("a removed step stops counting toward progress", () => {
  const uat = buildJourney(template).find((p) => p.id === "uat");
  const open = uat.items.find((i) => i.s === "open");

  const before = progressOf(buildJourney(template));
  const after = progressOf(buildJourney({ ...template, removedSteps: [open.k] }));
  assert.equal(after.total, before.total - 1);
  assert.ok(after.pct >= before.pct, "removing outstanding work cannot make progress look worse");
});

test("a removed step takes its blocker and its overdue flag with it", () => {
  const uat = buildJourney(template).find((p) => p.id === "uat");
  const key = uat.items[0].k;

  const rec = {
    ...template,
    startDate: "2026-06-01", goLiveDate: "2026-12-01", lastActivityDate: "2026-07-25",
    health: [99, 99, 99, 99, 99, 99],
    dueDates: { [key]: "2026-01-01" },
    tickets: [{ id: "t1", stepKey: key, state: "open", text: "Blocked on legal", at: "2026-06-01" }],
  };
  assert.equal(assess(rec, buildJourney(rec)).level, "at_risk", "while it exists, it is a problem");

  const gone = { ...rec, removedSteps: [key] };
  const a = assess(gone, buildJourney(gone));
  assert.equal(a.overdue.length, 0, "a step that is not in the journey cannot be late");
  assert.equal(a.tickets.open.length, 0, "and its blocker goes with it");
});

test("a phase can be renamed, including a required one", () => {
  const after = buildJourney({ ...template, phaseRenames: { uat: "Pilot & acceptance" } });
  const phase = after.find((p) => p.id === "uat");
  assert.equal(phase.label, "Pilot & acceptance");
  assert.ok(after.some((p) => p.id === "golive"), "the rest of the spine is untouched");
});

test("renaming a phase does not change its id, so the spine still recognises it", () => {
  const ids = buildJourney({ ...template, phaseRenames: { uat: "Anything", golive: "Launch day" } }).map((p) => p.id);
  assert.deepEqual(ids, buildJourney(template).map((p) => p.id), "ids are structural and must not move");
});

test("edits to one journey never leak into another", () => {
  const key = openStepKey(buildJourney(template), "uat");
  const edited = buildJourney({ ...template, phaseRenames: { uat: "Pilot" }, removedSteps: [key] });
  const clean = buildJourney(template);
  assert.match(clean.find((p) => p.id === "uat").label, /^UAT/);
  assert.ok(clean.find((p) => p.id === "uat").items.some((i) => i.k === key));
  assert.notEqual(edited.find((p) => p.id === "uat").label, "UAT");
});

test("removing every step leaves the phase present but empty", () => {
  const uat = buildJourney(template).find((p) => p.id === "uat");
  const after = buildJourney({ ...template, removedSteps: uat.items.map((i) => i.k) });
  const phase = after.find((p) => p.id === "uat");
  assert.equal(phase.items.length, 0);
  assert.equal(phase.status, "open", "an empty required phase is not silently complete");
});
