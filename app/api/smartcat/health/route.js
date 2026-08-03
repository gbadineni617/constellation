import { fetchHealth } from "@/lib/health";
import { smartcatConfigured } from "@/lib/smartcat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Real workspace health, replacing the hardcoded arrays.
 *
 * Slow on a large workspace — one call per project, throttled under Smartcat's
 * 4-per-second limit. That is the honest cost of a real number.
 */
export async function GET(req) {
  if (!smartcatConfigured()) {
    return Response.json(
      { error: "Smartcat is not connected. Add SMARTCAT_ACCOUNT_ID and SMARTCAT_API_KEY to .env.local." },
      { status: 400 }
    );
  }
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 60));
  try {
    return Response.json(await fetchHealth({ limit }));
  } catch (e) {
    console.error("[smartcat] health failed:", e);
    return Response.json({ error: e.message || "Could not read the workspace." }, { status: 502 });
  }
}
