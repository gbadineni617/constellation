import { getJob, updateJob } from "@/lib/db";
import { runIntake } from "@/lib/intake-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manual retry for a job that never finished.
 *
 * The normal path runs the work inside POST /api/intake via waitUntil. This exists
 * for the case where that invocation died — a deploy mid-flight, a platform hiccup —
 * leaving a job stuck at "queued". Safe to call: it refuses anything already running
 * or finished, so it cannot double-generate.
 */
export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Malformed request." }, { status: 400 }); }

  const { id, secret } = body || {};
  if (!id) return Response.json({ error: "No job id." }, { status: 400 });

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  const job = await getJob(id);
  if (!job) return Response.json({ error: "No such job." }, { status: 404 });
  if (job.state !== "queued") return Response.json({ ok: true, note: "already " + job.state });

  await updateJob(id, { state: "running", step: "Restarting", progress: 5 });

  try {
    const result = await runIntake({
      files: job.payload?.files || [],
      onProgress: (p) => updateJob(id, p),
    });
    await updateJob(id, { state: "done", step: "Done", progress: 100, result });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[intake retry] failed:", e);
    await updateJob(id, { state: "failed", error: e.message || "Generation failed.", progress: 100 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
