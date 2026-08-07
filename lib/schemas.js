import { CONTENT_TYPES, MATURITIES, DELIVERIES } from "./intake.js";
import { REVIEW_MODEL_IDS, SPECIALIZATIONS, TURNAROUNDS, CERTIFICATIONS, PAIR_STATE_IDS } from "./marketplace.js";
import { TIER_IDS } from "./checklist.js";

/**
 * Tool schemas for the two model calls.
 *
 * These replaced "return only JSON" prose, which failed in a way that was hard
 * to see: the classification schema grew to 22 fields including an array of
 * language pairs, the response ran past its token budget, and the truncation
 * recovery kept whatever had been written before the cut. Since `customer` was
 * the first field, `customer` was the only field that survived — and every
 * other value silently fell back to a default.
 *
 * A tool schema fixes the class of problem rather than that instance:
 *   - the model must return a conforming object, so fields cannot be dropped
 *   - enums are enforced, so a hallucinated content type cannot arrive at all
 *   - there is no prose to parse, so no fences, preamble or partial JSON
 *
 * The coercion layer stays regardless. A schema constrains shape, not judgement.
 */

const enumOf = (values, description) => ({ type: "string", enum: values, description });
const text = (description, maxLength) => ({ type: "string", description, ...(maxLength ? { maxLength } : {}) });

export const CLASSIFY_TOOL = {
  name: "record_customer",
  description: "Record the facts extracted from the onboarding documents. Leave a field empty rather than guessing.",
  input_schema: {
    type: "object",
    properties: {
      customer: text("Organisation or team name"),
      useCase: text("What they are trying to achieve, one or two sentences"),
      pain: text("What is painful or slow today, in their own framing"),
      goLive: text("Target date or timeframe, as written"),
      metrics: text("How they will judge success"),
      team: text("Named people and their roles, comma separated"),
      integrations: text("Systems mentioned as in scope"),
      industry: text("Their industry, as they describe it"),

      tier: enumOf(TIER_IDS,
        "Which implementation checklist applies. 'teams' for Teams or Accelerate: session-based, usually one team and one use case. 'enterprise' for Enterprise, Business or Autonomous+: multiple teams or workspaces, integrations, several content types, a named FDE, a formal go-live date. Default to enterprise when unclear."),
      tierReason: text("The phrase that led you to that tier"),

      contentPath: enumOf(CONTENT_TYPES,
        "Pick the type that carries the most risk, not the one mentioned most often. 'e-Learning' if SCORM, xAPI, Rise, Storyline, Articulate, Captivate or an LMS appears anywhere in scope — this wins over documents and over video. 'Video & audio' if video, subtitles, captions, SRT, VTT, dubbing or voiceover is in scope and there is no e-learning. 'Document & text' only when neither applies."),
      contentPathReason: text("The phrase that led you there"),

      maturity: enumOf(MATURITIES,
        "'mature' if they already hold translation memory, TMX, glossaries or termbases from a previous vendor. 'greenfield' if new to localisation or no assets are mentioned."),
      maturityReason: text("The phrase that led you there"),

      delivery: enumOf(DELIVERIES,
        "'connected' if a CMS, LMS, repository or named system should feed content automatically. Note the intent: a customer who says the manual export step is their problem is asking for connected."),
      deliveryReason: text("The phrase that led you there"),
      connector: text("Name of the source system, only when delivery is connected"),

      reviewModel: enumOf(REVIEW_MODEL_IDS,
        "Decide, do not hedge. 'hybrid' covers the most common enterprise shape: internal SMEs by locale with Marketplace as overflow, or named reviewers for some locales and none for others. 'internal' when their own people review and no external sourcing is mentioned. 'marketplace' when Smartcat supplies linguists for most locales. 'ai_only' when they say explicitly no human review is wanted. 'unknown' ONLY when the documents are silent on the subject."),
      reviewModelReason: text("The phrase that led you there"),

      specialization: enumOf(["", ...SPECIALIZATIONS], "Domain of the content, for linguist matching. Empty if the documents give nothing to go on."),
      turnaround: enumOf(TURNAROUNDS, "Standard unless the documents say otherwise"),

      pairs: {
        type: "array",
        maxItems: 40,
        description: "One entry per source-to-target language pair actually in scope. BCP-47 as written. Do not invent locales and do not include ones the documents park or defer.",
        items: {
          type: "object",
          properties: {
            source: text("BCP-47 source locale"),
            target: text("BCP-47 target locale"),
            state: enumOf(PAIR_STATE_IDS, "'approved' if a reviewer is named for this locale, 'scoping' if there is no in-region reviewer, otherwise what the documents describe"),
            reviewers: { type: "integer", minimum: 0, maximum: 20 },
            certification: enumOf(CERTIFICATIONS, "Only when a credential is implied, such as legal or sworn translation"),
            note: text("The reviewer's name if one is given, or why none exists"),
          },
          required: ["source", "target"],
        },
      },
    },
    required: ["customer", "tier", "contentPath", "maturity", "delivery", "reviewModel"],
  },
};

export const DESIGN_TOOL = {
  name: "design_journey",
  description: "Return the implementation checklist, adapted to this customer.",
  input_schema: {
    type: "object",
    properties: {
      rationale: text("At most two sentences on what makes this customer's path different from a generic one"),
      stage: text("The id of the stage they are currently working through"),
      phases: {
        type: "array",
        maxItems: 14,
        description: "Every stage from the checklist, in order, adapted to this customer. Do not drop a stage.",
        items: {
          type: "object",
          properties: {
            id: text("The stage id from the checklist. Omit only for a stage you are adding."),
            label: text("Stage name. Keep the checklist's wording."),
            week: text("When, e.g. 'Week 2' or 'Session 1'"),
            blurb: text("One sentence a customer reads"),
            proof: text("How they will know this stage is finished"),
            steps: {
              type: "array",
              maxItems: 24,
              items: {
                type: "object",
                properties: {
                  text: text("The step, made concrete for this customer"),
                  owner: text("A name from the documents, or 'Smartcat'"),
                  note: text("Short detail, only if the documents support it"),
                  status: enumOf(["open", "active", "done", "na"],
                    "'done' or 'active' only when the documents say so, and only with evidence. 'na' when it clearly does not apply."),
                  evidence: text("The quoted phrase justifying a done or active status. Required for those."),
                  added: { type: "boolean", description: "True if this step is not in the checklist and you added it for this customer" },
                },
                required: ["text"],
              },
            },
          },
          required: ["label", "steps"],
        },
      },
    },
    required: ["phases"],
  },
};

/**
 * Pull a tool result out of a response.
 *
 * Returns null rather than throwing: a missing tool call is a real outcome
 * worth reporting, not an exception to swallow.
 */
export function toolResult(msg, name) {
  const block = (msg?.content || []).find((c) => c.type === "tool_use" && c.name === name);
  return block ? block.input : null;
}
