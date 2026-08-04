import { listJourneys, saveJourney, MODE } from "@/lib/db";
import { json, preflight, authorised, unauthorised } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pre-flight, so a custom app on a Smartcat domain can call this at all. */
export function OPTIONS(req) {
  return preflight(req);
}

export async function GET(req) {
  if (!authorised(req)) return unauthorised(req);

  try {
    const journeys = await listJourneys();
    return json(req, { journeys, mode: MODE });
  } catch (e) {
    console.error("[journeys] list failed:", e);
    return json(req, { error: "Could not load journeys.", detail: String(e.message || e) }, { status: 500 });
  }
}

export async function POST(req) {
  if (!authorised(req)) return unauthorised(req);

  let rec;
  try { rec = await req.json(); }
  catch { return json(req, { error: "Malformed request." }, { status: 400 }); }

  if (!rec?.id || !rec?.customer) {
    return json(req, { error: "A journey needs an id and a customer." }, { status: 400 });
  }
  try {
    await saveJourney(rec);
    return json(req, { ok: true, id: rec.id });
  } catch (e) {
    console.error("[journeys] create failed:", e);
    return json(req, { error: "Could not save that journey." }, { status: 500 });
  }
}
