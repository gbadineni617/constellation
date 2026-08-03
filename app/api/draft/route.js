import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Drafts an onboarding nudge.
 *
 * Note what this route does NOT do: it does not decide whether a nudge is
 * warranted. That judgement is made by assess() in lib/journey.js, in plain
 * arithmetic, before anything reaches here. This endpoint only turns an
 * already-decided situation into words.
 */
export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  }

  let prompt;
  try {
    ({ prompt } = await req.json());
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Missing prompt." }, { status: 400 });
  }
  if (prompt.length > 12000) {
    return Response.json({ error: "Prompt too large." }, { status: 413 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const msg = await client.messages.create({
      model: process.env.CONSTELLATION_MODEL || "claude-sonnet-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content || []).map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      // Model didn't return clean JSON — degrade to the raw text rather than failing.
      parsed = { subject: "", body: clean, why: "" };
    }

    return Response.json({
      subject: String(parsed.subject || ""),
      body: String(parsed.body || ""),
      why: String(parsed.why || ""),
    });
  } catch (e) {
    console.error("draft failed:", e);
    const status = e?.status || 502;
    // Pass the real reason through. A vague "could not reach the model" hides a
    // wrong model name or a bad key, which are the two things that actually happen.
    const detail = e?.error?.error?.message || e?.message || String(e);
    const message =
      status === 429 ? "Rate limited — try again shortly."
      : status === 401 ? "That API key was rejected. Check ANTHROPIC_API_KEY in .env.local."
      : status === 404 ? "The model name is wrong: " + detail
      : status === 400 ? "The request was rejected: " + detail
      : "Could not reach the model: " + detail;
    return Response.json({ error: message }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}
