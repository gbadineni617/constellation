import { test } from "node:test";
import assert from "node:assert/strict";
import { listJourneys, getJourney, saveJourney, deleteJourney, logNudge, recentNudge, MODE } from "../lib/db.js";

test("without DATABASE_URL it falls back to memory, and says so", () => {
  assert.equal(MODE, "memory", "no connection string configured in this test run");
});

test("the seeded journeys are there on first read", async () => {
  const all = await listJourneys();
  assert.ok(all.length >= 6);
  assert.ok(all.some((r) => r.id === "walmart"));
});

test("a journey round-trips with its nested state intact", async () => {
  const rec = {
    id: "test-adidas",
    org: "adidas",
    customer: "adidas Retail Academy",
    contentPath: "e-Learning", maturity: "mature", delivery: "connected", connector: "Cornerstone",
    stage: "kickoff", notes: {},
    dueDates: { content: "2026-07-20" },
    overrides: { goals: "done" },
    customItems: { core: [{ k: "x1", t: "Security review" }] },
  };
  await saveJourney(rec);

  const back = await getJourney("test-adidas");
  assert.equal(back.customer, "adidas Retail Academy");
  assert.equal(back.connector, "Cornerstone");
  assert.deepEqual(back.dueDates, { content: "2026-07-20" }, "due dates survive storage");
  assert.deepEqual(back.overrides, { goals: "done" }, "so do status overrides");
  assert.equal(back.customItems.core[0].t, "Security review", "and custom steps");
});

test("saving the same id updates rather than duplicating", async () => {
  const before = (await listJourneys()).length;
  await saveJourney({ id: "test-adidas", customer: "adidas — renamed", org: "adidas", notes: {} });
  const after = await listJourneys();
  assert.equal(after.length, before, "no duplicate row");
  assert.equal((await getJourney("test-adidas")).customer, "adidas — renamed");
});

test("a journey without an id is rejected rather than silently lost", async () => {
  await assert.rejects(() => saveJourney({ customer: "nameless" }), /needs an id/);
});

test("deleting removes it", async () => {
  await deleteJourney("test-adidas");
  assert.equal(await getJourney("test-adidas"), null);
});

test("the nudge log answers 'have we already said this'", async () => {
  assert.equal(await recentNudge({ journeyId: "walmart", stepKey: "a2" }), null, "nothing sent yet");

  await logNudge({ journeyId: "walmart", stepKey: "a2", channel: "email", subject: "Glossary", body: "..." });

  const found = await recentNudge({ journeyId: "walmart", stepKey: "a2", withinDays: 3 });
  assert.ok(found, "the same step within the window is found, so the agent stays quiet");
  assert.equal(found.channel, "email");

  const other = await recentNudge({ journeyId: "walmart", stepKey: "templates" });
  assert.equal(other, null, "a different step is a different nudge");
});

test("an old nudge no longer suppresses a new one", async () => {
  await logNudge({ journeyId: "stepstone", stepKey: "templates", channel: "email" });
  assert.ok(await recentNudge({ journeyId: "stepstone", stepKey: "templates", withinDays: 3 }));
  assert.equal(
    await recentNudge({ journeyId: "stepstone", stepKey: "templates", withinDays: 0 }),
    null,
    "outside the window it does not suppress"
  );
});
