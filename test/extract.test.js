import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { classifyFile, readFiles, MAX_FILES, MAX_TOTAL_CHARS } from "../lib/extract.js";
import { coerceJourneyPlan } from "../lib/spine.js";

const b64 = (s) => Buffer.from(s).toString("base64");

const tracker = () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Step", "Owner", "Status"],
    ["Workspace provisioning", "Smartcat", "Done"],
    ["", "", ""],
    ["Glossary + style guide", "Phillip", "Not started"],
  ]), "Onboarding");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }).toString("base64");
};

test("the formats an FDE actually has are all recognised", () => {
  const expected = {
    "brief.pdf": "pdf", "notes.docx": "docx", "tracker.xlsx": "sheet",
    "screenshot.png": "image", "call.srt": "text", "thread.eml": "text",
    "config.json": "text", "notes.md": "text", "data.csv": "text",
  };
  for (const [name, kind] of Object.entries(expected)) {
    assert.equal(classifyFile(name), kind, name);
  }
  for (const name of ["archive.zip", "recording.mp4", "noextension"]) {
    assert.equal(classifyFile(name), null, name + " is not something we can read");
  }
});

test("several documents are read into one message with a framing header", async () => {
  const out = await readFiles([
    { name: "kickoff.md", content: "Workspace is provisioned." },
    { name: "brief.txt", content: "They need fr-CA first." },
  ]);
  assert.equal(out.manifest.filter((m) => m.ok).length, 2);
  assert.match(out.header, /2 documents about the same customer/);
  assert.match(out.header, /spreadsheet tracker is more reliable/, "the model is told which source to trust on progress");
});

test("a single document gets no multi-document framing", async () => {
  const out = await readFiles([{ name: "only.md", content: "Just one." }]);
  assert.equal(out.header, "", "framing that says 'read these together' is wrong for one file");
});

test("a tracker spreadsheet flattens to readable rows", async () => {
  const out = await readFiles([{ name: "tracker.xlsx", content: tracker() }]);
  const text = out.blocks.find((b) => b.type === "text").text;
  assert.match(text, /Sheet: Onboarding/);
  assert.match(text, /Workspace provisioning \| Smartcat \| Done/);
  assert.ok(!/\|\s*\|\s*\|/.test(text), "empty rows are dropped rather than shipped as noise");
  assert.match(out.manifest[0].note, /ticked rows become completed steps/);
});

test("one unreadable file does not sink the rest", async () => {
  const out = await readFiles([
    { name: "good.md", content: "Real content." },
    { name: "archive.zip", content: b64("nope") },
    { name: "empty.txt", content: "   " },
  ]);
  assert.equal(out.manifest.filter((m) => m.ok).length, 1);
  assert.equal(out.manifest.find((m) => m.name === "archive.zip").reason, "unsupported format");
  assert.ok(out.blocks.length > 0, "the readable one still gets through");
});

test("nothing readable is an error, not a silent empty prompt", async () => {
  await assert.rejects(() => readFiles([{ name: "a.zip", content: "x" }]), /None of those files/);
  await assert.rejects(() => readFiles([]), /Nothing to read/);
});

test("one enormous file cannot crowd out the others", async () => {
  const huge = "word ".repeat(80_000);
  const out = await readFiles([
    { name: "huge.txt", content: huge },
    { name: "small.md", content: "The important bit." },
  ]);
  const total = out.stored.reduce((n, s) => n + s.text.length, 0);
  assert.ok(total <= MAX_TOTAL_CHARS, "the combined budget is respected");
  assert.ok(out.manifest.every((m) => m.ok), "and both files still appear");
});

test("only the first few files are read", async () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ name: "f" + i + ".md", content: "x" }));
  const out = await readFiles(many);
  assert.ok(out.manifest.length <= MAX_FILES);
});

test("subtitle timing noise is stripped before the model sees it", async () => {
  const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\nThey want fr-CA first.\n";
  const out = await readFiles([{ name: "call.vtt", content: vtt }]);
  const text = out.blocks[0].text;
  assert.match(text, /They want fr-CA first/);
  assert.ok(!text.includes("-->"), "timestamps teach nothing and cost tokens");
  assert.ok(!text.includes("WEBVTT"));
});

// ── Progress detection ──────────────────────────────────────────────────
test("completed work is claimed with the quote that justifies it", () => {
  const plan = coerceJourneyPlan({
    phases: [{
      id: "setup", label: "Workspace setup", steps: [
        { text: "Provision workspace", status: "done", evidence: "\"workspace provisioned, team logged in\"" },
        { text: "Templates", status: "active", evidence: "\"half-built\"" },
        { text: "AI profile", status: "open" },
      ],
    }],
  });
  assert.equal(plan.claims.length, 2, "open steps are not claims");
  assert.equal(plan.claims[0].evidence, "\"workspace provisioned, team logged in\"");
  assert.equal(plan.unevidenced, 0);
});

test("a claim with no evidence is counted, so the UI can start it unticked", () => {
  const plan = coerceJourneyPlan({
    phases: [{ id: "uat", label: "UAT", steps: [{ text: "Customer signed off", status: "done" }] }],
  });
  assert.equal(plan.claims.length, 1);
  assert.equal(plan.claims[0].evidence, "", "nothing was quoted");
  assert.equal(plan.unevidenced, 1, "which is exactly the one a human must look at");
});

test("evidence is never carried on an open step", () => {
  const plan = coerceJourneyPlan({
    phases: [{ id: "prep", label: "Discovery", steps: [{ text: "x", status: "open", evidence: "made up" }] }],
  });
  assert.equal(plan.phases[0].steps[0].evidence, "", "an open step has nothing to justify");
  assert.equal(plan.claims.length, 0);
});

test("a customer starting fresh produces no claims at all", () => {
  const plan = coerceJourneyPlan({
    phases: [{ id: "prep", label: "Discovery", steps: [{ text: "a" }, { text: "b" }] }],
  });
  assert.equal(plan.claims.length, 0);
  assert.equal(plan.unevidenced, 0);
});

// ── Non-JSON responses ───────────────────────────────────────────────────
import { readJson } from "../lib/http.js";

const fakeRes = (status, body, ok = status < 400) => ({
  status, ok, text: async () => body,
});

test("a timeout reports a timeout, not a parse error", async () => {
  await assert.rejects(
    () => readJson(fakeRes(504, "<html>An error occurred</html>")),
    /longer than the server allows/,
    "the user needs to know the request was killed, not that a character was unexpected"
  );
});

test("an HTML error page from a crashed function says so", async () => {
  await assert.rejects(() => readJson(fakeRes(500, "<!DOCTYPE html><h1>500</h1>")), /server hit an error \(500\)/);
});

test("a real JSON error keeps its own message", async () => {
  await assert.rejects(
    () => readJson(fakeRes(400, JSON.stringify({ error: "Those files are unreadable." }))),
    /Those files are unreadable/
  );
});

test("a successful response parses normally", async () => {
  const data = await readJson(fakeRes(200, JSON.stringify({ ok: true, n: 3 })));
  assert.equal(data.n, 3);
});

test("an oversized payload is named as such", async () => {
  await assert.rejects(() => readJson(fakeRes(413, "Payload Too Large")), /too large/);
});
