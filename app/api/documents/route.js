import { listDocuments, MODE } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const documents = await listDocuments(50);
    return Response.json({ documents, mode: MODE });
  } catch (e) {
    console.error("[documents] list failed:", e);
    return Response.json({ error: "Could not load the library." }, { status: 500 });
  }
}
