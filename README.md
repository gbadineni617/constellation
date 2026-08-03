# Constellation

Customer-facing onboarding journeys for Smartcat — in the platform, instead of an Excel tracker.

## What it is

Every enterprise onboarding follows the same skeleton. Constellation renders that skeleton as a
star map the customer can actually look at, adapts it to three things it can know about them, and
nudges when a journey starts to slip.

## Architecture, and the one rule

**Code decides. The model writes.**

For generated journeys this needs stating precisely, because the model now designs the
path. It designs the *body*; it cannot touch the *spine*.

`lib/spine.js` defines six phases — discovery, kickoff, setup, UAT, go-live, hypercare —
that are gates in the onboarding methodology. The model may retitle them, write their
steps, and set their timing. It cannot delete them, reorder them, or duplicate them.
Between setup and UAT it is free to invent whatever the document calls for: an integration
phase, a SCORM QA phase, a procurement gate. `coerceJourneyPlan()` enforces all of this
and reports every intervention it made, which the UI shows as "Guardrails applied".

That is what makes a generated journey defensible to whoever owns the checklist: the
methodology is structurally guaranteed, and only the bespoke work is generated.

`lib/journey.js` is pure, deterministic, and has no React and no network calls in it:

- `buildJourney(record)` — assembles phases from three axes: content type, linguistic maturity,
  and delivery (manual vs. connected). Phase *count* is an output, not a constant: 7 phases for a
  plain document handled manually, 9 for e-learning through a connector.
- `assess(record, journey)` — computes risk from arithmetic. Days to go-live, progress vs. the
  share of the timeline already burned, idle days, health targets short, steps still open in
  phases that should be finished.

The model runs in exactly two places, and neither one gets to decide anything structural:

- `app/api/draft/route.js` — turns an already-decided situation into an email or Slack
  message. It never decides *whether* a nudge is warranted.
- `app/api/intake/route.js` — reads an uploaded brief, transcript, or set of notes and
  *proposes* field values. Everything it returns passes through `coerceIntake()` in
  `lib/intake.js`, which discards anything that isn't a known enum value. A hallucinated
  content type cannot reshape a journey — there is a test for exactly that.

Keep it that way. Risk assessment must be reproducible and auditable — an FDE has to be able
to explain to a customer why they were flagged, and "the model thought so" is not an answer.

## Running it

```bash
npm install
cp .env.example .env.local     # add your ANTHROPIC_API_KEY
npm run dev
```

```bash
npm test        # the deterministic core — 8 tests, no network
npm run build
```

## Deploying

```bash
npx vercel
```

Then set `ANTHROPIC_API_KEY` in Vercel → Settings → Environment Variables.

**Do not prefix it with `NEXT_PUBLIC_`.** That ships the key to the browser. The key is read
only inside `app/api/draft/route.js`, which runs server-side.

## Layout

```
app/
  page.jsx              app shell, nav, routing between sections
  api/draft/route.js    the only place a model runs
lib/
  journey.js            buildJourney + assess — pure, tested, no React
  theme.js              colours, people, nav
  seed.js               demo records
components/
  Constellation.jsx     view routing: choose → intake → building → journey
  journey/              StarMap, JourneyView, AgentPanel
  hub/                  choice screen, past journeys, intake, replicate
  surfaces.jsx          the quiet workspace tabs
```

## The four axes

A template journey's shape comes from four things it can know about a customer:

| axis | values | what it changes |
| --- | --- | --- |
| content type | Document & text / e-Learning / Video & audio | Document & text earns no phase of its own; the others do |
| linguistic maturity | greenfield / mature | swaps which asset steps appear, not how many |
| delivery | manual / connected | a connector adds a whole phase and a UAT round-trip step |
| review model | unknown / ai_only / internal / marketplace / hybrid | Marketplace adds a sourcing phase **and a go-live gate** |

**`unknown` is the default, and it matters.** If a document does not say who reviews, the
app records that nobody has said — not that the customer reviews internally. Defaulting to
`internal` would be an assertion dressed up as an absence, and it would quietly hide a real
gap: whether Smartcat needs to source linguists is the difference between a four-week path
and a seven-week one. `assess()` raises "Nobody has said who reviews" as a signal instead,
and it turns urgent as go-live approaches.

Marketplace involvement is never inferred. It appears only when a document says the
customer lacks reviewers or wants Smartcat to supply them. There is a test asserting that
no seeded record claims a Marketplace engagement, because none of their source material
mentioned one.

The review model is the one that changes what go-live *means*. With Marketplace or hybrid,
`lib/marketplace.js` tracks readiness per language pair rather than as one average —
because an enterprise rollout stalls on two locales out of thirteen, and an average is
exactly what hides that. `assess()` will not let a journey read healthy two weeks from
go-live with an unstaffed locale.

## Learning from past journeys

`lib/corpus.js`. Before designing a journey, the app finds the most comparable ones the team
has already built and hands them to the model as worked examples — so output matches how this
team actually writes a journey rather than a model's idea of onboarding.

This is retrieval, not training. Nothing is fine-tuned and Claude remembers nothing between
calls. The corpus is your own `journeys` table, and it improves as the team uses the product.
Journeys an FDE corrected by hand rank highest, because the corrections are the judgement worth
copying.

Two mechanisms, deliberately different. **Conventions** are frequencies computed across every
comparable journey — unbounded, reproducible, and framed to the model as rules with their
frequency attached. **Worked examples** are the closest handful, shown in full. The examples are
capped because past a few the model averages them; the conventions are not, because arithmetic
does not dilute.

Matching is categorical rather than vector-based — content type, delivery, review model,
maturity, specialization, industry, weighted. That is explainable and free. `pgvector` slots in
behind `findReferences()` if free-text similarity ever becomes necessary.

**Approval closes the loop.** An FDE signs off on a journey and it becomes trusted enough to
teach the next one — the translation-memory rule, applied to onboarding. Approved journeys rank
highest as references, and conventions are drawn from approved work only. If nothing is approved,
the system claims no conventions rather than inferring them from unchecked drafts.

Source documents are kept in a `documents` table so nothing is thrown away, and the **Library**
tab shows what has accumulated. Note the retention question that raises: before piping Gong
transcripts through this, confirm the customer DPAs cover it.

## Storage

`lib/db.js` talks to Postgres through a plain `DATABASE_URL`, so Neon, Vercel Postgres,
Supabase, or a local Postgres all work and none of them lock you in.

**Without `DATABASE_URL` the app still runs**, backed by an in-process Map, and says so
in the top bar and with a banner. That keeps the thing usable while you set a database up
— but memory dies with the process, which is the exact problem persistence solves.

Two tables (`db/schema.sql`). The journey record is stored as `jsonb` rather than
normalised, because `buildJourney()` and `assess()` already take a plain object, so a row
can be handed to them unchanged. Promote steps to their own table when you need queries
like "every step due this week across all customers".

The `nudges` table exists before anything sends, on purpose. `recentNudge()` is what stops
the agent emailing the same person about the same overdue step every morning — the
difference between an agent and a spambot.

### Getting a database

1. Sign up at neon.tech, create a project, copy the connection string
2. Put it in `.env.local` as `DATABASE_URL=`
3. Restart. Tables are created and the demo records imported on first request.

## Not done yet

**Scheduler.** `assess()` runs when a browser renders. A reminder that only fires when
someone happens to be looking is not a reminder. Next: a Vercel Cron hitting `/api/sweep`,
which loads every journey, runs the same `assess()`, and sends what is genuinely due.

**Auth, and it needs two audiences.** An FDE sees every account. A customer must see exactly
one journey and never the others. That boundary doesn't exist yet, and it has to exist before
this is shown to anyone outside the building.

**Inheritance is currently a flat list.** `INHERITED_KEYS` carries the same steps over
regardless of context. In reality what a second team inherits depends on whether they share
locales, content type, and reviewers.

**`TODAY` is pinned** to a fixed date in `lib/journey.js` so demos are stable. Swap it for
`new Date()` before this is real.
