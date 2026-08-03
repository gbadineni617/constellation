import { test } from "node:test";
import assert from "node:assert/strict";
import { describeTarget, smartcatHost, SURFACES, SURFACE_IDS } from "../lib/surfaces.js";
import { buildJourney } from "../lib/journey.js";
import { ANCHORS, ROSTER_ANCHOR } from "../lib/spine.js";

test("every surface a phase can declare actually resolves", () => {
  const declared = new Set([
    ...buildJourney({ contentPath: "e-Learning", maturity: "mature", delivery: "connected", reviewModel: "marketplace", stage: "prep", notes: {} }).map((p) => p.surface),
    ...ANCHORS.map((a) => a.surface),
    ROSTER_ANCHOR.surface,
  ]);
  for (const s of declared) {
    assert.ok(SURFACE_IDS.includes(s), s + " must be a known surface, or the button goes nowhere");
  }
});

test("standalone opens a tab; embedded navigates the host", () => {
  const out = describeTarget("translations", { embedded: false });
  assert.equal(out.intent, "open");
  assert.ok(out.href.startsWith("https://"), "a new tab needs a full URL");

  const inside = describeTarget("translations", { embedded: true });
  assert.equal(inside.intent, "navigate", "inside the platform, do not spawn a tab back into it");
  assert.ok(inside.path.startsWith("/"), "the host is given a path, not an origin");
});

test("a conversation is not a link", () => {
  const out = describeTarget("demo", { embedded: false });
  assert.equal(out.intent, "contact");
  assert.equal(out.href, undefined, "there is no URL for 'talk to your engineer'");
  assert.match(out.label, /call/i);
});

test("the region decides the host", () => {
  assert.equal(smartcatHost("eu"), "https://smartcat.ai");
  assert.equal(smartcatHost("us"), "https://us.smartcat.ai");
  assert.equal(smartcatHost("ea"), "https://ea.smartcat.ai");
  assert.equal(smartcatHost("mars"), "https://us.smartcat.ai", "an unknown region falls back rather than breaking");
  assert.equal(smartcatHost(), "https://us.smartcat.ai");
  assert.match(describeTarget("translations", { region: "eu" }).href, /^https:\/\/smartcat\.ai/);
});

test("a known account scopes the link to that workspace", () => {
  const scoped = describeTarget("translations", { accountId: "abc-123" });
  assert.match(scoped.path, /^\/workspace\/abc-123\/projects$/);

  const unscoped = describeTarget("translations", {});
  assert.equal(unscoped.path, "/projects", "without an account we send them to their default");
});

test("an account id is escaped, not concatenated blindly", () => {
  const t = describeTarget("translations", { accountId: "a/b?c=d" });
  assert.ok(!t.path.includes("?c="), "a stray query string must not survive into the path");
  assert.ok(t.path.includes("a%2Fb"));
});

test("an unknown surface falls back rather than producing a dead button", () => {
  const t = describeTarget("nonsense", {});
  assert.equal(t.intent, "open");
  assert.ok(t.href);
  assert.equal(t.label, SURFACES.workspace.label);
});

test("go-live points at reports, because that phase is about the numbers", () => {
  const golive = buildJourney({ contentPath: "Document & text", maturity: "mature", delivery: "manual", stage: "prep", notes: {} })
    .find((p) => p.id === "golive");
  assert.equal(golive.surface, "reporting");
  assert.match(describeTarget(golive.surface, {}).label, /Reports/);
});

test("every surface carries a hint, so a button can explain itself", () => {
  for (const id of SURFACE_IDS) {
    assert.ok(SURFACES[id].hint, id + " needs a hint");
    assert.ok(SURFACES[id].external || SURFACES[id].path?.startsWith("/"), id + " needs a path or to be external");
  }
});

// ── Marketplace handoff ──────────────────────────────────────────────────
import { marketplaceQuery, sourcingBrief } from "../lib/surfaces.js";

const lutron = {
  customer: "Lutron Genesis",
  specialization: "Technical & engineering",
  industry: "Building automation",
  turnaround: "Expedited",
  goLive: "25 September 2026",
};

const pairs = [
  { source: "en-US", target: "de-DE", state: "active",   reviewers: 1, certification: "None", note: "Marta Hoffman" },
  { source: "en-US", target: "ja-JP", state: "scoping",  reviewers: 1, certification: "None", note: "No in-region reviewer" },
  { source: "en-US", target: "zh-CN", state: "sourcing", reviewers: 2, certification: "Technical", note: "" },
];

test("a search carries the journey's own requirements, so nothing is retyped", () => {
  const q = marketplaceQuery(lutron, pairs[2]);
  assert.match(q.path, /source=en-US/);
  assert.match(q.path, /target=zh-CN/);
  assert.match(q.path, /certification=Technical/);
  assert.match(q.path, /specialization=Technical/);
  assert.match(q.path, /turnaround=Expedited/);
});

test("the summary reads as a sentence a human would say", () => {
  assert.match(marketplaceQuery(lutron, pairs[2]).summary, /en-US to zh-CN/);
  assert.match(marketplaceQuery(lutron, pairs[2]).summary, /Technical certified/);
});

test("defaults are left out rather than shipped as noise", () => {
  const q = marketplaceQuery({ ...lutron, turnaround: "Standard" }, pairs[1]);
  assert.ok(!q.path.includes("turnaround"), "standard turnaround is not a filter");
  assert.ok(!q.path.includes("certification"), "'None' is not a certification requirement");
});

test("special characters survive into the query", () => {
  const q = marketplaceQuery({ specialization: "Legal & compliance" }, pairs[1]);
  assert.match(q.path, /Legal\+%26\+compliance/, "an ampersand must not truncate the filter");
});

test("with no pair, the search is still scoped by domain", () => {
  const q = marketplaceQuery(lutron, null);
  assert.match(q.path, /specialization=/);
  assert.ok(!q.path.includes("source="));
  assert.equal(q.summary, "");
});

test("the brief covers only pairs that still need sourcing", () => {
  const b = sourcingBrief(lutron, pairs);
  assert.equal(b.count, 2, "an active pair is already staffed");
  assert.match(b.text, /ja-JP/);
  assert.match(b.text, /zh-CN/);
  assert.ok(!b.text.includes("de-DE"), "do not ask for linguists you already have");
});

test("the brief carries everything the Marketplace team would otherwise ask for", () => {
  const b = sourcingBrief(lutron, pairs);
  assert.match(b.text, /Lutron Genesis/);
  assert.match(b.text, /Domain: Technical & engineering/);
  assert.match(b.text, /Go-live: 25 September 2026/);
  assert.match(b.text, /2 reviewers/, "how many reviewers per pair");
  assert.match(b.text, /Technical certification required/);
  assert.match(b.text, /No in-region reviewer/, "and the note explaining why it is needed");
});

test("a fully staffed roster produces no brief at all", () => {
  assert.equal(sourcingBrief(lutron, [pairs[0]]), null);
  assert.equal(sourcingBrief(lutron, []), null);
  assert.equal(sourcingBrief(lutron, null), null);
});
