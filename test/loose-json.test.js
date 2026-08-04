import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLoose } from "../lib/loose-json.js";

test("valid JSON parses untouched", () => {
  const r = parseLoose('{"a":1,"b":[2,3]}');
  assert.equal(r.ok, true);
  assert.equal(r.repaired, false, "nothing was wrong, so nothing was repaired");
  assert.deepEqual(r.value, { a: 1, b: [2, 3] });
});

test("markdown fences are stripped", () => {
  const r = parseLoose('```json\n{"a":1}\n```');
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { a: 1 });
});

test("a response cut mid-string keeps everything before it", () => {
  const r = parseLoose('{"customer":"adidas","phases":[{"label":"Discov');
  assert.equal(r.ok, true);
  assert.equal(r.repaired, true);
  assert.equal(r.value.customer, "adidas", "the complete field survives");
  assert.ok(!r.value.phases?.length, "the incomplete one is dropped rather than half-kept");
});

test("a response cut after a comma keeps the completed elements", () => {
  const r = parseLoose('{"customer":"adidas","phases":[{"label":"Discovery"},');
  assert.equal(r.ok, true);
  assert.equal(r.value.phases.length, 1);
  assert.equal(r.value.phases[0].label, "Discovery");
});

test("a deeply nested cut recovers every complete level", () => {
  const r = parseLoose('{"p":[{"s":[{"t":"x","w":["a","b"');
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { p: [{ s: [{ t: "x", w: ["a", "b"] }] }] });
});

test("a key with no value is dropped, not left dangling", () => {
  const r = parseLoose('{"customer":"adidas","phases":[{"label":"A"}],"stage":');
  assert.equal(r.ok, true);
  assert.equal(r.value.customer, "adidas");
  assert.equal(r.value.phases.length, 1);
  assert.ok(!("stage" in r.value), "an unanswered key is not a field");
});

test("braces inside strings do not confuse the scan", () => {
  const r = parseLoose('{"customer":"a{b}c","phases":[{"label":"X"');
  assert.equal(r.ok, true);
  assert.equal(r.value.customer, "a{b}c");
});

test("escaped quotes inside strings are handled", () => {
  const r = parseLoose('{"note":"she said \\"go\\" then","x":[1');
  assert.equal(r.ok, true);
  assert.equal(r.value.note, 'she said "go" then');
  assert.deepEqual(r.value.x, [1]);
});

test("a truncated number is kept whole", () => {
  const r = parseLoose('{"a":1,"b":234');
  assert.equal(r.ok, true);
  assert.equal(r.value.b, 234);
});

test("something that was never JSON fails honestly", () => {
  for (const junk of ["An error occurred with your deployment", "<html><body>504</body></html>", "", null, undefined]) {
    const r = parseLoose(junk);
    assert.equal(r.ok, false, "an HTML error page must not be silently turned into an object");
    assert.equal(r.repaired, false);
  }
});

test("a realistic truncated journey plan yields usable phases", () => {
  // A response that stopped partway through writing the third phase.
  const full = JSON.stringify({
    customer: "adidas — Global Retail Academy",
    contentPath: "e-Learning",
    phases: [
      { id: "prep", label: "Discovery", steps: [{ text: "Confirm the seven priority locales" }] },
      { id: "kickoff", label: "Kickoff", steps: [{ text: "Agree success criteria" }] },
      { id: "setup", label: "Workspace setup", steps: [{ text: "Provision the workspace" }] },
    ],
  });
  const cut = full.slice(0, full.indexOf('"Provision') + 12);   // stops mid-word

  const r = parseLoose(cut);
  assert.equal(r.ok, true);
  assert.equal(r.repaired, true, "this really was truncated");
  assert.equal(r.value.customer, "adidas — Global Retail Academy");
  // Recovery is per-element, not per-phase: the third phase kept its completed
  // fields and lost only the step that was mid-write. coerceJourneyPlan() fills
  // an empty phase with standard steps, so this degrades gracefully.
  assert.equal(r.value.phases.length, 3);
  assert.deepEqual(r.value.phases.map((p) => p.label), ["Discovery", "Kickoff", "Workspace setup"]);
  assert.equal(r.value.phases[0].steps.length, 1, "complete phases keep their steps");
  // The steps key was cut before its value, so it is absent rather than empty.
  // An unanswered key is not a field — dropping it is what stops a half-written
  // value being mistaken for a real one.
  assert.ok(!r.value.phases[2].steps, "the truncated phase drops the key it never finished");
});
