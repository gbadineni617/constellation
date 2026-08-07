/**
 * The spine — transcribed from the real implementation checklists.
 *
 * Two tiers, two genuinely different paths:
 *
 *   TEAMS      Teams / Accelerate. Session-based: three sessions, one optional.
 *              Six stages, ~40 items, "Customer" and "Together" own most of it.
 *
 *   ENTERPRISE Enterprise / Autonomous+. Week-based over three to four weeks.
 *              Eight stages, ~138 items, with a content-type path on top of a
 *              required core path.
 *
 * Wording is taken verbatim wherever it exists. That matters more than it
 * looks: an FDE reading this next to the spreadsheet must recognise every line,
 * and a customer who has seen the checklist must see the same words here. Do
 * not paraphrase to make something fit — if a line needs changing, change it in
 * the source and bring it across.
 *
 * The previous version of this file was inferred from one account's data. This
 * one is sourced. Where the two disagreed, this wins.
 */

/* ────────────────────────────────────────────────────────────
   Tiers
   ──────────────────────────────────────────────────────────── */

export const TIERS = {
  teams: {
    id: "teams",
    label: "Teams",
    aka: ["teams", "accelerate"],
    blurb: "Session-based onboarding across three sessions, the third optional.",
    cadence: "3 sessions",
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    aka: ["enterprise", "autonomous", "autonomous+", "business"],
    blurb: "Week-by-week implementation, typically three to four weeks with one or two sessions a week.",
    cadence: "3–4 weeks",
  },
};

export const TIER_IDS = Object.keys(TIERS);

/** Map whatever a document called it onto a tier. Defaults to enterprise. */
export function resolveTier(value) {
  const v = String(value || "").trim().toLowerCase();
  for (const t of Object.values(TIERS)) {
    if (t.aka.some((a) => v.includes(a))) return t.id;
  }
  return "enterprise";
}

/* ────────────────────────────────────────────────────────────
   Owners, as the checklists name them
   ──────────────────────────────────────────────────────────── */

export const OWNERS = {
  customer: { label: "You", short: "You" },
  smartcat: { label: "Smartcat", short: "Smartcat" },
  together: { label: "Together", short: "Together" },
};

/* ────────────────────────────────────────────────────────────
   TEAMS — six stages
   ──────────────────────────────────────────────────────────── */

const TEAMS_STAGES = [
  {
    id: "prep",
    label: "Before kickoff",
    week: "Prep",
    surface: "demo",
    blurb: "Share your goals, content and assets so nothing gets asked twice later.",
    proof: "Your goals, file types and target locales are written down and agreed.",
    groups: [
      {
        label: "What to share",
        items: [
          { t: "Your goals & primary use case", who: "customer" },
          { t: "Content & file type(s)", who: "customer" },
          { t: "Languages / locales (source + targets)", who: "customer" },
          { t: "Existing TMs, glossaries (e.g. do-not-translate (DNT) terms, brand/product names) or style guides (if any)", who: "customer" },
          { t: "Who's involved (main contact, admins, reviewers per language)", who: "customer" },
          { t: "Decide reviewer approach — internal reviewers and/or Marketplace", who: "customer",
            note: "Marketplace = separate per-word billing; Smartcat can bring Marketplace lead to a call" },
          { t: "Internal alignment call held (if multiple teams) — workspaces, admins, reviewers agreed", who: "customer",
            optional: true, note: "Only for multi-team accounts" },
        ],
      },
      {
        label: "What Smartcat does",
        items: [
          { t: "Set up your workspace", who: "smartcat" },
          { t: "Add your Smartwords (your translation credits)", who: "smartcat" },
          { t: "Confirm your plan & timeline", who: "smartcat" },
        ],
      },
    ],
  },
  {
    id: "session1",
    label: "Session 1 — Kickoff & Platform Orientation",
    week: "Session 1",
    surface: "demo",
    blurb: "Align on goals and the plan, and take a quick tour of the platform.",
    proof: "Goals, plan and timeline aligned — and signed off.",
    signoff: "Goals, plan & timeline aligned — signed off",
    groups: [
      {
        label: "On the call — confirm together",
        items: [
          { t: "Confirm your goals & what success looks like for you", who: "together" },
          { t: "Agree what \u201cready to go live\u201d means for you (your go-live goal)", who: "together",
            note: "e.g. translate 5 files on your own" },
          { t: "Agree how often we'll meet & book Session 2", who: "together" },
          { t: "Quick platform tour — workspace & key tabs", who: "together" },
        ],
      },
      {
        label: "Your homework before Session 2",
        items: [
          { t: "Invite your team members to the workspace", who: "customer" },
          { t: "Share TMs / glossaries / sample files (if any)", who: "customer" },
          { t: "Pick 1 real file to translate in Session 2 (per team, if multiple)", who: "customer" },
        ],
      },
    ],
  },
  {
    id: "session2",
    label: "Session 2 — Hands-on Translation",
    week: "Session 2",
    surface: "translations",
    blurb: "Translate a real file together, end to end — then confirm you can do it on your own.",
    proof: "You have run a file end-to-end yourself, not watched someone else do it.",
    groups: [
      {
        label: "Together in the session",
        items: [
          { t: "Create a real project with your file", who: "together" },
          { t: "Connect a TM / glossary (if relevant)", who: "together" },
          { t: "Assign a linguist / reviewer", who: "together" },
          { t: "Run AI translation, then review & QA in the editor", who: "together" },
          { t: "Download the finished file", who: "together" },
        ],
      },
      {
        label: "You can now — confirm you can do these on your own",
        items: [
          { t: "Create a project independently", who: "customer" },
          { t: "Invite a team member & set roles", who: "customer" },
          { t: "Assign a reviewer", who: "customer" },
          { t: "Run a file end-to-end on your own", who: "customer" },
          { t: "Submit a support ticket / know where to get help", who: "customer", note: "Help Center" },
        ],
      },
      {
        label: "Your homework before go-live",
        items: [
          { t: "Create a new project (Projects → + New project) — apply your workflow template if you have one", who: "customer" },
          { t: "Translate [N] files by [date]", who: "customer" },
          { t: "Note any questions for Session 3", who: "customer" },
        ],
      },
      {
        label: "Decision",
        items: [
          { t: "Session 3 needed?  (Yes / No)", who: "customer", decides: "session3" },
        ],
      },
    ],
  },
  {
    id: "session3",
    label: "Session 3 — Deep-dive",
    week: "Session 3",
    surface: "demo",
    optional: true,
    blurb: "One focus topic of your choice, only if you need it.",
    proof: "Your open questions are resolved and you are ready to operate independently.",
    groups: [
      {
        label: "Pick the focus topic(s)",
        items: [
          { t: "Linguistic assets (TM / glossary / style guide)", who: "customer" },
          { t: "Reviewer / editor training", who: "customer" },
          { t: "AI Agents — capabilities & use", who: "customer" },
          { t: "Workflow templates & automation", who: "customer" },
          { t: "Use-case deep-dive (specify in Notes)", who: "customer" },
          { t: "Quality review of completed work", who: "customer" },
          { t: "Open Q&A / troubleshooting", who: "customer" },
        ],
      },
      {
        label: "Outcome",
        items: [
          { t: "Selected topic(s) delivered", who: "together" },
          { t: "Open questions resolved; ready to operate independently", who: "together" },
        ],
      },
    ],
  },
  {
    id: "golive",
    label: "Go-live — you're ready",
    week: "Go-live",
    surface: "workspace",
    blurb: "Confirm you can run it solo, then sign off.",
    proof: "Every exit criterion below is met and go-live is signed off.",
    signoff: "Go-live confirmed — onboarding complete — signed off",
    groups: [
      {
        label: "Confirm together — your exit criteria",
        items: [
          { t: "You can create & run projects independently", who: "customer" },
          { t: "Team invited & roles set", who: "customer" },
          { t: "A reviewer has been assigned", who: "customer" },
          { t: "A full file run completed end-to-end", who: "customer" },
          { t: "TM / glossary configured (if relevant)", who: "customer" },
          { t: "You know how to get support", who: "customer" },
          { t: "Your go-live goal is met (e.g. [N] files translated)", who: "customer" },
        ],
      },
    ],
  },
  {
    id: "aftergolive",
    label: "After go-live — meet your Account Manager",
    week: "After go-live",
    surface: "demo",
    blurb: "Your Account Manager takes over as your main contact.",
    proof: "Your Account Manager is acknowledged as your main contact.",
    signoff: "Account Manager acknowledged as your main contact",
    groups: [
      {
        label: "What happens next",
        items: [
          { t: "Your Account Manager becomes your main contact", who: "smartcat" },
          { t: "First check-in with your Account Manager scheduled", who: "smartcat" },
          { t: "Resources shared (Help Center, support, courses)", who: "smartcat" },
        ],
      },
    ],
  },
];

/* ────────────────────────────────────────────────────────────
   ENTERPRISE — eight stages
   ──────────────────────────────────────────────────────────── */

const ENTERPRISE_STAGES = [
  {
    id: "prep",
    label: "Getting started — before kickoff",
    week: "Prep",
    surface: "demo",
    blurb: "Share your goals, content types, systems and assets before we start.",
    proof: "Everything Smartcat needs to configure your workspace has been shared.",
    groups: [
      {
        label: "What to share",
        items: [
          { t: "Your goals & primary use case", who: "customer" },
          { t: "Content & file types (docs, video, Rise/Storyline, Figma, image, etc.)", who: "customer" },
          { t: "Languages / locales (source + targets)", who: "customer" },
          { t: "Systems to integrate; any SSO / security needs", who: "customer" },
          { t: "Admin access to your integration(s) — or name who has it", who: "customer", note: "See integrations" },
          { t: "Existing TMs, glossaries, style / brand guides", who: "customer" },
          { t: "Who's involved (your main contact, admins, reviewers, end users)", who: "customer" },
        ],
      },
      {
        label: "What Smartcat does",
        items: [
          { t: "Workspace provisioning", who: "smartcat" },
          { t: "Smartwords Allocation", who: "smartcat" },
          { t: "Confirm your plan, timeline & content-type path(s)", who: "smartcat" },
        ],
      },
    ],
  },
  {
    id: "kickoff",
    label: "Kickoff",
    week: "Week 1",
    surface: "demo",
    blurb: "One session to align on goals, the value map and the cadence.",
    proof: "Goals, timeline and plan aligned — and signed off.",
    signoff: "Goals, timeline & plan aligned — sign off",
    groups: [
      {
        label: "On the call",
        items: [
          { t: "Welcome, goals & success criteria", who: "together" },
          { t: "Review your 3-Phase Customer Value Map — goals, success metrics & roadmap", who: "together" },
          { t: "Confirm content-type path(s)", who: "together", note: "List the paths you decide on here" },
          { t: "Set weekly cadence", who: "together", note: "e.g. Tuesdays 10:00 PT" },
        ],
      },
      {
        label: "Your homework before next session",
        items: [
          { t: "Invite your team members to the workspace", who: "customer" },
          { t: "Share TMs / glossaries / sample files", who: "customer" },
          { t: "Pick 1 real file to translate in the UAT", who: "customer" },
        ],
      },
    ],
  },
  {
    id: "setup",
    label: "Core setup — Smartcat configures",
    week: "Week 1",
    surface: "workspace",
    blurb: "Smartcat configures your workspace, templates and AI settings around your content.",
    proof: "Your workspace configuration is approved and your team can start a project.",
    signoff: "Workspace configuration approved — sign off",
    groups: [
      {
        label: "Smartcat sets up",
        items: [
          { t: "Confirm SSO is in or out of scope (Support & Infrastructure handle setup)", who: "smartcat" },
          { t: "Configure roles & permissions", who: "smartcat" },
          { t: "Project & assignment templates", who: "smartcat" },
          { t: "AI Translation Profile + AI Agents", who: "smartcat" },
          { t: "In-scope integrations + end-to-end test", who: "smartcat" },
        ],
      },
      {
        label: "You provide",
        items: [
          { t: "Provision users; grant integration access; approve setup", who: "customer" },
        ],
      },
    ],
  },
  {
    id: "core",
    label: "Core path — Required",
    week: "Weeks 2–3",
    surface: "translations",
    blurb: "The everyday path, and it applies whatever your content type is.",
    proof: "Someone on your team can run the whole flow without help.",
    groups: [
      {
        label: "User Management & Access",
        items: [
          { t: "Add new members to workspace", who: "customer" },
          { t: "Understand role permissions (Admin, PM, Linguist)", who: "customer" },
          { t: "Navigate workspace dashboard", who: "customer" },
          { t: "Train a backup admin (avoid key-person risk)", who: "customer" },
        ],
      },
      {
        label: "Project Creation & Management",
        items: [
          { t: "Create new project from dashboard", who: "customer" },
          { t: "Add files to an existing project", who: "customer" },
          { t: "Set project settings & deadlines", who: "customer" },
          { t: "Use project templates", who: "customer" },
        ],
      },
      {
        label: "Translation Workflow",
        items: [
          { t: "Upload files for translation", who: "customer" },
          { t: "Run AI translation", who: "customer" },
          { t: "Invite linguist / reviewer", who: "customer" },
          { t: "Navigate CAT editor basics", who: "customer", note: "Editor course" },
          { t: "Confirm segments in editor", who: "customer" },
          { t: "Download completed translations", who: "customer" },
        ],
      },
      {
        label: "Linguistic Assets",
        items: [
          { t: "Upload glossary to workspace", who: "customer" },
          { t: "Upload translation memory (TM)", who: "customer" },
          { t: "Understand how assets improve quality", who: "customer", note: "TMs & glossaries" },
        ],
      },
      {
        label: "Review & Quality Control",
        items: [
          { t: "Assign reviewers to projects", who: "customer" },
          { t: "Use assignment templates", who: "customer" },
          { t: "Review & edit AI translations; QA checks; comments", who: "customer", note: "Editor course" },
          { t: "Basic quality checks", who: "customer" },
        ],
      },
      {
        label: "AI, Reporting & Support",
        items: [
          { t: "Use AI Translation Profile & AI Agents", who: "customer", note: "AI course (+cert)" },
          { t: "Read Enterprise Reports (your live dashboard)", who: "customer" },
          { t: "Create a support ticket (log an issue)", who: "customer", note: "Help Center" },
          { t: "Track & follow up on your tickets", who: "customer" },
          { t: "Know where to get help (Help Center + support)", who: "customer", note: "Help Center" },
          { t: "Assign your team the right Academy course", who: "customer", note: "Academy" },
        ],
      },
      {
        label: "Integration Basics  (if applicable)",
        onlyIfConnected: true,
        items: [
          { t: "Connect to your integration", who: "customer" },
          { t: "Test file sync / import", who: "customer" },
          { t: "Configure auto-import rules", who: "customer" },
        ],
      },
    ],
  },
  {
    id: "content",
    label: "Content-type path",
    week: "Weeks 2–3",
    surface: "translations",
    blurb: "The specifics for your content type, on top of the core path.",
    proof: "Your content type runs end-to-end, including whatever it needs that documents do not.",
    fromContentPath: true,
    groups: [],
  },
  {
    id: "uat",
    label: "UAT — a real file, end-to-end",
    week: "Week 3",
    surface: "translations",
    blurb: "You run your real content through, not a sample we picked.",
    proof: "The run meets your acceptance criteria.",
    signoff: "Confirm the run meets your acceptance criteria",
    groups: [
      {
        label: "Together",
        items: [
          { t: "Run your real file end-to-end (your content type)", who: "together" },
          { t: "Check output quality, formatting & TM / glossary use", who: "smartcat" },
        ],
      },
      {
        label: "Your homework — run it end-to-end yourself",
        items: [
          { t: "Create a new project (Projects → + New project) — apply your workflow template if you have one", who: "customer" },
          { t: "Set your source and target languages / locales", who: "customer" },
          { t: "Upload a real file — drag & drop your content", who: "customer" },
          { t: "Confirm AI translation starts automatically", who: "customer" },
          { t: "Confirm AI translation reaches 100% across all your target languages", who: "customer" },
          { t: "Check the workflow / review stages are exactly what you intended", who: "customer" },
          { t: "As the PM, assign the next steps / invite reviewers (open the review tasks)", who: "customer" },
          { t: "Complete any steps specific to your content type (e.g. publish website, re-import to your LMS, push back to Figma)", who: "customer" },
          { t: "Review & edit the translation in the Smartcat Editor — fix anything the QA check flags", who: "customer", note: "Editor course" },
          { t: "Confirm each segment (Ctrl+Enter / Confirm ✓) — and check your TM & glossary are applying", who: "customer" },
          { t: "Click \u201cDone\u201d to complete the task — it activates once every segment is confirmed", who: "customer" },
          { t: "Confirm each task / language shows 100% complete on the project Overview", who: "customer" },
          { t: "Download the translated file (Resulting file) — or sync it back to your integration", who: "customer" },
          { t: "Check formatting is intact and quality meets your acceptance criteria", who: "customer" },
          { t: "Repeat on a second file / content type to confirm you can run it on your own", who: "customer" },
          { t: "Note any open questions to resolve before go-live", who: "customer" },
        ],
      },
    ],
  },
  {
    id: "golive",
    label: "Go-live",
    week: "Week 4",
    surface: "reporting",
    blurb: "We check the health numbers together and hand you the keys.",
    proof: "Health metrics meet their targets and go-live is signed off.",
    signoff: "Confirm go-live & sign off",
    groups: [
      {
        label: "Together",
        items: [
          { t: "Confirm health metrics meet targets (record at go-live)", who: "smartcat" },
          { t: "Walk Enterprise Reports as your live dashboard", who: "smartcat" },
          { t: "Confirm you know how to get support", who: "customer", note: "Help Center" },
        ],
      },
    ],
  },
  {
    id: "hyper",
    label: "Hypercare — after go-live",
    week: "Day 1–30",
    surface: "demo",
    blurb: "Thirty days of priority support while your team ramps, then steady state.",
    proof: "Health metrics still hold at Day 30 and implementation is complete.",
    signoff: "Implementation complete (Day 30) — sign off",
    groups: [
      {
        label: "What happens next",
        items: [
          { t: "Your Account Manager becomes your main contact", who: "smartcat" },
          { t: "30-day hypercare: priority support as you ramp", who: "smartcat" },
          { t: "Re-check health metrics before hypercare closes (record at Day 30)", who: "together" },
          { t: "Help Center & support tickets, anytime", who: "customer", note: "Help Center" },
        ],
      },
    ],
  },
];

/* ────────────────────────────────────────────────────────────
   Content-type paths — Enterprise only
   ──────────────────────────────────────────────────────────── */

export const CONTENT_PATHS = {
  "Document & text": {
    label: "Path: Document & text  (docs, PDF, PPTX, INDD, XLIFF — 80+ formats)",
    // No phase of its own: the core path already covers it, and a phase
    // containing only "there is nothing extra to do" is worse than no phase.
    items: [],
  },
  Website: {
    label: "Path: Website",
    items: [
      { t: "Connect your site / CMS (Website Translator)", note: "Website Translator" },
      { t: "Select pages & target languages" },
      { t: "Translate; preserve layout & SEO" },
      { t: "Preview, edit & publish translations live" },
    ],
  },
  "Software / app localization": {
    label: "Path: Software / app localization",
    items: [
      { t: "Upload resource files (JSON, XML, .strings, .po, etc.) or connect your repo / CI-CD" },
      { t: "Translate UI strings; protect variables & placeholders" },
      { t: "Manage context & character limits" },
      { t: "Export / sync back to your codebase" },
    ],
  },
  "Video & audio": {
    label: "Path: Video & audio  (media)",
    items: [
      { t: "Upload video / audio / subtitle file (SRT, VTT, MP4, MP3, MOV) or connect source" },
      { t: "Auto-transcribe / generate subtitles" },
      { t: "Translate; adjust timing & reading speed" },
      { t: "Add AI dubbing / voiceover (if needed)" },
      { t: "Preview in context; export subtitles, burned-in video, or dubbed audio" },
    ],
  },
  "e-Learning": {
    label: "Path: e-Learning  (Rise 360 / Storyline / SCORM)",
    items: [
      { t: "Connect Rise / Storyline or export XLIFF / SCORM" },
      { t: "Upload; preserve course structure, interactivity & SCORM compliance" },
      { t: "Translate text, images, audio & video assets" },
      { t: "QA tags / placeholders" },
      { t: "Re-import / export back to your LMS", note: "e-Learning course" },
    ],
  },
  "Image translation": {
    label: "Path: Image translation",
    items: [
      { t: "Upload images; OCR / text detection" },
      { t: "Translate detected text; preserve layout & design" },
      { t: "Export translated images" },
    ],
  },
  "Design (Figma)": {
    label: "Path: Design  (Figma)",
    items: [
      { t: "Connect Figma (plugin)" },
      { t: "Pull frames / strings for translation" },
      { t: "Translate with live design context; manage length / expansion" },
      { t: "Push translations back to Figma; review in layout", note: "Figma course" },
    ],
  },
  "Google Drive": {
    label: "Path: Google Drive",
    items: [
      { t: "Connect Google Drive to your workspace", note: "Integrations" },
      { t: "Select Docs, Sheets & Slides to translate" },
      { t: "Translate; keep original formatting intact" },
      { t: "Sync translated files back to Drive" },
    ],
  },
};

export const CONTENT_PATH_IDS = Object.keys(CONTENT_PATHS);

/* ────────────────────────────────────────────────────────────
   Linguist sourcing — an addition, not from the checklists
   ──────────────────────────────────────────────────────────── */

/**
 * Neither checklist enumerates sourcing. The Teams sheet only says "Decide
 * reviewer approach — internal reviewers and/or Marketplace", and Enterprise
 * does not mention it at all.
 *
 * But sourcing is real work when it applies: nobody can sign off a locale
 * without an approved reviewer, and finding one takes weeks. So this stage is
 * kept, clearly marked as an addition rather than methodology, and appears only
 * when the review model actually calls for it.
 */
export const ROSTER_STAGE = {
  id: "roster",
  label: "Linguist roster",
  week: "Weeks 2–3",
  surface: "marketplace",
  addition: true,
  blurb: "We find the linguists, they prove themselves on a paid trial, and you decide who works on your content.",
  proof: "Every language pair in scope has a linguist you have personally approved.",
  groups: [
    {
      label: "Scoping",
      items: [
        { t: "Confirm quality tier and turnaround per locale", who: "customer" },
        { t: "Scope language pairs and expected annual volume", who: "customer" },
        { t: "Set specialization and industry so matching is accurate", who: "together" },
      ],
    },
    {
      label: "Sourcing",
      items: [
        { t: "Smartcat sources candidate linguists per pair", who: "smartcat" },
        { t: "Run a paid trial translation for each language pair", who: "smartcat" },
        { t: "Approve the roster — you sign off on who works on your content", who: "customer" },
        { t: "Attach approved linguists to your workflow templates", who: "smartcat" },
        { t: "Agree rates, SLA, and escalation path", who: "together" },
      ],
    },
  ],
};

/* ────────────────────────────────────────────────────────────
   Sign-off gates — the sequencing rule
   ──────────────────────────────────────────────────────────── */

/**
 * From the Stage Gate & Sign-off register. These are the points a stage cannot
 * be passed without agreement, and who has to agree. This is what enforces
 * "you cannot confirm a step before the ones ahead of it" — sequencing, not
 * visibility. The whole map stays visible.
 */
export const GATES = {
  teams: [
    { stage: "session1", what: "Goals, plan & timeline aligned", by: "FDE" },
    { stage: "golive", what: "Onboarding complete — go-live confirmed", by: "FDE + sponsor" },
    { stage: "aftergolive", what: "Account Manager acknowledged as main contact", by: "FDE + AM" },
  ],
  enterprise: [
    { stage: "kickoff", what: "Goals, timeline & plan aligned", by: "FDE" },
    { stage: "setup", what: "Workspace configuration approved", by: "FDE" },
    { stage: "uat", what: "Acceptance criteria met", by: "FDE" },
    { stage: "golive", what: "Go-live acceptance", by: "FDE + sponsor" },
    { stage: "hyper", what: "Account Manager acknowledged as your primary contact", by: "FDE + AM" },
    { stage: "hyper", what: "Implementation complete", by: "FDE + AM" },
  ],
};

/* ────────────────────────────────────────────────────────────
   Health metrics — Enterprise, recorded twice
   ──────────────────────────────────────────────────────────── */

/**
 * All thirteen, with their targets, exactly as the checklist lists them.
 * Recorded at go-live and again at Day 30 — a number that was met at go-live and
 * has since slipped is the thing hypercare exists to catch.
 */
export const HEALTH_METRICS = [
  { k: "TM attached to projects", target: 80, unit: "%" },
  { k: "Projects with glossaries", target: 50, unit: "%" },
  { k: "Custom translation preset used", target: 70, unit: "%" },
  { k: "Projects created with translation profile", target: 50, unit: "%" },
  { k: "Projects created with workflow template", target: 60, unit: "%" },
  { k: "Reviewer agents used", target: 30, unit: "%" },
  { k: "Admins and PMs active in last 30 days", target: 80, unit: "%" },
  { k: "Projects reach 100% completion", target: 90, unit: "%" },
  { k: "YouTrack tickets in last 30 days", target: 0, unit: "", lowerIsBetter: true },
  { k: "NSM growth: last 90 vs 91–180 days", target: 0, unit: "%" },
  { k: "TM leverage", target: 30, unit: "%" },
  { k: "Active use cases", target: 3, unit: "" },
  { k: "Words reviewed in documents", target: 40, unit: "%" },
];

/* ────────────────────────────────────────────────────────────
   Assembly
   ──────────────────────────────────────────────────────────── */

const slug = (s) =>
  String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

/**
 * The stages for a tier, with conditional ones resolved.
 *
 * Three conditions apply:
 *   - Teams session 3 is optional and appears only when it has been asked for.
 *   - Enterprise integration items appear only when something is connected.
 *   - The Enterprise content-type phase is dropped entirely for Document & text,
 *     because the core path already covers it.
 */
export function stagesFor({ tier = "enterprise", contentPath = "Document & text", connected = false, session3 = null, sourcing = false } = {}) {
  const t = TIER_IDS.includes(tier) ? tier : "enterprise";
  const source = t === "teams" ? TEAMS_STAGES : ENTERPRISE_STAGES;

  const out = [];
  for (const stage of source) {
    // An optional stage is included unless it has been explicitly declined.
    if (stage.optional && session3 === false) continue;

    if (stage.fromContentPath) {
      const path = CONTENT_PATHS[contentPath] || CONTENT_PATHS["Document & text"];
      if (!path.items.length) continue;          // nothing extra to do, so no phase
      out.push({
        ...stage,
        label: path.label,
        groups: [{ label: "In this path", items: path.items.map((x) => ({ ...x, who: "customer" })) }],
      });
      continue;
    }

    // Sourcing sits before validation: you cannot run UAT with nobody hired.
    if (sourcing && (stage.id === "uat" || stage.id === "golive")) {
      if (!out.some((s) => s.id === "roster")) out.push(ROSTER_STAGE);
    }

    const groups = (stage.groups || []).filter((g) => !g.onlyIfConnected || connected);
    out.push({ ...stage, groups });
  }
  return out;
}

/**
 * Flatten stages into the phase/step shape the rest of the app already uses.
 *
 * Keys are derived from stage id and item text, so they are stable across
 * rebuilds — which is what lets a due date, an owner or a blocker survive a
 * regeneration. Do not make them positional.
 */
export function phasesFor(opts = {}) {
  return stagesFor(opts).map((stage) => {
    const steps = [];
    for (const group of stage.groups || []) {
      for (const item of group.items || []) {
        steps.push({
          k: stage.id + "__" + slug(item.t),
          t: item.t,
          note: item.note || "",
          group: group.label,
          // The checklist names a role; the app carries a list of person ids.
          // Normalising here means no consumer has to handle both shapes.
          role: item.who || "customer",
          who: [],
          optional: Boolean(item.optional),
          decides: item.decides || null,
          status: "open",
        });
      }
    }
    // A stage with a sign-off gets it as its final step, so the gate is visible
    // in the list rather than living somewhere separate.
    if (stage.signoff) {
      steps.push({
        k: stage.id + "__signoff",
        t: stage.signoff,
        note: "",
        group: "Sign-off",
        role: "together",
        who: [],
        signoff: true,
        status: "open",
      });
    }
    return {
      id: stage.id,
      label: stage.label,
      week: stage.week,
      surface: stage.surface,
      blurb: stage.blurb,
      proof: stage.proof,
      optional: Boolean(stage.optional),
      steps,
    };
  });
}

/** Every step key a tier can produce. Used to validate saved state. */
export function allStepKeys(opts = {}) {
  return phasesFor(opts).flatMap((p) => p.steps.map((s) => s.k));
}


/* ────────────────────────────────────────────────────────────
   Sequencing
   ──────────────────────────────────────────────────────────── */

/**
 * Can this step be confirmed yet?
 *
 * The rule Anirudh described: the whole map stays visible, but a step cannot be
 * ticked until the ones ahead of it are done. Visibility and sequencing are
 * different things, and hiding future phases would stop an FDE looking ahead
 * during a call — which is exactly when they need to.
 *
 * A stage is passable when every non-optional step in it is done or N/A. An
 * optional step never blocks, and neither does an optional stage.
 */
export function sequenceState(phases) {
  const state = new Map();
  let blockedFrom = null;

  for (const phase of phases) {
    const blocking = (phase.steps || []).filter((s) => !s.optional);
    const settled = (s) => s.s === "done" || s.s === "na";

    for (const step of phase.steps || []) {
      state.set(step.k, {
        locked: blockedFrom !== null,
        // Naming what is in the way is the difference between a disabled
        // checkbox and an explanation.
        blockedBy: blockedFrom,
      });
    }

    const complete = blocking.every(settled);
    if (!complete && blockedFrom === null && !phase.optional) {
      blockedFrom = phase.label;
    }
  }
  return state;
}

/** Whether a specific step may be confirmed, given the current journey. */
export function canConfirm(phases, stepKey) {
  const s = sequenceState(phases).get(stepKey);
  return !s || !s.locked;
}


/* ────────────────────────────────────────────────────────────
   Handing the checklist to the model
   ──────────────────────────────────────────────────────────── */

/**
 * The checklist as prompt text.
 *
 * Generation used to ask the model to invent a structure. That was wrong twice
 * over: the output stopped resembling the real methodology, and inventing a
 * structure is a much harder task than filling one in — which is why the same
 * document produced different answers on different runs.
 *
 * So the model now receives the actual checklist for the tier and adapts it:
 * keep these stages and these steps, reword where the customer's own vocabulary
 * is clearer, add what this customer specifically needs, mark what does not
 * apply. Structure comes from the methodology; content comes from the document.
 */
export function checklistPrompt(opts = {}) {
  const stages = stagesFor(opts);
  const tier = TIERS[TIER_IDS.includes(opts.tier) ? opts.tier : "enterprise"];

  const lines = [
    "",
    "## The implementation checklist you are adapting",
    "",
    "This customer is on the **" + tier.label + "** plan (" + tier.cadence + "). Below is the checklist this team actually runs. **Use it as your structure.** These stage names and step wordings are what an FDE and the customer both see in the spreadsheet, so they must be recognisable.",
    "",
    "For each stage, return the steps below, and then:",
    "",
    "- **Adapt wording** where the customer's own terms are clearer. \"Pick 1 real file to translate\" becomes \"Pick one Rise course to translate\" if that is what they have. Keep the meaning and the shape; change only what makes it concrete for them.",
    "- **Add steps** the documents call for that the checklist does not cover — a format that has broken before, a system to connect, a compliance gate, a pilot. Set \"added\": true on those.",
    "- **Mark steps N/A** with \"status\": \"na\" when the documents make clear they do not apply.",
    "- **Add a whole stage** only when this customer genuinely needs one the checklist has no room for. Give it no \"id\".",
    "",
    "Do not drop a stage. Do not rename a stage unless the customer's own language is clearly better, and even then keep it recognisable.",
    "",
  ];

  for (const stage of stages) {
    lines.push('### Stage "' + stage.id + '" — ' + stage.label + "  (" + stage.week + ")");
    for (const group of stage.groups || []) {
      lines.push("  " + group.label + ":");
      for (const item of group.items || []) {
        lines.push("    - " + item.t + (item.optional ? "   [optional]" : ""));
      }
    }
    if (stage.signoff) lines.push("  Sign-off:\n    - " + stage.signoff);
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Re-map an existing journey onto the other tier.
 *
 * Switching plan must not throw away the work. Anything the customer added, any
 * status, date, owner or blocker that has an obvious counterpart is carried
 * across; anything with no home in the new checklist is reported rather than
 * silently dropped.
 */
export function remapToTier(rec, nextTier) {
  const target = phasesFor({
    tier: nextTier,
    contentPath: rec.contentPath,
    connected: rec.delivery === "connected",
    sourcing: rec.reviewModel === "marketplace" || rec.reviewModel === "hybrid",
    session3: rec.session3,
  });

  const oldPhases = Array.isArray(rec.phases) ? rec.phases : [];
  const oldSteps = oldPhases.flatMap((p) => (p.steps || []).map((s) => ({ ...s, phaseId: p.id })));

  // Match on the slugged wording after the stage prefix: the same step often
  // exists in both checklists under a different stage.
  const tail = (k) => String(k || "").split("__").slice(1).join("__");
  const byTail = new Map(oldSteps.map((s) => [tail(s.k), s]));

  const carried = [];
  const orphaned = [];

  const phases = target.map((phase) => ({
    ...phase,
    steps: phase.steps.map((step) => {
      const match = byTail.get(tail(step.k));
      if (!match) return step;
      carried.push(step.k);
      return { ...step, status: match.status || step.status, note: match.note || step.note };
    }),
  }));

  // Steps the customer added that have no counterpart keep their place by stage
  // where possible, so bespoke work is never lost in a tier switch.
  const targetTails = new Set(phases.flatMap((p) => p.steps.map((s) => tail(s.k))));
  const extra = oldSteps.filter((s) => s.added && !targetTails.has(tail(s.k)));
  for (const s of extra) {
    const home = phases.find((p) => p.id === s.phaseId) || phases[Math.floor(phases.length / 2)];
    home.steps.push({ ...s, k: home.id + "__" + tail(s.k) });
    carried.push(s.k);
  }

  for (const s of oldSteps) {
    if (!targetTails.has(tail(s.k)) && !s.added) orphaned.push(s.t);
  }

  return {
    phases,
    carried: carried.length,
    orphaned,
  };
}
