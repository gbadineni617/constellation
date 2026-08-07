import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSIFY_TOOL, DESIGN_TOOL, toolResult } from "../lib/schemas.js";
import { CONTENT_TYPES, MATURITIES, DELIVERIES } from "../lib/intake.js";
import { REVIEW_MODEL_IDS } from "../lib/marketplace.js";
import { TIER_IDS } from "../lib/checklist.js";
import { coerceJourneyPlan } from "../lib/spine.js";

/**
 * These schemas replaced "return only JSON" prose. The failure they fix was
 * quiet: 22 fields plus a language-pair array ran past the token budget, the
 * truncation recovery kept whatever preceded the cut, and since `customer` was
 * the first field it was the only one that survived. Everything else fell back
 * to a default and nothing said so.
 */

test("the fields that reshape a journey are required, not optional", () => {
  const required = CLASSIFY_TOOL.input_schema.required;
  for (const field of ["customer", "tier", "contentPath", "maturity", "delivery", "reviewModel"]) {
    assert.ok(required.includes(field),
      field + " must be required — a missing value silently becomes a default");
  }
});

test("enums are enforced by the schema, so a hallucinated value cannot arrive", () => {
  const p = CLASSIFY_TOOL.input_schema.properties;
  assert.deepEqual(p.contentPath.enum, CONTENT_TYPES);
  assert.deepEqual(p.maturity.enum, MATURITIES);
  assert.deepEqual(p.delivery.enum, DELIVERIES);
  assert.deepEqual(p.reviewModel.enum, REVIEW_MODEL_IDS);
  assert.deepEqual(p.tier.enum, TIER_IDS);
});

test("the enums stay in step with the code that consumes them", () => {
  // If someone adds a content type and forgets the schema, generation would
  // silently never produce it.
  assert.equal(CLASSIFY_TOOL.input_schema.properties.contentPath.enum.length, CONTENT_TYPES.length);
  assert.equal(CLASSIFY_TOOL.input_schema.properties.reviewModel.enum.length, REVIEW_MODEL_IDS.length);
});

test("the guidance that used to live in prose now lives on the field it governs", () => {
  const p = CLASSIFY_TOOL.input_schema.properties;
  assert.match(p.contentPath.description, /SCORM/, "the e-Learning rule sits on contentPath");
  assert.match(p.contentPath.description, /wins over documents/);
  assert.match(p.reviewModel.description, /hybrid/, "the hybrid rule sits on reviewModel");
  assert.match(p.reviewModel.description, /Decide, do not hedge/);
  assert.match(p.tier.description, /Default to enterprise when unclear/);
});

test("a language pair needs both ends", () => {
  const pairs = CLASSIFY_TOOL.input_schema.properties.pairs;
  assert.deepEqual(pairs.items.required, ["source", "target"]);
  assert.ok(pairs.maxItems, "and the array is bounded");
});

test("the design schema asks for phases and nothing that classification owns", () => {
  const p = DESIGN_TOOL.input_schema.properties;
  assert.ok(p.phases, "phases is the deliverable");
  assert.deepEqual(DESIGN_TOOL.input_schema.required, ["phases"]);

  for (const owned of ["customer", "contentPath", "reviewModel", "tier", "pairs"]) {
    assert.ok(!p[owned],
      owned + " belongs to classification; asking twice is how the two answers diverge");
  }
});

test("a step must have text, and evidence is described as required for done", () => {
  const step = DESIGN_TOOL.input_schema.properties.phases.items.properties.steps.items;
  assert.deepEqual(step.required, ["text"]);
  assert.deepEqual(step.properties.status.enum, ["open", "active", "done", "na"]);
  assert.match(step.properties.evidence.description, /Required for those/);
});

test("both schemas are bounded, so runaway output cannot arrive", () => {
  const phases = DESIGN_TOOL.input_schema.properties.phases;
  assert.ok(phases.maxItems <= 14);
  assert.ok(phases.items.properties.steps.maxItems <= 24);
});

test("a tool result is read out of the response by name", () => {
  const msg = {
    content: [
      { type: "text", text: "some preamble" },
      { type: "tool_use", name: "record_customer", input: { customer: "adidas" } },
    ],
  };
  assert.deepEqual(toolResult(msg, "record_customer"), { customer: "adidas" });
});

test("a missing tool call returns null rather than throwing", () => {
  assert.equal(toolResult({ content: [{ type: "text", text: "no tool here" }] }, "record_customer"), null);
  assert.equal(toolResult({}, "record_customer"), null);
  assert.equal(toolResult(null, "record_customer"), null);
  assert.equal(toolResult({ content: [{ type: "tool_use", name: "other", input: {} }] }, "record_customer"), null);
});

// ── The label bug from the same screenshot ────────────────────────────────
test("the checklist's stage names win over the model's renaming", () => {
  // The model returned reasonable names — "Discovery", "Solution-Design
  // Workshop" — but not the ones on the spreadsheet the FDE and the customer
  // are both looking at.
  const plan = coerceJourneyPlan({
    phases: [
      { id: "prep", label: "Discovery & Asset Collection", steps: [{ text: "x" }] },
      { id: "kickoff", label: "Solution-Design Workshop", steps: [{ text: "y" }] },
    ],
  }, { tier: "enterprise" });

  assert.equal(plan.phases[0].label, "Getting started — before kickoff");
  assert.equal(plan.phases[1].label, "Kickoff");
});

test("but a stage the model adds keeps the name it gave it", () => {
  const plan = coerceJourneyPlan({
    phases: [{ label: "Format & Integration Validation", steps: [{ text: "Validate SCORM round-trip" }] }],
  }, { tier: "enterprise" });

  const added = plan.phases.find((p) => p.custom);
  assert.equal(added.label, "Format & Integration Validation",
    "there is no checklist name to prefer, so the model's stands");
});

test("the customer-facing copy still comes from the model", () => {
  const plan = coerceJourneyPlan({
    phases: [{ id: "uat", blurb: "You run one of your own Rise courses through, not a sample.", steps: [{ text: "x" }] }],
  }, { tier: "enterprise" });

  const uat = plan.phases.find((p) => p.id === "uat");
  assert.match(uat.blurb, /Rise courses/,
    "the checklist's blurb is generic; the model's is written for this customer");
});

// ── Parameters this model rejects ─────────────────────────────────────────
import { readFileSync } from "node:fs";

test("no model call sends temperature", () => {
  // It is deprecated on claude-sonnet-5 and the API rejects the entire request
  // with a 400, which surfaced as a total failure of the intake flow rather
  // than as a degraded result.
  for (const path of ["lib/intake-worker.js", "app/api/draft/route.js"]) {
    const src = readFileSync(path, "utf8");
    assert.ok(
      !/^\s*temperature\s*:/m.test(src),
      path + " sends temperature, which this model rejects outright"
    );
  }
});

test("consistency comes from the schema rather than from sampling controls", () => {
  // With temperature unavailable, enforced enums are what stop the fields that
  // reshape a journey drifting between runs.
  for (const field of ["tier", "contentPath", "maturity", "delivery", "reviewModel"]) {
    assert.ok(
      Array.isArray(CLASSIFY_TOOL.input_schema.properties[field].enum),
      field + " must be an enum — it is the only thing pinning it now"
    );
  }
});
