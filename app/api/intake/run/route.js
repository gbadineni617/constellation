import { getJob, updateJob } from "@/lib/db";
import { runIntake } from "@/lib/intake-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The worker. Does the slow part.
 *
 * Called by /api/intake and by nothing else. It still has to finish inside the
 * platform's ceiling — but it is a separate invocation, so the user's upload is
 * never the request that gets killed, and they see progress the whole time.
 */
export async function POST(req) {
  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Malformed request." }, { status: 400 }); }

  const { id, secret } = body || {};
  if (!id) return Response.json({ error: "No job id." }, { status: 400 });

  // If a secret is configured, require it — this endpoint should not be publicly runnable.
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }

  const job = await getJob(id);
  if (!job) return Response.json({ error: "No such job." }, { status: 404 });
  if (job.state !== "queued") return Response.json({ ok: true, note: "already " + job.state });

  await updateJob(id, { state: "running", step: "Starting", progress: 3 });

  try {
    const result = await runIntake({
      files: job.payload?.files || [],
      onProgress: (p) => updateJob(id, p),
    });
    await updateJob(id, { state: "done", step: "Done", progress: 100, result });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[intake worker] failed:", e);
    await updateJob(id, { state: "failed", error: e.message || "Generation failed.", progress: 100 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
