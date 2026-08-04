/**
 * The actual work of designing a journey.
 *
 * Lives here rather than in the route because it takes ~45 seconds — longer than
 * a request should — and is therefore run by a background job. Extracted whole so
 * there is exactly one implementation: the queue calls this, and nothing else
 * duplicates it.
 *
 * `onProgress` exists because 45 seconds of undifferentiated spinner reads as
 * broken. The caller uses it to say what is happening.
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFiles, MAX_FILES, MAX_FILE_BYTES, SUPPORTED_LABEL } from "@/lib/extract";
import { coerceIntake, CONTENT_TYPES, MATURITIES, DELIVERIES } from "@/lib/intake";
import { coerceJourneyPlan, ANCHORS, MAX_STEPS_PER_PHASE } from "@/lib/spine";
import { REVIEW_MODEL_IDS, SPECIALIZATIONS, TURNAROUNDS, CERTIFICATIONS, PAIR_STATE_IDS } from "@/lib/marketplace";
import { findReferences, saveDocument } from "@/lib/db";
import { pickReferences, formatReferences, commonPatterns, formatPatterns } from "@/lib/corpus";
import { parseLoose } from "@/lib/loose-json";


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

Be economical. Every phase should earn its place and every step should be one short line. Do not restate the customer's situation back at length — the blurb is one or two sentences, not a paragraph.

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



export async function runIntake({ files, onProgress = () => {} }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set on the server.");

  await onProgress({ step: "Reading your documents", progress: 8 });

  let read;
  try {
    read = await readFiles(files);
  } catch (e) {
    throw new Error(e.message || "Could not read those files.");
  }

  const messageContent = [...read.blocks, { type: "text", text: read.header + INSTRUCTIONS }];

  const rawText = (msg) =>
    (msg.content || []).map((c) => (c.type === "text" ? c.text : "")).join("").trim();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Pass one: classify, so we know which past journeys are comparable. Skipped
  // entirely when the corpus is empty, because it would retrieve nothing.
  let references = [];
  let patterns = null;
  try {
    const corpus = await findReferences();
    if (corpus.length) {
      await onProgress({ step: "Finding comparable journeys", progress: 20 });

      const classifyStream = await client.messages.stream({
        model: process.env.CONSTELLATION_MODEL || "claude-sonnet-5",
        max_tokens: 400,
        messages: [{ role: "user", content: [...read.blocks, { type: "text", text: read.header + CLASSIFY_INSTRUCTIONS }] }],
      });
      const classified = parseLoose(rawText(await classifyStream.finalMessage()));
      if (classified.ok) {
        patterns = commonPatterns(classified.value, corpus);
        references = pickReferences(classified.value, corpus);
        const extra = formatPatterns(patterns) + formatReferences(references);
        if (extra) {
          const last = messageContent[messageContent.length - 1];
          if (last?.type === "text") last.text = last.text + extra;
        }
      }
    }
  } catch (e) {
    console.error("[intake] classification/retrieval skipped:", e.message);
  }

  await onProgress({ step: "Designing the journey", progress: 35 });

  const stream = await client.messages.stream({
    model: process.env.CONSTELLATION_MODEL || "claude-sonnet-5",
    max_tokens: 8000,
    messages: [{ role: "user", content: messageContent }],
  });

  // Report real progress as tokens arrive, rather than guessing at a duration.
  let ticks = 0;
  stream.on("text", () => {
    if (++ticks % 220 === 0) {
      onProgress({ step: "Designing the journey", progress: Math.min(88, 35 + Math.floor(ticks / 220) * 4) }).catch(() => {});
    }
  });

  const msg = await stream.finalMessage();

  await onProgress({ step: "Checking it against the methodology", progress: 92 });

  const attempt = parseLoose(rawText(msg));
  if (!attempt.ok) {
    console.error("[intake] unparseable response, first 400 chars:", rawText(msg).slice(0, 400));
    throw new Error("The model's response could not be read. Try one document rather than several.");
  }
  if (attempt.repaired) console.warn("[intake] response was truncated; recovered the complete portion");

  const parsed = attempt.value;
  const intake = coerceIntake(parsed);
  const plan = coerceJourneyPlan(parsed, { reviewModel: intake.reviewModel });

  // Keep the source material — the corpus is only worth anything if nothing is thrown away.
  for (const doc of read.stored) {
    try {
      await saveDocument({ filename: doc.name, kind: doc.kind, content: doc.text, bytes: doc.text.length });
    } catch (e) {
      console.error("could not store " + doc.name + ":", e.message);
    }
  }

  await onProgress({ step: "Done", progress: 100 });

  return {
    ...intake,
    plan,
    files: read.manifest,
    truncated: attempt.repaired || msg.stop_reason === "max_tokens",
    claims: plan.claims,
    unevidenced: plan.unevidenced,
    references: references.map(({ rec, ...meta }) => meta),
    patternsPending: patterns && !patterns.enough ? { sampled: patterns.sampled, needed: patterns.needed } : null,
    patterns: patterns?.enough ? { sampled: patterns.sampled, phases: patterns.phases.length, steps: patterns.steps.length } : null,
  };
}
