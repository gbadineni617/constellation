import { getJourney, saveJourney, deleteJourney } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const { id } = await params;
  const rec = await getJourney(id);
  if (!rec) return Response.json({ error: "No such journey." }, { status: 404 });
  return Response.json(rec);
}

export async function PUT(req, { params }) {
  const { id } = await params;
  let rec;
  try { rec = await req.json(); }
  catch { return Response.json({ error: "Malformed request." }, { status: 400 }); }

  // The id in the path wins, so a client can never rename a record by accident
  try {
    await saveJourney({ ...rec, id });
    return Response.json({ ok: true, id });
  } catch (e) {
    console.error("[journeys] save failed:", e);
    return Response.json({ error: "Could not save." }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  await deleteJourney(id);
  return Response.json({ ok: true });
}
