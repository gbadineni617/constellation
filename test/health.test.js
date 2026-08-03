import { test } from "node:test";
import assert from "node:assert/strict";
import { isRealProject, computeHealth } from "../lib/health.js";

const project = (over = {}) => ({
  name: "Q3 Product Sheets",
  statistics: { totalWords: 4200, completedWords: 0 },
  translationMemories: [],
  glossaries: [],
  workflowStages: [],
  ...over,
});

test("junk projects are excluded, because they make adoption look worse than it is", () => {
  assert.equal(isRealProject(project()), true);
  for (const name of ["test", "asdf", "Untitled", "Copy of Module 3", "demo", "   "]) {
    assert.equal(isRealProject(project({ name })), false, name + " is somebody poking around");
  }
});

test("a project too small to be real work is excluded", () => {
  assert.equal(isRealProject(project({ statistics: { totalWords: 12 } })), false);
  assert.equal(isRealProject(project({ statistics: { totalWords: 4200 } })), true);
  assert.equal(isRealProject(project({ statistics: {} })), true, "unknown size is not grounds to exclude");
});

test("the six metrics are computed, not guessed", () => {
  const projects = [
    project({ name: "A", translationMemories: [{ id: 1 }], glossaries: [{ id: 1 }], workflowStages: [{ name: "AI translation" }] }),
    project({ name: "B", translationMemories: [{ id: 1 }] }),
    project({ name: "C" }),
    project({ name: "D", statistics: { totalWords: 1000, completedWords: 1000 } }),
  ];
  const h = computeHealth(projects);
  assert.equal(h.sampled, 4);
  assert.equal(h.values[0], 50, "two of four have a TM");
  assert.equal(h.values[1], 25, "one of four has a glossary");
  assert.equal(h.values[3], 25, "one of four uses an AI stage");
  assert.equal(h.values[4], 25, "one of four is complete");
});

test("junk is excluded before the arithmetic, not after", () => {
  const projects = [
    project({ name: "Real one", translationMemories: [{ id: 1 }] }),
    project({ name: "test" }),
    project({ name: "asdf" }),
  ];
  const h = computeHealth(projects);
  assert.equal(h.sampled, 1);
  assert.equal(h.excluded, 2);
  assert.equal(h.values[0], 100, "one real project, and it has a TM");
});

test("an empty workspace yields zeroes rather than dividing by nothing", () => {
  const h = computeHealth([]);
  assert.equal(h.sampled, 0);
  assert.ok(h.values.slice(0, 5).every((v) => v === 0));
});

test("user activity is null when unknowable, not zero", () => {
  const h = computeHealth([project()]);
  assert.equal(h.values[5], null, "no user data means we do not know, which is not the same as none");
  assert.equal(h.detail[5].unknown, true);
});

test("activity is measured against the last 30 days", () => {
  const recent = new Date(Date.now() - 5 * 86400000).toISOString();
  const old = new Date(Date.now() - 90 * 86400000).toISOString();
  const h = computeHealth([project()], [
    { lastActivityDate: recent },
    { lastActivityDate: recent },
    { lastActivityDate: old },
    { lastLoginDate: recent },
  ]);
  assert.equal(h.values[5], 75, "three of four seen within the window");
});

test("each metric reports whether it met its target", () => {
  const projects = Array.from({ length: 10 }, (_, i) =>
    project({ name: "P" + i, translationMemories: i < 9 ? [{ id: 1 }] : [] })
  );
  const h = computeHealth(projects);
  assert.equal(h.detail[0].value, 90);
  assert.equal(h.detail[0].met, true, "90 clears the 80 target");
  assert.equal(h.detail[1].met, false, "no glossaries anywhere");
});
