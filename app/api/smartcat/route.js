import { testConnection } from "@/lib/smartcat";
import { json, preflight, authorised, unauthorised } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pre-flight, so a custom app on a Smartcat domain can call this at all. */
export function OPTIONS(req) {
  return preflight(req);
}

/** Is Smartcat connected, and what can it see? */
export async function GET(req) {
  if (!authorised(req)) return unauthorised(req);

  const result = await testConnection();
  return json(req, result, { status: result.ok || !result.configured ? 200 : 502 });
}
