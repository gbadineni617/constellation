import { waitUntil } from "@vercel/functions";
import { createJob, updateJob, pruneJobs } from "@/lib/db";
import { runIntake } from "@/lib/intake-worker";
import { MAX_FILES, MAX_FILE_BYTES } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** The response returns in ~200ms; this covers the background work that outlives it. */
export const maxDuration = 300;

/**
 * Accept the upload, respond immediately, and keep working.
 *
 * Designing a journey takes ~45 seconds, which exceeds the ceiling for a request
 * the user is waiting on. The first attempt at this kicked a second endpoint with
 * a fire-and-forget fetch — but a serverless platform is entitled to freeze an
 * invocation the moment it responds, so the kick often never arrived and jobs sat
 * queued forever.
 *
 * `waitUntil` is the supported way to say "respond now, but do not freeze me yet".
 * One invocation, no inter-function hop, nothing to lose in between.
 */
export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  }

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Malformed request." }, { status: 400 }); }

  const files = Array.isArray(body?.files)
    ? body.files
    : body?.content
    ? [{ name: body.filename || "pasted notes", kind: body.kind, content: body.content }]
    : [];

  if (!files.length) return Response.json({ error: "Nothing to read." }, { status: 400 });
  if (files.length > MAX_FILES) {
    return Response.json({ error: "Up to " + MAX_FILES + " files at a time." }, { status: 400 });
  }
  for (const f of files) {
    if (typeof f?.content === "string" && f.content.length > MAX_FILE_BYTES) {
      return Response.json({ error: (f.name || "That file") + " is too large. Keep files under 6 MB." }, { status: 413 });
    }
  }

  const id = "job_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  try {
    await createJob({ id, kind: "intake", payload: { files } });
  } catch (e) {
    console.error("[intake] could not queue:", e);
    return Response.json({ error: "Could not start that. Is the database connected?" }, { status: 500 });
  }

  const work = (async () => {
    try {
      await updateJob(id, { state: "running", step: "Reading your documents", progress: 5 });
      const result = await runIntake({ files, onProgress: (p) => updateJob(id, p) });
      await updateJob(id, { state: "done", step: "Done", progress: 100, result });
    } catch (e) {
      console.error("[intake] job " + id + " failed:", e);
      await updateJob(id, { state: "failed", error: e.message || "Generation failed.", progress: 100 }).catch(() => {});
    }
  })();

  // Locally there is no platform to tell, so just let it run.
  try { waitUntil(work); } catch { /* not on Vercel */ }

  pruneJobs(24).catch(() => {});

  return Response.json({ id, state: "queued" }, { status: 202 });
}
