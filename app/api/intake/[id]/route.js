import { getJob } from "@/lib/db";
import { json, preflight, authorised, unauthorised } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pre-flight, so a custom app on a Smartcat domain can call this at all. */
export function OPTIONS(req) {
  return preflight(req);
}

/** Poll a job. Cheap and fast — the browser calls this every couple of seconds. */
export async function GET(req, { params }) {
  if (!authorised(req)) return unauthorised(req);

  const { id } = await params;
  const job = await getJob(id);
  if (!job) return json(req, { error: "No such job." }, { status: 404 });

  return json(req, {
    id: job.id,
    state: job.state,
    step: job.step,
    progress: job.progress,
    error: job.error || null,
    result: job.state === "done" ? job.result : null,
  });
}
