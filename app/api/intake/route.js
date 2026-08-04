import { createJob, updateJob, pruneJobs } from "@/lib/db";
import { MAX_FILES, MAX_FILE_BYTES } from "@/lib/extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Accept the upload and hand it to a background job.
 *
 * Designing a journey takes ~45 seconds, which exceeds the platform's function
 * ceiling — a request that does the work is a request that gets killed. So this
 * returns a job id immediately and the real work happens in /api/intake/run,
 * with the browser polling /api/intake/[id].
 *
 * No single request is ever long, so the ceiling stops applying.
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

  // Kick the worker without waiting for it. The response must return now.
  const origin = new URL(req.url).origin;
  fetch(origin + "/api/intake/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, secret: process.env.CRON_SECRET || "" }),
  }).catch((e) => {
    console.error("[intake] worker kick failed:", e.message);
    updateJob(id, { state: "failed", error: "Could not start the worker." }).catch(() => {});
  });

  pruneJobs(24).catch(() => {});

  return Response.json({ id, state: "queued" }, { status: 202 });
}
