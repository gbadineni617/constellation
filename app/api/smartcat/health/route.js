import { fetchHealth } from "@/lib/health";
import { smartcatConfigured } from "@/lib/smartcat";
import { json, preflight, authorised, unauthorised } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pre-flight, so a custom app on a Smartcat domain can call this at all. */
export function OPTIONS(req) {
  return preflight(req);
}
export const maxDuration = 60;

/**
 * Real workspace health, replacing the hardcoded arrays.
 *
 * Slow on a large workspace — one call per project, throttled under Smartcat's
 * 4-per-second limit. That is the honest cost of a real number.
 */
export async function GET(req) {
  if (!authorised(req)) return unauthorised(req);

  if (!smartcatConfigured()) {
    return json(req, 
      { error: "Smartcat is not connected. Add SMARTCAT_ACCOUNT_ID and SMARTCAT_API_KEY to .env.local." },
      { status: 400 }
    );
  }
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 60));
  try {
    return json(req, await fetchHealth({ limit }));
  } catch (e) {
    console.error("[smartcat] health failed:", e);
    return json(req, { error: e.message || "Could not read the workspace." }, { status: 502 });
  }
}
