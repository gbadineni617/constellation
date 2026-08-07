import { test } from "node:test";
import assert from "node:assert/strict";
import {
  phasesFor, stagesFor, sequenceState, canConfirm, resolveTier,
  TIERS, TIER_IDS, GATES, HEALTH_METRICS, CONTENT_PATHS, CONTENT_PATH_IDS,
} from "../lib/checklist.js";
import { buildJourney, progressOf } from "../lib/journey.js";
import { coerceJourneyPlan } from "../lib/spine.js";

test("the two tiers are genuinely different paths, not one filtered", () => {
  const teams = phasesFor({ tier: "teams" });
  const ent = phasesFor({ tier: "enterprise" });

  assert.equal(teams.length, 6);
  assert.equal(ent.length, 7, "Document & text drops the content-type phase");

  const teamsLabels = teams.map((p) => p.label);
  const entLabels = ent.map((p) => p.label);
  assert.equal(teamsLabels.filter((l) => entLabels.includes(l)).length, 0,
    "no stage label is shared — these are different methodologies, not subsets");
});

test("Teams is session-based, Enterprise is week-based", () => {
  assert.ok(phasesFor({ tier: "teams" }).some((p) => /^Session 1/.test(p.label)));
  assert.ok(phasesFor({ tier: "enterprise" }).some((p) => p.week === "Weeks 2–3"));
});

test("the wording is verbatim from the checklists", () => {
  const teams = phasesFor({ tier: "teams" }).flatMap((p) => p.steps.map((s) => s.t));
  // Lines an FDE would recognise word for word from the spreadsheet.
  for (const line of [
    "Create a real project with your file",
    "Assign a linguist / reviewer",
    "Run AI translation, then review & QA in the editor",
    "Add your Smartwords (your translation credits)",
    "Session 3 needed?  (Yes / No)",
  ]) {
    assert.ok(teams.includes(line), "Teams is missing the exact line: " + line);
  }

  const ent = phasesFor({ tier: "enterprise" }).flatMap((p) => p.steps.map((s) => s.t));
  for (const line of [
    "Train a backup admin (avoid key-person risk)",
    "Review your 3-Phase Customer Value Map — goals, success metrics & roadmap",
    "Read Enterprise Reports (your live dashboard)",
    "Confirm SSO is in or out of scope (Support & Infrastructure handle setup)",
  ]) {
    assert.ok(ent.includes(line), "Enterprise is missing the exact line: " + line);
  }
});

test("the focus topics from Session 3 are present exactly", () => {
  const s3 = phasesFor({ tier: "teams" }).find((p) => /Session 3/.test(p.label));
  const topics = s3.steps.map((s) => s.t);
  for (const t of [
    "Linguistic assets (TM / glossary / style guide)",
    "Reviewer / editor training",
    "AI Agents — capabilities & use",
    "Workflow templates & automation",
  ]) {
    assert.ok(topics.includes(t), "missing focus topic: " + t);
  }
});

test("Session 3 is optional and can be declined", () => {
  assert.equal(phasesFor({ tier: "teams" }).length, 6, "included by default — it has not been declined");
  assert.equal(phasesFor({ tier: "teams", session3: false }).length, 5, "declining it removes the stage");
  assert.ok(phasesFor({ tier: "teams" }).find((p) => /Session 3/.test(p.label)).optional);
});

test("all eight content-type paths exist, with their real wording", () => {
  assert.equal(CONTENT_PATH_IDS.length, 8);
  for (const id of ["Website", "Software / app localization", "Video & audio", "e-Learning",
                    "Image translation", "Design (Figma)", "Google Drive"]) {
    assert.ok(CONTENT_PATHS[id], "missing path: " + id);
    assert.ok(CONTENT_PATHS[id].items.length > 0, id + " has no steps");
  }
  assert.equal(CONTENT_PATHS["Document & text"].items.length, 0,
    "Document & text is covered by the core path, so it earns no phase");
});

test("a content-type path adds a phase; Document & text does not", () => {
  const plain = phasesFor({ tier: "enterprise", contentPath: "Document & text" });
  const figma = phasesFor({ tier: "enterprise", contentPath: "Design (Figma)" });
  assert.equal(figma.length, plain.length + 1);
  assert.match(figma.find((p) => /Figma/.test(p.label)).label, /^Path: Design/);
});

test("integration items appear only when something is connected", () => {
  const off = phasesFor({ tier: "enterprise", connected: false });
  const on = phasesFor({ tier: "enterprise", connected: true });
  const has = (ps) => ps.flatMap((p) => p.steps.map((s) => s.t)).includes("Test file sync / import");
  assert.equal(has(off), false);
  assert.equal(has(on), true);
  assert.equal(on.length, off.length, "it adds steps to core setup, not a new phase");
});

test("content paths are Enterprise only — Teams has no content-type phase", () => {
  const teams = phasesFor({ tier: "teams", contentPath: "e-Learning" });
  assert.ok(!teams.some((p) => /^Path:/.test(p.label)),
    "Teams runs the same workflow whatever the content type");
});

test("every stage with a gate carries its sign-off as a step", () => {
  for (const tier of TIER_IDS) {
    const phases = phasesFor({ tier });
    for (const gate of GATES[tier]) {
      const stage = phases.find((p) => p.id === gate.stage);
      if (!stage) continue;   // hyper has two gates on one stage
      assert.ok(stage.steps.some((s) => s.signoff),
        tier + "/" + gate.stage + " is a gate but has no sign-off step");
    }
  }
});

test("all thirteen health metrics are present with their targets", () => {
  assert.equal(HEALTH_METRICS.length, 13);
  const byKey = Object.fromEntries(HEALTH_METRICS.map((m) => [m.k, m.target]));
  assert.equal(byKey["TM attached to projects"], 80);
  assert.equal(byKey["Projects reach 100% completion"], 90);
  assert.equal(byKey["Active use cases"], 3);
  assert.equal(byKey["TM leverage"], 30);
  assert.ok(HEALTH_METRICS.find((m) => m.k.includes("YouTrack")).lowerIsBetter,
    "zero tickets is the target, so more is worse");
});

test("tier names from a document map onto a tier", () => {
  assert.equal(resolveTier("Teams"), "teams");
  assert.equal(resolveTier("accelerate plan"), "teams");
  assert.equal(resolveTier("Enterprise"), "enterprise");
  assert.equal(resolveTier("Autonomous+"), "enterprise");
  assert.equal(resolveTier("Business"), "enterprise");
  assert.equal(resolveTier(""), "enterprise", "unknown defaults to the fuller path");
  assert.equal(resolveTier(null), "enterprise");
});

test("step keys are stable across rebuilds, so dates and owners survive", () => {
  const a = phasesFor({ tier: "enterprise" }).flatMap((p) => p.steps.map((s) => s.k));
  const b = phasesFor({ tier: "enterprise" }).flatMap((p) => p.steps.map((s) => s.k));
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length, "and they are unique");
  assert.ok(a.every((k) => /^[a-z0-9_-]+__[a-z0-9-]+$/.test(k)), "derived from stage and text, not position");
});

// ── Sequencing ────────────────────────────────────────────────────────────
const fresh = (tier = "enterprise") =>
  phasesFor({ tier }).map((p) => ({ ...p, steps: p.steps.map((s) => ({ ...s, s: "open" })) }));

const complete = (phases, index) =>
  phases.map((p, i) => (i <= index ? { ...p, steps: p.steps.map((s) => ({ ...s, s: "done" })) } : p));

test("on a fresh journey only the first stage can be confirmed", () => {
  const phases = fresh();
  const state = sequenceState(phases);
  assert.equal(state.get(phases[0].steps[0].k).locked, false);
  assert.equal(state.get(phases[1].steps[0].k).locked, true);
  assert.equal(state.get(phases[4].steps[0].k).locked, true);
});

test("a locked step names what is blocking it", () => {
  const phases = fresh();
  const blocked = sequenceState(phases).get(phases[2].steps[0].k);
  assert.equal(blocked.blockedBy, phases[0].label,
    "a disabled checkbox with no explanation is worse than none");
});

test("completing a stage unlocks the next one, and only the next one", () => {
  const phases = complete(fresh(), 0);
  const state = sequenceState(phases);
  assert.equal(state.get(phases[1].steps[0].k).locked, false, "the next stage opens");
  assert.equal(state.get(phases[2].steps[0].k).locked, true, "the one after does not");
});

test("the whole map stays visible even when locked", () => {
  const phases = fresh();
  assert.equal(phases.length, 7, "every stage is present regardless of sequencing");
  assert.ok(phases.every((p) => p.steps.length > 0), "and every stage still shows its steps");
});

test("an optional step does not block the stage", () => {
  const phases = fresh("teams");
  const prep = phases[0];
  const optional = prep.steps.find((s) => s.optional);
  assert.ok(optional, "prep has an optional multi-team item");

  // everything except the optional one is done
  const almost = phases.map((p, i) =>
    i === 0 ? { ...p, steps: p.steps.map((s) => ({ ...s, s: s.optional ? "open" : "done" })) } : p
  );
  assert.equal(sequenceState(almost).get(phases[1].steps[0].k).locked, false,
    "an optional item left open must not hold up the journey");
});

test("an N/A step counts as settled", () => {
  const phases = fresh();
  const withNa = phases.map((p, i) =>
    i === 0 ? { ...p, steps: p.steps.map((s, j) => ({ ...s, s: j === 0 ? "na" : "done" })) } : p
  );
  assert.equal(sequenceState(withNa).get(phases[1].steps[0].k).locked, false);
});

test("canConfirm answers the same question more directly", () => {
  const phases = fresh();
  assert.equal(canConfirm(phases, phases[0].steps[0].k), true);
  assert.equal(canConfirm(phases, phases[3].steps[0].k), false);
  assert.equal(canConfirm(phases, "no-such-step"), true, "an unknown key is not blocked");
});

test("buildJourney uses the checklist for a template journey", () => {
  const j = buildJourney({ tier: "teams", contentPath: "Document & text", delivery: "manual", stage: "prep", notes: {} });
  assert.equal(j.length, 6);
  assert.equal(j[0].label, "Before kickoff");
  assert.ok(j[2].items.some((i) => i.t === "Create a real project with your file"));
  assert.ok(progressOf(j).total > 40);
});

test("a step carries its owner role and its group from the checklist", () => {
  const j = buildJourney({ tier: "enterprise", contentPath: "Document & text", delivery: "manual", stage: "prep", notes: {} });
  const step = j[0].items[0];
  assert.equal(step.role, "customer");
  assert.equal(step.group, "What to share");

  const smartcatStep = j[0].items.find((i) => i.t === "Workspace provisioning");
  assert.equal(smartcatStep.role, "smartcat");
  assert.equal(smartcatStep.group, "What Smartcat does");
});

// ── Tier extraction ───────────────────────────────────────────────────────
import { coerceIntake } from "../lib/intake.js";

test("a tier named in a document is carried through", () => {
  assert.equal(coerceIntake({ tier: "teams" }).tier, "teams");
  assert.equal(coerceIntake({ tier: "Accelerate" }).tier, "teams");
  assert.equal(coerceIntake({ tier: "Enterprise" }).tier, "enterprise");
  assert.equal(coerceIntake({ tier: "Autonomous+" }).tier, "enterprise");
});

test("an unknown tier defaults to enterprise, the fuller path", () => {
  assert.equal(coerceIntake({}).tier, "enterprise",
    "removing steps is safer than discovering missing ones");
  assert.equal(coerceIntake({ tier: "platinum" }).tier, "enterprise");
});

test("the two tiers really do produce different work", () => {
  const teams = buildJourney({ tier: "teams", contentPath: "Document & text", delivery: "manual", stage: "prep", notes: {} });
  const ent = buildJourney({ tier: "enterprise", contentPath: "Document & text", delivery: "manual", stage: "prep", notes: {} });
  assert.ok(progressOf(ent).total > progressOf(teams).total * 1.4,
    "Enterprise is substantially more work — 80 items against 53");
});

// ── The checklist as the generation structure ─────────────────────────────
import { checklistPrompt, remapToTier } from "../lib/checklist.js";

test("the prompt hands over the real checklist, stage by stage", () => {
  const p = checklistPrompt({ tier: "enterprise", contentPath: "e-Learning", connected: true });
  assert.equal((p.match(/### Stage/g) || []).length, 8, "every stage is named");
  assert.match(p, /Train a backup admin \(avoid key-person risk\)/, "with its real steps");
  assert.match(p, /Use it as your structure/, "and told to adapt rather than invent");
  assert.match(p, /Do not drop a stage/);
});

test("the prompt differs by tier, because the methodologies do", () => {
  const teams = checklistPrompt({ tier: "teams" });
  const ent = checklistPrompt({ tier: "enterprise" });
  assert.match(teams, /Session 2 — Hands-on Translation/);
  assert.match(ent, /Core path — Required/);
  assert.ok(!teams.includes("Core path — Required"));
  assert.ok(!ent.includes("Session 2 — Hands-on Translation"));
});

test("switching tier re-maps rather than discarding the journey", () => {
  const phases = phasesFor({ tier: "enterprise", contentPath: "e-Learning" });
  phases[0].steps[0].status = "done";

  const out = remapToTier({ phases, contentPath: "e-Learning", delivery: "manual" }, "teams");
  assert.equal(out.phases.length, 6, "it becomes the Teams checklist");
  assert.ok(out.carried > 0, "and shared steps carry their status across");
});

test("bespoke work survives a tier switch", () => {
  const phases = phasesFor({ tier: "enterprise", contentPath: "e-Learning" });
  phases[3].steps.push({ k: "core__validate-arabic-rtl", t: "Validate Arabic RTL layout", added: true, status: "open" });

  const out = remapToTier({ phases, contentPath: "e-Learning", delivery: "manual" }, "teams");
  assert.ok(
    out.phases.some((p) => p.steps.some((s) => /Arabic RTL/.test(s.t))),
    "an added step has no counterpart in the other checklist, so it must be carried explicitly"
  );
});

test("anything that cannot be carried is reported, not silently dropped", () => {
  const phases = phasesFor({ tier: "enterprise" });
  const out = remapToTier({ phases, contentPath: "Document & text", delivery: "manual" }, "teams");
  assert.ok(out.orphaned.length > 0, "the two checklists genuinely differ, so some steps have no home");
  assert.ok(out.orphaned.every((t) => typeof t === "string" && t.length > 0), "and each is named");
});

test("re-mapping to the same tier is a no-op in shape", () => {
  const phases = phasesFor({ tier: "enterprise" });
  const out = remapToTier({ phases, contentPath: "Document & text", delivery: "manual" }, "enterprise");
  assert.equal(out.phases.length, phases.length);
  assert.equal(out.orphaned.length, 0, "nothing is lost switching to the tier you are already on");
});

test("a generated plan is held to its tier's stages, not a fixed six", () => {
  const proposed = { phases: [{ id: "prep", steps: [{ text: "Confirm locales" }] }] };

  const teams = coerceJourneyPlan(proposed, { tier: "teams" });
  const ent = coerceJourneyPlan(proposed, { tier: "enterprise" });

  assert.deepEqual(teams.phases.map((p) => p.id),
    ["prep", "session1", "session2", "session3", "golive", "aftergolive"]);
  assert.deepEqual(ent.phases.map((p) => p.id),
    ["prep", "kickoff", "setup", "core", "uat", "golive", "hyper"]);
});

test("a stage the model returns empty falls back to the checklist's own steps", () => {
  const plan = coerceJourneyPlan({ phases: [{ id: "session2" }] }, { tier: "teams" });
  const s2 = plan.phases.find((p) => p.id === "session2");
  assert.ok(s2.steps.some((s) => s.t === "Create a real project with your file"),
    "the fallback is the real checklist, not a paraphrase of it");
});
