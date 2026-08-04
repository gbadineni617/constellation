import { listDocuments, MODE } from "@/lib/db";
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
    const documents = await listDocuments(50);
    return json(req, { documents, mode: MODE });
  } catch (e) {
    console.error("[documents] list failed:", e);
    return json(req, { error: "Could not load the library." }, { status: 500 });
  }
}
