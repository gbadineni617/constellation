import Anthropic from "@anthropic-ai/sdk";
import { readFiles, MAX_FILES, MAX_FILE_BYTES, SUPPORTED_LABEL } from "@/lib/extract";
import { coerceIntake, CONTENT_TYPES, MATURITIES, DELIVERIES } from "@/lib/intake";
import { coerceJourneyPlan, ANCHORS, MAX_STEPS_PER_PHASE } from "@/lib/spine";
import { REVIEW_MODEL_IDS, SPECIALIZATIONS, TURNAROUNDS, CERTIFICATIONS, PAIR_STATE_IDS } from "@/lib/marketplace";
import { findReferences, saveDocument } from "@/lib/db";
import { pickReferences, formatReferences, commonPatterns, formatPatterns } from "@/lib/corpus";

export const runtime = "nodejs";
/**
 * Vercel's Hobby plan caps functions at 60s and older projects at 10s. Declaring
 * more than the plan allows does not extend it — the platform kills the request
 * and returns an HTML error page, which is what produced "Unexpected token 'A'".
 * Keep this at or under the plan limit, and keep the work inside it.
 */
export const maxDuration = 60;


const ANCHOR_LIST = ANCHORS.map((a) => "  \"" + a.id + "\" — " + a.label).join("\n");

const INSTRUCTIONS = `You are reading an onboarding intake document for Smartcat — a call transcript, kickoff notes, an email thread, an RFP response, or a brief. Your job is to design this specific customer's onboarding journey.

You may be given several documents about the same customer — a brief, a call transcript, an email thread, a spreadsheet tracker. Read all of them together as one picture.

Pull out only what the documents actually say. Do not invent facts. If something is not stated, return an empty string. A human is about to review this, so a gap is far more useful than a plausible guess.

## Where they already are

Most customers are not starting from nothing. They may already have a workspace, already have run a pilot, already be mid-rollout. A journey that starts at zero for a customer who is halfway through is wrong and insulting.

So for every step, set "status":
- "done" — the documents say this already happened
- "active" — the documents say this is underway right now
- "open" — everything else. **This is the default and you should use it for most steps.**

Whenever you set "done" or "active", you MUST also set "evidence": the specific phrase from the documents that justifies it, quoted. No evidence means the status is "open".

Be conservative in one particular direction: it is much worse to mark something complete that is not, than to mark something open that is finished. A wrongly-completed step tells a customer they signed off on something they did not. If a spreadsheet tracker marks a row done, that is strong evidence. If prose merely implies it, that is weak — prefer "open".

Set "stage" to the phase they are currently working through, based on what is done.

Return ONLY a JSON object. No markdown fences, no preamble.

{
  "customer": "organisation or team name",
  "useCase": "what they are trying to achieve, one or two sentences",
  "pain": "what is painful or slow today, in their own framing",
  "goLive": "target date or timeframe as written",
  "metrics": "how they will judge success",
  "team": "named people and their roles, comma separated",
  "integrations": "systems mentioned as in scope",
  "contentPath": ${JSON.stringify(CONTENT_TYPES)},
  "contentPathReason": "the phrase in the document that led you here",
  "maturity": ${JSON.stringify(MATURITIES)},
  "maturityReason": "the phrase that led you here",
  "delivery": ${JSON.stringify(DELIVERIES)},
  "deliveryReason": "the phrase that led you here",
  "connector": "name of the source system, only if delivery is connected",
  "industry": "the customer's industry, as they describe it",
  "reviewModel": ${JSON.stringify(REVIEW_MODEL_IDS)},
  "reviewModelReason": "the phrase that led you here",
  "specialization": ${JSON.stringify(SPECIALIZATIONS)},
  "turnaround": ${JSON.stringify(TURNAROUNDS)},
  "pairs": [ { "source": "en-GB", "target": "de-DE", "state": "scoping", "reviewers": 1, "certification": "None", "note": "" } ],
  "stage": "the id of the phase they are currently in, given what the document describes",
  "rationale": "one or two sentences on what makes this customer's path different from a generic one",
  "phases": [ ... ]
}

## Who reviews, and which languages

"reviewModel" is one of:
- "unknown" — the document does not say who reviews. **This is the correct answer most of the time. Use it freely.**
- "ai_only" — the document says explicitly that no human review is wanted
- "internal" — the document names the customer's own reviewers or says their team reviews
- "marketplace" — the document says they need Smartcat to supply linguists
- "hybrid" — the document says they have reviewers for some locales and need linguists sourced for others

Marketplace involvement is expensive to assume: it adds a whole phase and a go-live gate. So only choose "marketplace" or "hybrid" when the document actually says the customer lacks reviewers or wants Smartcat to find them. Phrases like "we don't have anyone for APAC", "can you supply reviewers", or "no in-market team for X" justify it. A general mention of the Marketplace, or the mere absence of named reviewers, does not — return "unknown" instead.

Never infer "internal" from silence either. If nobody is named and nothing is said, that is "unknown", and a human will ask.

"pairs" should be empty unless the document actually lists language pairs.

"pairs" is one entry per source-to-target language pair actually in scope. Use BCP-47 codes as written in the documents — en-GB, de-DE, fr-CA, zh-CN. Do not invent locales, and do not include ones the documents explicitly park or defer.

Set "state" per pair from what the documents say:
- "active" — already translating in this pair
- "approved" — a named reviewer or linguist is confirmed
- "trial" — candidates are being tested
- "sourcing" — Smartcat is already looking
- "scoping" — needed, but nothing has happened yet. Use this when unsure.

If a document names a reviewer for a locale, that pair is "approved" and you should put the name in "note". If it says there is no in-region reviewer, that pair is "scoping" and the note should say so — those are the pairs that will need sourcing.

Set "certification" to something other than "None" only where the documents imply a credential is needed, such as legal or sworn translation for a regulated market.

"specialization" drives how linguists get matched, so pick from the domain of the content, not the size of the company. Leave it empty if the document gives you nothing to go on.

## Designing the phases

Six phases are required and must always appear, with exactly these ids:

${ANCHOR_LIST}

You may retitle them, write their steps, and set their week. You may not omit them and you may not reorder them. They are gates in the onboarding methodology.

Between "setup" and "uat" you should add phases that this specific customer actually needs. Give those an "id" of null or omit it. This is where the journey earns its keep — a customer connecting an LMS needs an integration phase, a customer with SCORM interactions needs a QA phase, a customer inheriting translation memory needs an asset-validation phase, a customer with legal or procurement gates needs those too. A customer dropping Word documents into a browser needs none of that, and should have a short path.

Do not pad. Three or four added phases for a complex engagement; zero or one for a simple one. If the document does not justify a phase, leave it out.

Each phase looks like:

{
  "id": "one of the six anchor ids, or omitted for a phase you are adding",
  "label": "short name, under six words",
  "week": "when, e.g. \"Week 2\" or \"Weeks 2-3\"",
  "surface": "workspace" | "translations" | "demo",
  "blurb": "one or two sentences a customer reads. Plain language, no jargon, says what happens.",
  "proof": "how they will know this phase is finished. Concrete and checkable.",
  "steps": [
    { "text": "a single concrete action, under 20 words", "owner": "the person's name from the documents, or \"Smartcat\"", "note": "short detail, only if the documents support it", "status": "open" | "active" | "done", "evidence": "the quoted phrase justifying a done/active status, otherwise empty" }
  ]
}

Rules for steps:
- At most ${MAX_STEPS_PER_PHASE} per phase. Three to six is usually right.
- Use real names from the document as owners. If it is Smartcat's job, put "Smartcat".
- Every "done" or "active" needs quoted evidence. Without it, use "open".
- Reference the customer's actual systems, file formats, locales and constraints. "Validate TMX locale codes for merged markets" is useful. "Set up translation memory" is not.
`;

const CLASSIFY_INSTRUCTIONS = `Read this onboarding document and classify it. Nothing else — no phases, no steps.

Return ONLY JSON, no fences:

{
  "customer": "organisation name, or empty",
  "contentPath": ${JSON.stringify(CONTENT_TYPES)},
  "maturity": ${JSON.stringify(MATURITIES)},
  "delivery": ${JSON.stringify(DELIVERIES)},
  "reviewModel": ${JSON.stringify(REVIEW_MODEL_IDS)},
  "specialization": ${JSON.stringify(SPECIALIZATIONS)},
  "industry": "their industry as described, or empty"
}

Use "unknown" for reviewModel unless the document says who reviews. Use "Document & text" and "manual" when unclear. Leave specialization and industry empty rather than guessing.`;

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not set on the server." }, { status: 500 });
  }

  let body;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Malformed request." }, { status: 400 }); }

  // Accepts either a single file (the old shape) or several at once. Real
  // accounts have material scattered across a brief, a transcript and a tracker,
  // and reading them together is the difference between a partial picture and
  // an accurate one.
  const files = Array.isArray(body?.files)
    ? body.files
    : body?.content
    ? [{ name: body.filename || "pasted notes", kind: body.kind, content: body.content }]
    : [];

  if (!files.length) return Response.json({ error: "Nothing to read." }, { status: 400 });
  if (files.length > MAX_FILES) {
    return Response.json({ error: "Up to " + MAX_FILES + " files at a time." }, { status: 400 });
  }
  for (const f of files) {
    if (typeof f?.content === "string" && f.content.length > MAX_FILE_BYTES) {
      return Response.json({ error: (f.name || "That file") + " is too large. Keep files under 6 MB." }, { status: 413 });
    }
  }

  let read;
  try {
    read = await readFiles(files);
  } catch (e) {
    return Response.json({ error: e.message || "Could not read those files." }, { status: 400 });
  }

  const messageContent = [...read.blocks, { type: "text", text: read.header + INSTRUCTIONS }];

  const parseJson = (msg) => {
    const text = (msg.content || []).map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    return JSON.parse(text.replace(/```json/g, "").replace(/```/g, "").trim());
  };

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Pass one: classify only. Cheap, and it is the only way to know which past
    // journeys are comparable before designing this one. Retrieval needs traits,
    // and traits come from reading the document.
    //
    // It is also the expendable half. If the corpus has nothing to retrieve, the
    // call buys nothing and costs seconds we may not have — so skip it entirely.
    const started = Date.now();
    let references = [];
    let patterns = null;
    try {
      const corpus = await findReferences();
      if (!corpus.length) throw new Error("empty corpus — classification would buy nothing");

      const classify = await client.messages.create({
        model: process.env.CONSTELLATION_MODEL || "claude-sonnet-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: [...read.blocks, { type: "text", text: read.header + CLASSIFY_INSTRUCTIONS }],
        }],
      });
      const traits = parseJson(classify);
      const pool = corpus;

      // Two ways the corpus contributes, and they scale differently.
      //
      // Conventions come from EVERY comparable journey, as frequencies. Unbounded,
      // reproducible, and immune to dilution because it is arithmetic, not examples.
      //
      // Worked examples come from the closest handful only. Bounded on purpose: past
      // a few, the model averages them and output drifts toward their mean.
      patterns = commonPatterns(traits, pool);
      references = pickReferences(traits, pool);

      const extra = formatPatterns(patterns) + formatReferences(references);
      if (extra) {
        const last = messageContent[messageContent.length - 1];
        if (last?.type === "text") last.text = last.text + extra;
      }
    } catch (e) {
      // A failed first pass must never block the real one.
      console.error("classification / retrieval skipped:", e.message);
    }

    const msg = await client.messages.create({
      model: process.env.CONSTELLATION_MODEL || "claude-sonnet-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: messageContent }],
    });

    let parsed;
    try { parsed = parseJson(msg); }
    catch { return Response.json({ error: "Could not make sense of that document." }, { status: 422 }); }

    // The model proposed. Code decides what is allowed through — both for the
    // intake fields and, more importantly, for the shape of the journey itself.
    const intake = coerceIntake(parsed);
    const plan = coerceJourneyPlan(parsed, { reviewModel: intake.reviewModel });

    // Keep the source material. Without this, every run before the corpus exists
    // is data thrown away.
    for (const doc of read.stored) {
      try {
        await saveDocument({ filename: doc.name, kind: doc.kind, content: doc.text, bytes: doc.text.length });
      } catch (e) {
        console.error("could not store " + doc.name + ":", e.message);
      }
    }

    return Response.json({
      ...intake,
      plan,
      files: read.manifest,
      claims: plan.claims,
      unevidenced: plan.unevidenced,
      references: references.map(({ rec, ...meta }) => meta),
      patternsPending: patterns && !patterns.enough
        ? { sampled: patterns.sampled, needed: patterns.needed }
        : null,
      patterns: patterns?.enough
        ? { sampled: patterns.sampled, phases: patterns.phases.length, steps: patterns.steps.length }
        : null,
    });
  } catch (e) {
    console.error("intake failed:", e);
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
