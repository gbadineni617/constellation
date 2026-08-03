import { listJourneys, saveJourney, MODE } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const journeys = await listJourneys();
    return Response.json({ journeys, mode: MODE });
  } catch (e) {
    console.error("[journeys] list failed:", e);
    return Response.json({ error: "Could not load journeys.", detail: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  let rec;
  try { rec = await req.json(); }
  catch { return Response.json({ error: "Malformed request." }, { status: 400 }); }

  if (!rec?.id || !rec?.customer) {
    return Response.json({ error: "A journey needs an id and a customer." }, { status: 400 });
  }
  try {
    await saveJourney(rec);
    return Response.json({ ok: true, id: rec.id });
  } catch (e) {
    console.error("[journeys] create failed:", e);
    return Response.json({ error: "Could not save that journey." }, { status: 500 });
  }
}
