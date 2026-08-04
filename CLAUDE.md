# Constellation — working notes

Read this before changing anything. These are decisions that were argued out and paid for,
not preferences. Most of them exist because the alternative was tried or nearly shipped.

## What this is

Customer-facing onboarding journeys for Smartcat, replacing per-account Excel trackers.
An FDE drops in kickoff notes; the app designs a journey; the journey tracks itself and
nudges when something slips.

Two audiences with different needs, which is the central design tension: the **customer**
wants reassurance and clarity, the **FDE** wants blockers and ownership. When they
conflict, the customer-facing view wins and the FDE detail goes behind a toggle.

## The one rule

**Code decides. The model writes.**

Every architectural argument in this project resolves to that sentence.

- Whether a journey is at risk → `assess()` in `lib/journey.js`. Arithmetic. Reproducible.
- How to say it to a human → the model, in `app/api/draft/route.js`.

Never invert this. If you ask a model "is this account at risk?" you get a confident answer
that varies between runs and cannot be explained to a customer. An FDE has to be able to
tell Kat at Walmart exactly why she was flagged, and "the model thought so" is not an
answer. The specific numbers — days late, points behind pace, targets short — must trace
to a line of code.

Corollary: the model may **propose** structure but never **commit** it. Everything it
returns passes through a coercion layer (`coerceIntake`, `coerceJourneyPlan`, `coercePairs`)
that discards anything outside a known enum. There are tests feeding these `null`, `42`,
and `"Interpretive Dance"`. Keep them passing.

## Invariants

**`lib/journey.js` and `lib/spine.js` stay pure.** No React, no DOM, no network, no
`lucide-react`. They must be importable by a cron job and testable with plain `node`.
This broke once — nav icons leaked into `lib/theme.js`, which `journey.js` imports — and
had to be undone. If you need an icon in a data structure, attach it in the component.

**The spine is not negotiable.** `lib/spine.js` defines six phases (discovery, kickoff,
setup, UAT, go-live, hypercare) plus one conditional (roster, when Marketplace is in play).
The model may retitle them, write their steps, and set their timing. It may not delete,
reorder, or duplicate them. `coerceJourneyPlan()` enforces this and reports every
intervention, which the UI shows as "Guardrails applied". This is what makes a generated
journey defensible to whoever owns the real checklist.

**Generated phases live between `setup` and `uat`.** That is where genuine variation is.
The gates at either end are universal.

**Step keys are permanent.** `dueDates`, `overrides`, and `owners` are keyed off `k`. If
you regenerate keys, every date and status a human set is silently orphaned. There is a
test asserting the same plan keys identically twice.

**A blocker attaches to a step, not between steps.** `lib/tickets.js`. An open checkbox
does not distinguish "waiting on Phillip's glossary" from "nobody has looked at this" — same
state, completely different problems, and only one is the customer's fault. A ticket is always
blocking something specific, which is what makes it answerable. Staleness is a threshold
(`STALE_DAYS`), not a feeling: a blocker logged yesterday is information, one open 25 days
escalates the journey.

**Colour encodes kind, never urgency.** Markers were coloured by staleness at first, which
meant hue carried two meanings and a gap holding a decision looked identical to one holding
context. Kind is fixed to a hue (issue pink, decision teal, context violet), urgency lives in
the age text, and every kind carries its own icon so the code survives greyscale and
colourblindness. Apply the same rule to anything new.

**A marker belongs to the gap after a phase.** `lib/markers.js`. Two weeks lost to a
procurement signature, a locale dropped from wave one, a contact changing — none of it belongs
to a step, and without somewhere to put it, it lives in an FDE's memory. Three kinds, and the
distinction is load-bearing: an **issue** can be resolved and escalates when stale, a
**decision** is recorded and never escalates, **context** is neither. Recording that a decision
was made must never make a journey look sick.

**A done step is never late.** No date archaeology on finished work. This caught two of my
own tests being wrong; the rule was right.

**Absence is not a default.** `reviewModel` defaults to `"unknown"`, not `"internal"`.
Defaulting to `internal` asserts the customer has reviewers — a claim dressed as an
absence, and it hides whether Smartcat needs to source linguists, which is the difference
between a four-week path and a seven-week one. `assess()` surfaces the gap as a signal.
Apply this pattern generally: when a document is silent, record silence.

**Never invent data onto a real account.** Marketplace engagements and language pairs were
once fabricated onto Walmart and Wholesome Goods, whose notes said their own people review.
There is now a test asserting no seeded record claims a Marketplace engagement. Do not
"enrich" seed data to make a feature demoable — build a document that legitimately exercises it.

**Assert every patch.** A silent no-op from a whitespace mismatch left a go-live gate
missing until a test caught it. If you edit by string replacement, assert the target existed.

## The corpus

`lib/corpus.js` is institutional memory, and it is **not** model training. Claude accumulates
nothing between calls. What happens instead: before designing a journey, the app retrieves
the most comparable past journeys and puts them in the prompt as worked examples.

Retrieval is categorical, not embedding-based, and that is a deliberate choice. Similarity
between onboardings is genuinely discrete — e-Learning through a connector with hybrid review
resembles another one of those. Weighted trait matching captures it, costs nothing, and can be
explained to the person reading the output ("used adidas, 85%, same content type and connector").
Add `pgvector` behind `findReferences()` if free-text similarity ever matters; do not reach
for it before then.

**Approval is the feedback loop, and it works like a translation memory.** You do not reuse
unapproved segments. `isApproved()` gates two things:

- **Conventions come from approved journeys only.** Nothing approved means no conventions
  claimed, rather than conventions inferred from drafts nobody checked. The shortfall is
  reported so the UI can say "3 of 5 approved".
- **Trust orders the references.** Approved (+30) outranks hand-corrected (+15) outranks raw.

**Similarity and trust are separate numbers.** They were briefly folded together and clamped
to 100, which made both invisible the moment a candidate matched on every trait. `score` is
trait match; `rank` is score plus trust. Do not recombine them.

**The corpus contributes in two ways, and they scale differently.** This distinction is the
whole design, so do not collapse them.

- `commonPatterns()` — frequencies across **every** comparable journey. "This step appears in
  23 of 23" is a convention; "in 4 of 23" is one FDE's habit, and the frequency is reported so
  the difference is visible. Unbounded, reproducible, arithmetic. Needs at least
  `MIN_CORPUS_FOR_PATTERNS` comparable journeys before it will say anything at all.
- `pickReferences()` — the closest handful only, as full worked examples. Capped at
  `MAX_REFERENCES` **not** because of context window but because of dilution: past a few, the
  model averages the examples and output drifts toward their mean. Two strong references beat
  ten mediocre ones. Raising this number is not an improvement.

**Hand-corrected journeys rank higher.** `editSignal()` diffs `phases` against `planOriginal`
— the snapshot taken at generation. The delta is what an FDE knew that the model did not, and
it is the most valuable signal in the system. This is why `planOriginal` must be written on
every generated journey and never overwritten.

`/api/intake` therefore runs two passes: a cheap classification to get traits for retrieval,
then the real design pass with references attached. Retrieval cannot happen before
classification, and classification cannot happen before reading the document. If pass one
fails, pass two still runs without references — a broken corpus must never block generation.

## Long requests and the platform ceiling

Vercel kills a function at 60 seconds and returns **an HTML error page**, not JSON. That
produced a "Unexpected token 'A'" in the UI, which pointed at the wrong problem entirely.

Two rules follow, and both matter:

- **Never call `res.json()` directly.** Use `readJson()` in `lib/http.js`, which reads the
  body once and reports the real cause — a 504 says the request timed out, not that a
  character was unexpected.
- **Both model routes stream** via `client.messages.stream()` rather than `create()`. A
  designed journey is thousands of output tokens and waiting for all of them before
  responding exceeded the ceiling.

`max_tokens` on the design pass is 4000, not 8000. The cap is not free — the model fills
the space it is given, and every token is wall-clock time. If generation starts truncating,
raise it deliberately rather than by default.

## Uploads, and starting mid-journey

`lib/extract.js` reads several files at once — PDF, Word, Excel, text, CSV, subtitles, email,
screenshots. Real accounts have material scattered across a brief, a transcript and a tracker,
and reading them together is the difference between a partial picture and an accurate one.

PDFs and images pass through as native blocks rather than being extracted: the model reads a
scanned page or a screenshot better than any parser. Everything else is flattened to text
server-side. Spreadsheets matter disproportionately — onboarding trackers live in Excel, and a
tracker states what is already done in a way prose rarely does.

Budgets are enforced per file and in total, so one enormous document cannot crowd out the
others, and one unreadable file never sinks the batch.

**A customer partway through must not get a journey that starts at zero.** The model marks
steps `done` or `active` — but every such claim requires quoted `evidence` from the documents,
and all of them go to a human before being committed. `ProgressReview` starts evidenced claims
ticked and unevidenced ones unticked; anything left unticked reverts to `open`.

The asymmetry is deliberate and must not be relaxed: a wrongly-completed step tells a customer
they signed off on something they did not, which is far worse than a journey that understates
progress. The prompt says so explicitly, and there is a test asserting evidence never rides on
an open step.

## Marketplace handoff

`marketplaceQuery()` and `sourcingBrief()` in `lib/surfaces.js`.

**The integration API does not expose Marketplace search.** It has `assignableExecutives`
(people already on the team) and project assignment, but no public "find me a ja-JP linguist"
endpoint. So this does not search from inside the app — it hands off to the Marketplace UI with
the journey's own filters already applied. A button landing on a real filtered search is worth
more than a fake result list, and if a search endpoint appears later it slots in behind the
same function.

Every unstaffed pair gets a **Find** button carrying source, target, certification,
specialization and turnaround. Defaults are omitted rather than shipped as noise — "Standard"
turnaround and "None" certification are not filters.

`sourcingBrief()` assembles the whole roster into the message an FDE would otherwise type by
hand, and covers only pairs that still need sourcing. Never ask for linguists you already have.

## Running inside Smartcat

`lib/surfaces.js` + `lib/embed.js`. Each phase declares a surface, and the phase button
resolves to one of three intents:

- `contact` — no URL at all. A kickoff is a conversation, and pretending otherwise with a
  link is worse than admitting it.
- `navigate` — we are embedded as a custom app, so ask the host to move. Opening a new tab
  from inside the platform back into the platform is jarring.
- `open` — standalone, so a new tab is correct.

`isEmbedded()` is conservative: if it cannot tell, it assumes standalone, because a new tab
is a harmless fallback while a failed `postMessage` is a dead button. **The postMessage shape
in `navigateHost()` is a guess** until the custom-app SDK is confirmed — that is the one thing
here to check against real docs.

Surfaces live in `lib/surfaces.js` only. There was briefly a second copy in `lib/theme.js`;
do not reintroduce it.

## Smartcat

`lib/smartcat.js` — Basic auth, where the **Account ID is the username and an API key is the
password**. These are two different values from Settings > API and people mix them up
constantly; the 401 message says so explicitly. Three servers (`us`, `eu`, `ea`) via
`SMARTCAT_SERVER`.

Every request goes through a serialised throttle. The documented limit is 4 requests per
second and computing health means one call per project, so the queue is in the client rather
than trusted to call sites.

`lib/health.js` turns real project data into the same six numbers that were previously
hardcoded arrays. These are the go-live gate, so they should be observations rather than
claims. `isRealProject()` filters "test", "asdf" and "Copy of Module 3" before the arithmetic
— counting junk makes adoption look worse than it is, and over-filtering makes it look better.
User activity returns `null` when there is no user data, never `0`: not knowing is different
from none.

## Layout

```
lib/journey.js       buildJourney + assess. Pure. The brain. Most tested.
lib/spine.js         required phases + coerceJourneyPlan. The guardrail.
lib/marketplace.js   review models, language pair state machine, roster readiness
lib/tickets.js       blockers on steps, ageing, staleness. Pure.
lib/markers.js       issues, decisions and context in the gaps between phases. Pure.
lib/intake.js        coerceIntake — what the model is allowed to change
lib/corpus.js        trait matching, edit detection, reference selection. Pure.
lib/smartcat.js      API client. Basic auth, throttled. Server-side only.
lib/extract.js       multi-file reading: pdf, docx, xlsx, images, text. Server-side.
lib/surfaces.js      where each phase button goes. Pure.
lib/embed.js         are we inside Smartcat, and how to navigate if so.
lib/health.js        real workspace metrics from project data. Pure arithmetic.
lib/db.js            Postgres via DATABASE_URL, with an in-memory fallback
lib/theme.js         colours, people, nav. Pure — keep it that way.
app/api/intake       document -> intake fields + journey plan   (model runs here)
app/api/draft        computed facts -> email or Slack message   (model runs here)
app/api/journeys     CRUD
components/journey/  StarMap, JourneyView, AgentPanel, StepRow, Roster
components/hub/      choice screen, past journeys, intake, replicate, Dropzone
```

## Testing

`npm test` — 144 tests, no network, no database, runs in about a second.

The suite exists to protect the invariants above, not to hit coverage. When adding a rule,
add the test that would fail if someone removed it. Several tests have already caught real
bugs: unresolved owners on generated journeys, empty phases from garbage input, a missing
go-live gate.

Assertion messages are written as sentences explaining *why* the rule exists. Keep that —
a failing test should teach, not just fail.

## Known gaps, in the order they matter

0. **Health is scoped to the wrong workspace.** `/api/smartcat/health` reads whichever
   account the server credentials belong to, so every journey would show the same numbers.
   Running as a custom app inside the customer's workspace solves this properly — and also
   solves auth, since the workspace already knows who is looking. Confirm what a custom app
   can read and store before building around it.
1. **Auth.** Every journey is visible to anyone who loads the page. A customer must see
   exactly one journey and never another customer's. Nothing ships externally until this exists.
2. **Nothing sends.** `assess()` only runs when a browser renders. A reminder that requires
   someone to remember to look is not a reminder. Needs a cron hitting `/api/sweep`, plus a
   send channel, plus `recentNudge()` wired in — the `nudges` table already exists precisely
   so the agent cannot email the same person about the same step every morning.
3. **The spine is inferred, not sourced.** The six phases and their step wording were
   derived from one account's data. There is a real Excel tracker; when it arrives, replace
   the guesswork.
4. **`TODAY` is pinned** in `lib/journey.js` so demos are stable. Swap for `new Date()` before real use.
5. **Inheritance is a flat list.** `INHERITED_KEYS` carries the same steps regardless of
   whether a second team shares locales, content type, or reviewers.
6. **No evals.** Prompt changes are currently judged by eyeballing one document. With a set
   of transcripts and known-correct answers, changes could be measured instead of guessed.
7. **The corpus is empty.** Retrieval works but has nothing to retrieve. It becomes useful
   at roughly ten real journeys and good at thirty.

## Conventions

- No em-dashes in user-facing copy.
- Customer-facing text is plain language. "Validate TMX locale codes for merged markets"
  is useful; "set up translation memory" is not.
- Tailwind core utilities only where possible; inline styles for anything themed off `C`.
- Errors name the thing that is wrong and what to do about it. "Could not reach the model"
  was replaced because it hid a wrong model name and a rejected key.
