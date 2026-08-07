import { CONTENT_PATHS } from "./journey.js";
import { REVIEW_MODEL_IDS, SPECIALIZATIONS, TURNAROUNDS, coercePairs } from "./marketplace.js";
import { resolveTier } from "./checklist.js";

/**
 * Coercion layer between the model and the app.
 *
 * The model reads a document and proposes values. This file decides what is
 * allowed to become state. Anything the model returns that isn't a known enum
 * value is discarded and replaced with a safe default — a hallucinated content
 * type must never be able to reshape a journey.
 */

export const CONTENT_TYPES = Object.keys(CONTENT_PATHS);
export const MATURITIES = ["greenfield", "mature"];
export const DELIVERIES = ["manual", "connected"];

const str = (v, max = 600) =>
  typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "";

const pick = (v, allowed, fallback) => {
  if (typeof v !== "string") return fallback;
  const hit = allowed.find((a) => a.toLowerCase() === v.trim().toLowerCase());
  return hit || fallback;
};

/** Normalise whatever the model returned into something the app can safely use. */
export function coerceIntake(raw) {
  const r = raw && typeof raw === "object" ? raw : {};

  const contentPath = pick(r.contentPath, CONTENT_TYPES, "Document & text");
  // Deliberately defaults to "unknown". Assuming "internal" would silently assert
  // that the customer has their own reviewers, which is a claim, not an absence.
  // Which implementation checklist applies. Unknown falls to enterprise: it is
  // the fuller path, and removing steps is safer than discovering missing ones.
  const tier = resolveTier(r.tier);
  const reviewModel = pick(r.reviewModel, REVIEW_MODEL_IDS, "unknown");
  const specialization = pick(r.specialization, SPECIALIZATIONS, "");
  const turnaround = pick(r.turnaround, TURNAROUNDS, "Standard");
  const pairs = coercePairs(r.pairs);
  const maturity = pick(r.maturity, MATURITIES, "greenfield");
  const delivery = pick(r.delivery, DELIVERIES, "manual");

  // A connector name is only meaningful if delivery actually is connected
  const connector = delivery === "connected" ? str(r.connector, 60) : "";

  const found = [];
  const missing = [];
  const fields = {
    name: str(r.customer, 120),
    useCase: str(r.useCase, 600),
    pain: str(r.pain, 600),
    goLive: str(r.goLive, 120),
    metrics: str(r.metrics, 300),
    team: str(r.team, 400),
    integrations: str(r.integrations, 300),
    industry: str(r.industry, 120),
  };
  for (const [k, v] of Object.entries(fields)) (v ? found : missing).push(k);

  return {
    fields,
    contentPath,
    maturity,
    delivery,
    connector,
    tier,
    reviewModel,
    specialization,
    turnaround,
    pairs,
    // Why the model chose each axis — shown to the FDE so the guess is inspectable
    reasoning: {
      contentPath: str(r.contentPathReason, 200),
      maturity: str(r.maturityReason, 200),
      delivery: str(r.deliveryReason, 200),
      reviewModel: str(r.reviewModelReason, 200),
      tier: str(r.tierReason, 200),
    },
    found,
    missing,
  };
}

export const LABELS = {
  industry: "Industry",
  name: "Customer",
  useCase: "Use case",
  pain: "Pain today",
  goLive: "Go-live",
  metrics: "Success metrics",
  team: "Team",
  integrations: "Integrations",
};
