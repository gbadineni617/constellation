/**
 * Where a phase sends you.
 *
 * Every phase has a "do the thing" button, and until now it was a dead
 * placeholder. Making it work means answering two questions that turn out to be
 * the same question: which Smartcat surface does this phase live on, and where
 * is this app running?
 *
 * Standalone, the button opens the workspace in a new tab. Embedded as a custom
 * app inside Smartcat, it should navigate the host instead — opening a new tab
 * from inside the platform to somewhere else in the platform is a bad experience.
 * `describeTarget()` returns the intent and the caller decides how to travel.
 */

const HOSTS = {
  eu: "https://smartcat.ai",
  us: "https://us.smartcat.ai",
  ea: "https://ea.smartcat.ai",
};

/** Public, so the browser can build links. Not a credential. */
export const smartcatHost = (region) => HOSTS[(region || "us").toLowerCase()] || HOSTS.us;

/**
 * Surfaces a phase can point at. `path` is relative to the workspace root;
 * `external` marks the ones that are not a Smartcat screen at all.
 */
export const SURFACES = {
  workspace: {
    label: "Open Workspace",
    path: "/dashboard",
    hint: "Settings, templates, users and AI configuration.",
  },
  translations: {
    label: "Open Translations",
    path: "/projects",
    hint: "Upload, translate, review and export your content.",
  },
  marketplace: {
    label: "Open Marketplace",
    path: "/marketplace",
    hint: "Find and approve linguists for your language pairs.",
    /**
     * Marketplace search takes filters, so a phase button can arrive with the
     * journey's own requirements already applied rather than dumping the FDE
     * on an empty search. See marketplaceQuery().
     */
    filterable: true,
  },
  reporting: {
    label: "Open Reports",
    path: "/reports",
    hint: "Enterprise Reports — the numbers that gate go-live.",
  },
  demo: {
    label: "Book a call with your team",
    external: true,
    hint: "This phase is a conversation, not a screen.",
  },
};

export const SURFACE_IDS = Object.keys(SURFACES);

/**
 * What should happen when the button is pressed.
 *
 * Returns one of three intents:
 *   - "contact"  — no URL; the caller should surface the FDE, not a link
 *   - "navigate" — stay inside the host application
 *   - "open"     — a new tab, because we are not inside Smartcat
 */
export function describeTarget(surfaceId, { embedded = false, region = "us", accountId = "" } = {}) {
  const surface = SURFACES[surfaceId] || SURFACES.workspace;

  if (surface.external) {
    return { intent: "contact", label: surface.label, hint: surface.hint };
  }

  // A workspace-scoped path when we know the account, so a link lands in the
  // right place rather than wherever the viewer happened to be last.
  const path = accountId
    ? "/workspace/" + encodeURIComponent(accountId) + surface.path
    : surface.path;

  return {
    intent: embedded ? "navigate" : "open",
    label: surface.label,
    hint: surface.hint,
    path,
    href: smartcatHost(region) + path,
  };
}


/**
 * Turn what the journey already knows into a Marketplace search.
 *
 * The information needed to find a linguist is sitting in the record: which
 * pairs are unstaffed, what domain the content is, whether a credential is
 * required. Re-typing it into a search box is exactly the kind of duplicated
 * effort this product exists to remove.
 *
 * Note what this does NOT do. The integration API exposes assignable executives
 * and project assignment, but no public marketplace search — so this hands off
 * to the Marketplace UI with filters applied rather than pretending to search
 * from here. A button that lands on a real filtered search is worth more than a
 * fake result list.
 */
export function marketplaceQuery(rec, pair) {
  const params = {};

  if (pair) {
    params.source = pair.source;
    params.target = pair.target;
    if (pair.certification && pair.certification !== "None") {
      params.certification = pair.certification;
    }
  }
  if (rec?.specialization) params.specialization = rec.specialization;
  if (rec?.turnaround && rec.turnaround !== "Standard") params.turnaround = rec.turnaround;

  const qs = new URLSearchParams(params).toString();
  const base = SURFACES.marketplace.path;
  return {
    path: qs ? base + "?" + qs : base,
    params,
    /** What the FDE is actually asking for, in words. */
    summary: pair
      ? [
          pair.source + " to " + pair.target,
          rec?.specialization || "",
          pair.certification && pair.certification !== "None" ? pair.certification + " certified" : "",
          rec?.turnaround && rec.turnaround !== "Standard" ? rec.turnaround.toLowerCase() + " turnaround" : "",
        ].filter(Boolean).join(" · ")
      : "",
  };
}

/**
 * The whole roster as one sourcing brief — the thing you would otherwise write
 * by hand into an email to the Marketplace team.
 */
export function sourcingBrief(rec, pairs) {
  const open = (pairs || []).filter((p) => p.state === "scoping" || p.state === "sourcing");
  if (!open.length) return null;

  const lines = [
    "Linguist sourcing request — " + (rec?.customer || "customer"),
    "",
    rec?.specialization ? "Domain: " + rec.specialization : "",
    rec?.industry ? "Industry: " + rec.industry : "",
    rec?.turnaround ? "Turnaround: " + rec.turnaround : "",
    rec?.goLive ? "Go-live: " + rec.goLive : "",
    "",
    "Language pairs needed:",
    ...open.map((p) =>
      "  - " + p.source + " > " + p.target +
      " (" + p.reviewers + " reviewer" + (p.reviewers === 1 ? "" : "s") + ")" +
      (p.certification && p.certification !== "None" ? " — " + p.certification + " certification required" : "") +
      (p.note ? " — " + p.note : "")
    ),
  ];
  return { text: lines.filter((l) => l !== "").join("\n"), count: open.length };
}
