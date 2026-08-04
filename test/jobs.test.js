import { test } from "node:test";
import assert from "node:assert/strict";
import { createJob, getJob, updateJob, pruneJobs } from "../lib/db.js";

test("a job starts queued, with nothing pretending to be progress", async () => {
  await createJob({ id: "j1", kind: "intake", payload: { files: [{ name: "notes.md" }] } });
  const j = await getJob("j1");
  assert.equal(j.state, "queued");
  assert.equal(j.progress, 0);
  assert.equal(j.result ?? null, null, "no result until there is one");
  assert.deepEqual(j.payload.files[0].name, "notes.md", "the worker can find its input");
});

test("progress updates are visible to a poller", async () => {
  await createJob({ id: "j2", kind: "intake", payload: {} });
  await updateJob("j2", { state: "running", step: "Designing the journey", progress: 35 });
  const j = await getJob("j2");
  assert.equal(j.state, "running");
  assert.equal(j.step, "Designing the journey", "the UI can say what is happening");
  assert.equal(j.progress, 35);
});

test("a finished job carries its result", async () => {
  await createJob({ id: "j3", kind: "intake", payload: {} });
  await updateJob("j3", { state: "done", progress: 100, result: { plan: { phases: [{ label: "Discovery" }] } } });
  const j = await getJob("j3");
  assert.equal(j.state, "done");
  assert.equal(j.result.plan.phases[0].label, "Discovery");
});

test("a failed job carries why, so the user is told something real", async () => {
  await createJob({ id: "j4", kind: "intake", payload: {} });
  await updateJob("j4", { state: "failed", error: "The model's response could not be read." });
  const j = await getJob("j4");
  assert.equal(j.state, "failed");
  assert.match(j.error, /could not be read/);
});

test("polling a job that does not exist returns nothing rather than throwing", async () => {
  assert.equal(await getJob("nope"), null);
});

test("an empty update is a no-op, not a corruption", async () => {
  await createJob({ id: "j5", kind: "intake", payload: {} });
  await updateJob("j5", {});
  const j = await getJob("j5");
  assert.equal(j.state, "queued", "nothing was asked for, so nothing changed");
});

test("old jobs are pruned, recent ones are kept", async () => {
  await createJob({ id: "j6", kind: "intake", payload: {} });
  await pruneJobs(24);
  assert.ok(await getJob("j6"), "a job created seconds ago survives a 24-hour prune");
  await pruneJobs(0);
  assert.equal(await getJob("j6"), null, "and is removed once it is old enough");
});
