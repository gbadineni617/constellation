import { testConnection } from "@/lib/smartcat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Is Smartcat connected, and what can it see? */
export async function GET() {
  const result = await testConnection();
  return Response.json(result, { status: result.ok || !result.configured ? 200 : 502 });
}
