import { getJourney, saveJourney, deleteJourney } from "@/lib/db";
import { json, preflight, authorised, unauthorised } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pre-flight, so a custom app on a Smartcat domain can call this at all. */
export function OPTIONS(req) {
  return preflight(req);
}

export async function GET(req, { params }) {
  if (!authorised(req)) return unauthorised(req);

  const { id } = await params;
  const rec = await getJourney(id);
  if (!rec) return json(req, { error: "No such journey." }, { status: 404 });
  return json(req, rec);
}

export async function PUT(req, { params }) {
  if (!authorised(req)) return unauthorised(req);

  const { id } = await params;
  let rec;
  try { rec = await req.json(); }
  catch { return json(req, { error: "Malformed request." }, { status: 400 }); }

  // The id in the path wins, so a client can never rename a record by accident
  try {
    await saveJourney({ ...rec, id });
    return json(req, { ok: true, id });
  } catch (e) {
    console.error("[journeys] save failed:", e);
    return json(req, { error: "Could not save." }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  if (!authorised(req)) return unauthorised(req);

  const { id } = await params;
  await deleteJourney(id);
  return json(req, { ok: true });
}
