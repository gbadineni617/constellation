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
import { checklistPrompt, resolveTier } from "@/lib/checklist";
import { CLASSIFY_TOOL, DESIGN_TOOL, toolResult } from "@/lib/schemas";
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

The customer has already been read and classified — those facts are given to you below. **Your job is the phases.** Do not re-derive the classification, do not restate the brief, do not explain your reasoning.

Return ONLY a JSON object. No markdown fences, no preamble.

**Write "phases" first and in full.** Everything else in the object is metadata that takes seconds; the phases are the deliverable. Responses that describe the engagement at length and then run out of room before finishing the phases are worthless — a complete set of phases with a terse rationale beats an eloquent rationale with three empty phases.

{
  "phases": [ ... ],          <-- WRITE THIS FIRST. It is the whole point of the response.
  "rationale": "at most two sentences on what makes this customer's path different",
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
  "stage": "the id of the phase they are currently in"
}

## Classifying the engagement

**contentPath** — pick the type that carries the most risk, not the one mentioned most often. A customer with SCORM courses AND documents is "e-Learning", because the courses are what breaks.
- "e-Learning" if SCORM, xAPI, Rise, Storyline, Articulate, Captivate or an LMS appears anywhere in scope. This wins over documents, and over video.
- "Video & audio" if video, subtitles, captions, SRT, VTT, dubbing or voiceover is in scope and there is no e-learning.
- "Document & text" only when neither of the above applies.

**tier** — which implementation checklist applies. "teams" for Teams or Accelerate plans: smaller, session-based, usually one team and one use case. "enterprise" for Enterprise, Business or Autonomous+ plans: multiple workspaces or teams, integrations, several content types, a named FDE, a formal go-live date. When the documents do not say the plan outright, judge by shape — an engagement with integrations, multiple locales and a compliance deadline is enterprise. Default to "enterprise" when genuinely unclear: it is the fuller path, and removing steps is safer than discovering missing ones.

**delivery** — "connected" if a CMS, LMS, repository or named system should feed content automatically. If the documents describe people exporting and uploading by hand, that is "manual" — but note the intent: a customer who says the manual step is the problem is asking for "connected".

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

## Your job: adapt the checklist below

You are not designing a journey from nothing. This team has a real implementation checklist and it is given to you in full further down. **Return that checklist, adapted to this customer.**

That means, for every stage:

- Return the stage with its "id" exactly as given.
- Return its steps, in order, with the wording made concrete for this customer where their own terms are clearer. "Pick 1 real file to translate in the UAT" becomes "Pick one Rise course to translate in the UAT" when that is what they have. Do not rewrite a step into something different — sharpen it.
- Add steps this customer genuinely needs that the checklist does not cover, with "added": true.
- Mark a step "status": "na" when the documents make clear it does not apply.

Add a whole new stage only when the customer needs work the checklist has no room for — proving a format round-trips, validating right-to-left layout, a procurement or security gate, a pilot that gates a wider rollout. Give an added stage no "id", and place it where it belongs in the sequence.

Each stage looks like:

{
  "id": "the stage id from the checklist, or omitted for a stage you are adding",
  "label": "the stage name — keep the checklist's unless the customer's language is clearly better",
  "week": "when",
  "blurb": "one sentence a customer reads",
  "proof": "how they will know this stage is finished",
  "steps": [
    { "text": "the step, made concrete for this customer", "owner": "a name from the documents, or \"Smartcat\"", "note": "short detail only if the documents support it", "status": "open" | "active" | "done" | "na", "evidence": "quoted phrase, required for done/active", "added": true }
  ]
}

Be economical. Every phase should earn its place and every step should be one short line. Do not restate the customer's situation back at length — the blurb is one or two sentences, not a paragraph.

Rules for steps:
- At most ${MAX_STEPS_PER_PHASE} per phase. Three to six is usually right.
- Use real names from the document as owners. If it is Smartcat's job, put "Smartcat".
- Every "done" or "active" needs quoted evidence. Without it, use "open".
- Reference the customer's actual systems, file formats, locales and constraints. "Validate TMX locale codes for merged markets" is useful. "Set up translation memory" is not.
`;

/**
 * Pass one. Classification and extraction only — no phases.
 *
 * Kept separate from the design pass on purpose. When both were asked for in one
 * response, the model spent its budget describing the engagement and ran out
 * before finishing the phases: five of six came back empty while the rationale
 * was three eloquent lines. Two calls, each with room, is the fix.
 */
const CLASSIFY_INSTRUCTIONS = `Read these onboarding documents and extract the facts. Do NOT design a journey — no phases, no steps. That happens separately.

Return ONLY JSON, no fences:

{
  "customer": "organisation or team name",
  "useCase": "what they are trying to achieve, one or two sentences",
  "pain": "what is painful or slow today, in their own framing",
  "goLive": "target date or timeframe as written",
  "metrics": "how they will judge success",
  "team": "named people and their roles, comma separated",
  "integrations": "systems mentioned as in scope",
  "industry": "their industry, as they describe it",
  "tier": "teams" or "enterprise",
  "tierReason": "the phrase that led you here",
  "contentPath": ${JSON.stringify(CONTENT_TYPES)},
  "contentPathReason": "the phrase that led you here",
  "maturity": ${JSON.stringify(MATURITIES)},
  "maturityReason": "the phrase that led you here",
  "delivery": ${JSON.stringify(DELIVERIES)},
  "deliveryReason": "the phrase that led you here",
  "connector": "name of the source system, only if delivery is connected",
  "reviewModel": ${JSON.stringify(REVIEW_MODEL_IDS)},
  "reviewModelReason": "the phrase that led you here",
  "specialization": ${JSON.stringify(SPECIALIZATIONS)},
  "turnaround": ${JSON.stringify(TURNAROUNDS)},
  "pairs": [ { "source": "en-GB", "target": "de-DE", "state": "scoping", "reviewers": 1, "certification": "None", "note": "" } ]
}

**contentPath** — pick the type that carries the most risk, not the one mentioned most often. "e-Learning" if SCORM, xAPI, Rise, Storyline, Articulate, Captivate or an LMS appears anywhere in scope; this wins over documents and over video. "Video & audio" if video, subtitles, captions, SRT, VTT, dubbing or voiceover is in scope and there is no e-learning. "Document & text" only when neither applies.

**tier** — which implementation checklist applies. "teams" for Teams or Accelerate plans: smaller, session-based, usually one team and one use case. "enterprise" for Enterprise, Business or Autonomous+ plans: multiple workspaces or teams, integrations, several content types, a named FDE, a formal go-live date. When the documents do not say the plan outright, judge by shape — an engagement with integrations, multiple locales and a compliance deadline is enterprise. Default to "enterprise" when genuinely unclear: it is the fuller path, and removing steps is safer than discovering missing ones.

**delivery** — "connected" if a CMS, LMS, repository or named system should feed content automatically. Note the intent: a customer who says the manual export step is their problem is asking for "connected".

**reviewModel** — decide, do not hedge. Any of these is "hybrid", and it is the most common enterprise shape:
- "internal SMEs by locale, Marketplace as overflow"
- "we have reviewers for X and Y, nothing for Z"
- "use Marketplace for languages without internal coverage"
- named reviewers for some locales and none for others

"internal" when their own people review and no external sourcing is mentioned. "marketplace" when Smartcat supplies linguists for all or most locales. "ai_only" when they say explicitly that no human review is wanted. "unknown" ONLY when the documents are silent on the subject — if they name reviewers, describe review stages, or mention sourcing in any form, one of the others applies.

**pairs** — one entry per source-to-target pair actually in scope, BCP-47 as written. Do not invent locales and do not include ones the documents park or defer. If a reviewer is named for a locale, that pair is "approved" and the name goes in "note". If there is no in-region reviewer, it is "scoping" and the note should say so.

Leave any field empty rather than guessing.`;



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
  // The checklist is appended after classification, once the tier is known.

  const rawText = (msg) =>
    (msg.content || []).map((c) => (c.type === "text" ? c.text : "")).join("").trim();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Pass one: classify, so we know which past journeys are comparable. Skipped
  // entirely when the corpus is empty, because it would retrieve nothing.
  await onProgress({ step: "Reading the brief", progress: 18 });

  // Pass one: extract and classify. Always run, not only when a corpus exists —
  // it is what stops the design pass spending its budget on metadata.
  let facts = {};
  try {
    const msg = await client.messages.create({
      model: process.env.CONSTELLATION_MODEL || "claude-sonnet-5",
      // Classification is a judgement about facts, not a creative task.
      // No temperature: deprecated on this model, and the API rejects the whole
      // request if it is sent. Consistency comes from the tool schema instead —
      // enforced enums mean the fields that reshape a journey cannot drift.
      // Generous: the schema has 22 fields and a language-pair array. The
      // previous 1500 truncated the response, and the recovery kept only what
      // had been written before the cut — which was the first field and nothing
      // else. Every other value then fell back to a default, silently.
      max_tokens: 4000,
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "tool", name: CLASSIFY_TOOL.name },
      messages: [{ role: "user", content: [...read.blocks, { type: "text", text: read.header + CLASSIFY_INSTRUCTIONS }] }],
    });

    const result = toolResult(msg, CLASSIFY_TOOL.name);
    if (result) {
      facts = result;
      console.log("[intake] classified:", JSON.stringify({
        customer: facts.customer, tier: facts.tier, contentPath: facts.contentPath,
        delivery: facts.delivery, reviewModel: facts.reviewModel,
        pairs: (facts.pairs || []).length,
      }));
    } else {
      console.error("[intake] classification returned no tool call. stop_reason:", msg.stop_reason);
    }
    if (msg.stop_reason === "max_tokens") {
      console.warn("[intake] classification hit the token cap — some fields may be missing");
    }
  } catch (e) {
    console.error("[intake] classification threw:", e?.message || e);
    if (e?.status) console.error("[intake]   status:", e.status, "type:", e?.error?.error?.type);
  }

  let references = [];
  let patterns = null;
  try {
    const corpus = await findReferences();
    if (corpus.length) {
      await onProgress({ step: "Finding comparable journeys", progress: 28 });
      patterns = commonPatterns(facts, corpus);
      references = pickReferences(facts, corpus);
    }
  } catch (e) {
    console.error("[intake] retrieval skipped:", e.message);
  }

  // Hand the design pass what we already know, so it does not have to work it
  // out again — and so it can spend everything it has on the phases.
  const known = [
    "",
    "## What has already been established about this customer",
    "",
    "You do not need to work these out again. Design the journey around them.",
    "",
    facts.customer ? "Customer: " + facts.customer : "",
    facts.useCase ? "Goal: " + facts.useCase : "",
    facts.contentPath ? "Content type: " + facts.contentPath : "",
    facts.delivery ? "Delivery: " + facts.delivery + (facts.connector ? " via " + facts.connector : "") : "",
    facts.maturity ? "Linguistic assets: " + facts.maturity : "",
    facts.reviewModel && facts.reviewModel !== "unknown" ? "Review model: " + facts.reviewModel : "",
    facts.goLive ? "Go-live: " + facts.goLive : "",
    facts.pain ? "The pain to remove: " + facts.pain : "",
    (facts.pairs || []).length ? "Language pairs: " + facts.pairs.map((p) => p.source + ">" + p.target).join(", ") : "",
    "",
  ].filter(Boolean).join("\n");

  // The checklist for this tier is the structure the model adapts. It goes in
  // after classification, because the tier decides which checklist applies.
  if (!facts.customer) {
    // Proceeding is still better than failing — the phases are useful even
    // without the metadata — but this must never be silent again.
    console.warn("[intake] classification produced no customer; the record will be sparse");
  }

  const tier = resolveTier(facts.tier);
  const checklist = checklistPrompt({
    tier,
    contentPath: facts.contentPath || "Document & text",
    connected: facts.delivery === "connected",
    sourcing: facts.reviewModel === "marketplace" || facts.reviewModel === "hybrid",
  });

  {
    const last = messageContent[messageContent.length - 1];
    if (last?.type === "text") {
      last.text = last.text + known + checklist + formatPatterns(patterns) + formatReferences(references);
    }
  }

  await onProgress({ step: "Designing the journey", progress: 35 });

  const stream = await client.messages.stream({
    model: process.env.CONSTELLATION_MODEL || "claude-sonnet-5",
    // Low but not zero: the wording benefits from a little latitude, the
    // structure does not — and the structure now comes from the checklist.
    // No temperature: deprecated on this model, and the API rejects the whole
    // request if it is sent. Consistency comes from the tool schema instead —
    // enforced enums mean the fields that reshape a journey cannot drift.
    max_tokens: 8000,
    tools: [DESIGN_TOOL],
    tool_choice: { type: "tool", name: DESIGN_TOOL.name },
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

  // A tool result arrives as a structured object, so there is nothing to parse.
  // parseLoose stays as a fallback for the case where the model answers in prose
  // despite being told to use the tool.
  let parsed = toolResult(msg, DESIGN_TOOL.name);
  if (!parsed) {
    const attempt = parseLoose(rawText(msg));
    if (!attempt.ok) {
      console.error("[intake] no tool call and unparseable text. stop_reason:", msg.stop_reason);
      throw new Error("The model's response could not be read. Try one document rather than several.");
    }
    console.warn("[intake] design pass answered in prose rather than the tool; recovered it");
    parsed = attempt.value;
  }
  if (msg.stop_reason === "max_tokens") {
    console.warn("[intake] design pass hit the token cap — later stages may be thin");
  }
  console.log("[intake] designed:", (parsed.phases || []).length, "phases,",
    (parsed.phases || []).reduce((n, p) => n + (p.steps || []).length, 0), "steps");

  // The classification pass is the authority on facts; the design pass is the
  // authority on phases. Merging this way means a design response that ran short
  // on metadata still gets a fully classified journey.
  // Facts come from classification only. The design pass is not asked for them
  // and its tool schema does not include them, so merging the other way round
  // would mean an empty classification silently produced an empty record —
  // which is exactly what happened when the classify response was truncated.
  const intake = coerceIntake(facts);
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
    truncated: msg.stop_reason === "max_tokens",
    claims: plan.claims,
    unevidenced: plan.unevidenced,
    references: references.map(({ rec, ...meta }) => meta),
    patternsPending: patterns && !patterns.enough ? { sampled: patterns.sampled, needed: patterns.needed } : null,
    patterns: patterns?.enough ? { sampled: patterns.sampled, phases: patterns.phases.length, steps: patterns.steps.length } : null,
  };
}
