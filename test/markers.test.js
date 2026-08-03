import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceMarker, coerceMarkers, markersAfter, markerAge, markerSummary, isOpenIssue, MARKER_STALE_DAYS } from "../lib/markers.js";
import { buildJourney, assess } from "../lib/journey.js";
import { SEED } from "../lib/seed.js";

const T = new Date("2026-07-26T00:00:00Z");
const base = {
  contentPath: "e-Learning", maturity: "greenfield", delivery: "manual", reviewModel: "internal",
  stage: "core", stageProgress: 0.4, notes: {},
  startDate: "2026-06-24", goLiveDate: "2026-09-20", lastActivityDate: "2026-07-25",
  health: [99, 99, 99, 99, 99, 99],
};

test("a marker needs something to say, and defaults to context", () => {
  assert.equal(coerceMarker({ text: "" }), null);
  assert.equal(coerceMarker(null), null);
  assert.equal(coerceMarker({ text: "something" }).kind, "note", "the least alarming kind is the default");
  assert.equal(coerceMarker({ text: "x", kind: "invented" }).kind, "note");
});

test("only an issue can be resolved — a decision is not something you close", () => {
  assert.equal(coerceMarker({ text: "x", kind: "issue" }).state, "open");
  assert.equal(coerceMarker({ text: "x", kind: "issue", state: "resolved" }).state, "resolved");
  assert.equal(coerceMarker({ text: "x", kind: "decision", state: "resolved" }).state, "recorded",
    "a decision was made; it does not get closed");
  assert.equal(coerceMarker({ text: "x", kind: "note", state: "open" }).state, "recorded");
});

test("only open issues age; decisions and notes do not", () => {
  assert.equal(markerAge({ kind: "issue", state: "open", at: "2026-07-16" }, T).days, 10);
  assert.equal(markerAge({ kind: "issue", state: "open", at: "2026-07-16" }, T).stale, true);
  assert.equal(markerAge({ kind: "issue", state: "open", at: "2026-07-24" }, T).stale, false);
  assert.equal(markerAge({ kind: "decision", state: "recorded", at: "2020-01-01" }, T), null);
  assert.equal(markerAge({ kind: "issue", state: "resolved", at: "2020-01-01" }, T), null);
  assert.ok(MARKER_STALE_DAYS >= 7);
});

test("markers belong to the gap after a phase, not to both sides", () => {
  const rec = { markers: coerceMarkers([
    { after: "kickoff", kind: "issue", text: "procurement" },
    { after: "setup", kind: "note", text: "leave" },
  ]) };
  assert.equal(markersAfter(rec, "kickoff").length, 1);
  assert.equal(markersAfter(rec, "setup").length, 1);
  assert.equal(markersAfter(rec, "uat").length, 0);
  assert.equal(markersAfter({}, "kickoff").length, 0);
});

test("the summary separates what needs action from what is simply recorded", () => {
  const rec = { ...base, markers: coerceMarkers([
    { after: "kickoff", kind: "issue", text: "old problem", at: "2026-07-01" },
    { after: "setup", kind: "issue", text: "new problem", at: "2026-07-25" },
    { after: "core", kind: "issue", text: "sorted", at: "2026-07-01", state: "resolved" },
    { after: "setup", kind: "decision", text: "dropped es-CL" },
    { after: "prep", kind: "note", text: "Kat on leave" },
  ]) };
  const m = markerSummary(rec, buildJourney(rec), T);
  assert.equal(m.total, 5);
  assert.equal(m.issues.length, 2, "resolved issues are not open issues");
  assert.equal(m.issues[0].text, "old problem", "oldest first — that is the one to ask about");
  assert.equal(m.stale.length, 1);
  assert.equal(m.decisions.length, 1);
  assert.equal(m.notes.length, 1);
  assert.ok(m.issues[0].afterLabel, "and it knows which gap it sits in");
});

test("a stale between-phase issue escalates a healthy journey", () => {
  assert.equal(assess(base, buildJourney(base)).level, "on_track");

  const rec = { ...base, markers: coerceMarkers([
    { after: "kickoff", kind: "issue", text: "Two weeks lost to procurement", at: "2026-07-05" },
  ]) };
  const a = assess(rec, buildJourney(rec));
  assert.equal(a.level, "at_risk", "21 days of nothing happening is not on track");
  assert.ok(a.signals.some((s) => /Issue after Kickoff/.test(s.t)));
});

test("decisions and notes never escalate anything", () => {
  const rec = { ...base, markers: coerceMarkers([
    { after: "kickoff", kind: "decision", text: "dropped es-CL", at: "2020-01-01" },
    { after: "setup", kind: "note", text: "Kat on leave", at: "2020-01-01" },
  ]) };
  const a = assess(rec, buildJourney(rec));
  assert.equal(a.level, "on_track", "recording context must never make a journey look sick");
  assert.ok(!a.signals.some((s) => /Issue after/.test(s.t)));
  assert.equal(a.markers.total, 2, "but they are still carried");
});

test("garbage yields nothing rather than throwing", () => {
  for (const junk of [null, undefined, 42, "nope", [null, {}, { text: "" }]]) {
    assert.doesNotThrow(() => coerceMarkers(junk));
    assert.deepEqual(coerceMarkers(junk), []);
    assert.doesNotThrow(() => markerSummary({ markers: coerceMarkers(junk) }, [], T));
  }
});

test("Walmart carries its real decision and context, and neither flags it", () => {
  const wm = SEED.find((r) => r.id === "walmart");
  const a = assess(wm, buildJourney(wm));
  assert.equal(a.markers.decisions.length, 1);
  assert.match(a.markers.decisions[0].text, /fr-CA goes first/);
  assert.equal(a.markers.notes.length, 1);
  assert.equal(a.markers.issues.length, 0, "a decision is not a problem");
  assert.ok(!a.signals.some((s) => /Issue after/.test(s.t)));
});
