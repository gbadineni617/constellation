-- Constellation schema.
--
-- Two tables. The journey record itself is stored as jsonb rather than being
-- normalised into steps/dates/owners tables, because buildJourney() and assess()
-- already take a plain object — so a row can be handed to them unchanged. If you
-- later need cross-customer queries like "every step due this week", that is the
-- point to promote steps into their own table.

create table if not exists journeys (
  id          text primary key,
  org         text,
  customer    text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists journeys_org_idx on journeys (org);
create index if not exists journeys_updated_idx on journeys (updated_at desc);

-- Every nudge that has been drafted or sent. This is what stops the agent
-- emailing the same person about the same overdue step every morning.
create table if not exists nudges (
  id          bigserial primary key,
  journey_id  text not null references journeys(id) on delete cascade,
  step_key    text,
  channel     text not null,
  subject     text,
  body        text,
  state       text not null default 'drafted',   -- drafted | sent | suppressed
  created_at  timestamptz not null default now()
);

create index if not exists nudges_journey_idx on nudges (journey_id, created_at desc);
create index if not exists nudges_dedupe_idx on nudges (journey_id, step_key, created_at desc);

-- The source material a journey was designed from. This is the corpus that makes
-- later generations better: findReferences() retrieves comparable past journeys and
-- puts them in the prompt as worked examples.
--
-- Note the retention question this raises. Call transcripts are customer data. Before
-- storing anything from Gong, confirm the DPA covers it.
create table if not exists documents (
  id          bigserial primary key,
  journey_id  text references journeys(id) on delete set null,
  filename    text,
  kind        text not null,              -- text | pdf | docx | image
  content     text,                       -- extracted plain text, not the original bytes
  bytes       integer,
  created_at  timestamptz not null default now()
);

create index if not exists documents_journey_idx on documents (journey_id);
create index if not exists documents_created_idx on documents (created_at desc);

-- Work that takes longer than a request should.
--
-- Designing a journey is ~45 seconds of model time, which exceeds the platform's
-- function ceiling. So the upload returns immediately with a job id, generation
-- happens in a separate invocation, and the browser polls. No single request is
-- ever long, so the ceiling stops applying.
--
-- The progress column is not decoration: 45 seconds of spinner reads as broken
-- even when it is working.
create table if not exists jobs (
  id          text primary key,
  kind        text not null,                  -- intake
  state       text not null default 'queued', -- queued | running | done | failed
  step        text,                           -- what it is doing, for the UI
  progress    integer not null default 0,     -- 0-100
  payload     jsonb,                          -- the request, for the worker
  result      jsonb,                          -- the finished plan
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists jobs_created_idx on jobs (created_at desc);
