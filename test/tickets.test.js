import { test } from "node:test";
import assert from "node:assert/strict";
import { coerceTicket, coerceTickets, ticketAge, ticketSummary, ticketsFor, isOpen, STALE_DAYS } from "../lib/tickets.js";
import { buildJourney, assess } from "../lib/journey.js";
import { SEED } from "../lib/seed.js";
import { openStepKey, stepKey } from "./helpers.js";

const T = new Date("2026-07-26T00:00:00Z");

// Keys come from the built journey rather than being hardcoded: the spine is
// the real checklist now, so step keys derive from its wording.
const _probe = buildJourney({ contentPath: "e-Learning", maturity: "greenfield", delivery: "manual", reviewModel: "internal", stage: "core", stageProgress: 0.4, notes: {} });
const KEY_A = openStepKey(_probe, "core");
const KEY_B = openStepKey(_probe, "uat");
const KEY_C = openStepKey(_probe, "golive");

const base = {
  contentPath: "e-Learning", maturity: "greenfield", delivery: "manual", reviewModel: "internal",
  stage: "core", stageProgress: 0.4, notes: {},
  startDate: "2026-06-24", goLiveDate: "2026-09-20", lastActivityDate: "2026-07-25",
  health: [99, 99, 99, 99, 99, 99],
};

test("a blocker needs something to say", () => {
  assert.equal(coerceTicket({ text: "" }), null);
  assert.equal(coerceTicket(null), null);
  assert.equal(coerceTicket({ text: "   " }), null, "whitespace is not a reason");
  assert.ok(coerceTicket({ text: "Waiting on legal" }));
});

test("an unrecognised state falls back to open, never to resolved", () => {
  assert.equal(coerceTicket({ text: "x", state: "probably-fine" }).state, "open");
  assert.equal(coerceTicket({ text: "x", state: "resolved" }).state, "resolved");
  assert.equal(coerceTicket({ text: "x" }).state, "open", "logging a blocker means it is open");
});

test("every ticket gets an id, so it can be resolved later", () => {
  const a = coerceTicket({ text: "one" });
  const b = coerceTicket({ text: "two" });
  assert.ok(a.id && b.id);
  assert.notEqual(a.id, b.id);
  assert.equal(coerceTicket({ text: "x", id: "keep-me" }).id, "keep-me", "an existing id survives");
});

test("garbage lists yield an empty list rather than throwing", () => {
  for (const junk of [null, undefined, 42, "nope", [null, {}, { text: "" }]]) {
    assert.doesNotThrow(() => coerceTickets(junk));
    assert.deepEqual(coerceTickets(junk), []);
  }
});

test("a resolved blocker has no age worth reporting", () => {
  assert.equal(ticketAge({ text: "x", state: "resolved", at: "2026-01-01" }, T), null);
  assert.equal(ticketAge(null, T), null);
});

test("age is measured, and staleness is a threshold not a feeling", () => {
  assert.equal(ticketAge({ state: "open", at: "2026-07-24" }, T).days, 2);
  assert.equal(ticketAge({ state: "open", at: "2026-07-24" }, T).stale, false);
  assert.equal(ticketAge({ state: "open", at: "2026-07-08" }, T).days, 18);
  assert.equal(ticketAge({ state: "open", at: "2026-07-08" }, T).stale, true);
  assert.ok(STALE_DAYS >= 5);
});

test("blockers attach to the step they block, and travel with it", () => {
  const rec = {
    ...base,
    tickets: coerceTickets([
      { stepKey: KEY_A, text: "Glossary blocked on legal", at: "2026-07-08", ref: "SUP-4821" },
      { stepKey: KEY_B, text: "SSO decision pending", at: "2026-07-24" },
    ]),
  };
  assert.equal(ticketsFor(rec, KEY_A).length, 1);
  assert.equal(ticketsFor(rec, "nothing-here").length, 0);

  const step = buildJourney(rec).find((p) => p.id === "core").items.find((i) => i.k === KEY_A);
  assert.equal(step.tickets.length, 1, "the step carries its own blockers");
  assert.equal(step.tickets[0].ref, "SUP-4821");
});

test("the summary sorts oldest first, and names the step and phase", () => {
  const rec = {
    ...base,
    tickets: coerceTickets([
      { stepKey: KEY_B, text: "recent", at: "2026-07-24" },
      { stepKey: KEY_A, text: "ancient", at: "2026-07-01" },
      { stepKey: KEY_C, text: "done with", at: "2026-07-02", state: "resolved" },
    ]),
  };
  const s = ticketSummary(rec, buildJourney(rec), T);
  assert.equal(s.total, 3);
  assert.equal(s.open.length, 2);
  assert.equal(s.resolved, 1);
  assert.equal(s.open[0].text, "ancient", "the longest-open one leads, because it is the one to ask about");
  assert.ok(s.open[0].step, "and it knows which step it blocks");
  assert.ok(s.open[0].phase, "and which phase that sits in");
});

test("a stale blocker flags an otherwise healthy journey", () => {
  const healthy = assess(base, buildJourney(base));
  assert.equal(healthy.level, "on_track");

  const blocked = { ...base, tickets: coerceTickets([{ stepKey: KEY_A, text: "Waiting on legal", at: "2026-07-01" }]) };
  const a = assess(blocked, buildJourney(blocked));
  assert.equal(a.level, "at_risk", "something open for 25 days is not on track, whatever the percentages say");
  assert.ok(a.signals.some((s) => /Blocked 25 days/.test(s.t)));
});

test("a fresh blocker is reported but does not escalate", () => {
  const rec = { ...base, tickets: coerceTickets([{ stepKey: KEY_A, text: "Raised today", at: "2026-07-25" }]) };
  const a = assess(rec, buildJourney(rec));
  assert.equal(a.level, "on_track", "a blocker logged yesterday is information, not an emergency");
  assert.ok(a.signals.some((s) => /Blocked 1 days/.test(s.t)), "but it is still surfaced");
  assert.equal(a.signals.find((s) => /Blocked/.test(s.t)).hot, false);
});

test("resolving a blocker clears the signal", () => {
  const rec = { ...base, tickets: coerceTickets([{ stepKey: KEY_A, text: "Was blocked", at: "2026-07-01", state: "resolved" }]) };
  const a = assess(rec, buildJourney(rec));
  assert.equal(a.tickets.open.length, 0);
  assert.equal(a.level, "on_track");
  assert.ok(!a.signals.some((s) => /Blocked/.test(s.t)));
});

