import { getJob } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Poll a job. Cheap and fast — the browser calls this every couple of seconds. */
export async function GET(_req, { params }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: "No such job." }, { status: 404 });

  return Response.json({
    id: job.id,
    state: job.state,
    step: job.step,
    progress: job.progress,
    error: job.error || null,
    result: job.state === "done" ? job.result : null,
  });
}
