import postgres from "postgres";
import { SEED } from "./seed.js";

/**
 * Storage.
 *
 * If DATABASE_URL is set, everything goes to Postgres and survives restarts.
 * If it isn't, the app falls back to an in-process Map so it still runs — but
 * that memory dies with the process, which is exactly the problem persistence
 * exists to solve. The UI says which mode it is in rather than pretending.
 */

const url = process.env.DATABASE_URL;
export const MODE = url ? "postgres" : "memory";

const sql = url
  ? postgres(url, {
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : "require",
      max: 5,
      idle_timeout: 20,
    })
  : null;

/* ── memory fallback ─────────────────────────────────────────────────── */
const mem = { journeys: new Map(SEED.map((r) => [r.id, r])), nudges: [], documents: [], jobs: new Map() };

/* ── schema, created once per process ────────────────────────────────── */
let ready = null;
async function ensure() {
  if (MODE === "memory") return;
  if (!ready) {
    ready = (async () => {
      await sql`
        create table if not exists journeys (
          id text primary key, org text, customer text not null, data jsonb not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now())`;
      await sql`create index if not exists journeys_updated_idx on journeys (updated_at desc)`;
      await sql`
        create table if not exists nudges (
          id bigserial primary key,
          journey_id text not null references journeys(id) on delete cascade,
          step_key text, channel text not null, subject text, body text,
          state text not null default 'drafted',
          created_at timestamptz not null default now())`;
      await sql`create index if not exists nudges_dedupe_idx on nudges (journey_id, step_key, created_at desc)`;
      await sql`
        create table if not exists documents (
          id bigserial primary key,
          journey_id text references journeys(id) on delete set null,
          filename text, kind text not null, content text, bytes integer,
          created_at timestamptz not null default now())`;
      await sql`create index if not exists documents_created_idx on documents (created_at desc)`;
      await sql`
        create table if not exists jobs (
          id text primary key, kind text not null,
          state text not null default 'queued', step text,
          progress integer not null default 0,
          payload jsonb, result jsonb, error text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now())`;
      await sql`create index if not exists jobs_created_idx on jobs (created_at desc)`;

      // First run against an empty database: bring the demo records in once.
      const [{ count }] = await sql`select count(*)::int as count from journeys`;
      if (count === 0) {
        for (const r of SEED) {
          await sql`insert into journeys ${sql({ id: r.id, org: r.org || null, customer: r.customer, data: r })}`;
        }
        console.log("[db] seeded " + SEED.length + " journeys");
      }
    })();
  }
  return ready;
}

/* ── journeys ────────────────────────────────────────────────────────── */

export async function listJourneys() {
  await ensure();
  if (MODE === "memory") return [...mem.journeys.values()];
  const rows = await sql`select data from journeys order by updated_at desc`;
  return rows.map((r) => r.data);
}

export async function getJourney(id) {
  await ensure();
  if (MODE === "memory") return mem.journeys.get(id) || null;
  const rows = await sql`select data from journeys where id = ${id}`;
  return rows[0]?.data || null;
}

export async function saveJourney(rec) {
  await ensure();
  if (!rec?.id) throw new Error("A journey needs an id.");
  if (MODE === "memory") { mem.journeys.set(rec.id, rec); return rec; }
  await sql`
    insert into journeys ${sql({ id: rec.id, org: rec.org || null, customer: rec.customer || "Untitled", data: rec })}
    on conflict (id) do update set
      org = excluded.org,
      customer = excluded.customer,
      data = excluded.data,
      updated_at = now()`;
  return rec;
}

export async function deleteJourney(id) {
  await ensure();
  if (MODE === "memory") return mem.journeys.delete(id);
  await sql`delete from journeys where id = ${id}`;
  return true;
}

/* ── nudges: the record of what has already been said ────────────────── */

export async function logNudge({ journeyId, stepKey, channel, subject, body, state = "drafted" }) {
  await ensure();
  const row = { journey_id: journeyId, step_key: stepKey || null, channel, subject: subject || null, body: body || null, state };
  if (MODE === "memory") { mem.nudges.push({ ...row, created_at: new Date() }); return; }
  await sql`insert into nudges ${sql(row)}`;
}

/** Has this exact thing already gone out recently? The guard against becoming spam. */
export async function recentNudge({ journeyId, stepKey, withinDays = 3 }) {
  await ensure();
  const cutoff = Date.now() - withinDays * 86400000;
  if (MODE === "memory") {
    return mem.nudges.find(
      (n) => n.journey_id === journeyId && n.step_key === (stepKey || null) && +n.created_at > cutoff
    ) || null;
  }
  const rows = await sql`
    select * from nudges
    where journey_id = ${journeyId}
      and step_key is not distinct from ${stepKey || null}
      and created_at > now() - (${withinDays} || ' days')::interval
    order by created_at desc limit 1`;
  return rows[0] || null;
}

/* ── corpus: source documents and the journeys they produced ──────────── */

const MAX_STORED_CHARS = 200_000;

export async function saveDocument({ journeyId, filename, kind, content, bytes }) {
  await ensure();
  const row = {
    journey_id: journeyId || null,
    filename: (filename || "untitled").slice(0, 200),
    kind: kind || "text",
    content: typeof content === "string" ? content.slice(0, MAX_STORED_CHARS) : null,
    bytes: Number.isFinite(+bytes) ? Math.round(+bytes) : null,
  };
  if (MODE === "memory") {
    mem.documents.unshift({ ...row, id: mem.documents.length + 1, created_at: new Date() });
    return;
  }
  await sql`insert into documents ${sql(row)}`;
}

/** Attach a document to the journey it produced, once that journey has an id. */
export async function linkLatestDocument(journeyId) {
  await ensure();
  if (MODE === "memory") {
    const d = mem.documents.find((x) => !x.journey_id);
    if (d) d.journey_id = journeyId;
    return;
  }
  await sql`
    update documents set journey_id = ${journeyId}
    where id = (select id from documents where journey_id is null order by created_at desc limit 1)`;
}

export async function listDocuments(limit = 50) {
  await ensure();
  if (MODE === "memory") return mem.documents.slice(0, limit).map((d) => ({ ...d, content: null }));
  const rows = await sql`
    select d.id, d.journey_id, d.filename, d.kind, d.bytes, d.created_at, j.customer
    from documents d left join journeys j on j.id = d.journey_id
    order by d.created_at desc limit ${limit}`;
  return rows;
}

/**
 * Candidate pool for reference retrieval. Kept deliberately dumb: hand every
 * designed journey to pickReferences() in lib/corpus.js and let the pure,
 * tested scoring decide. When this grows past a few hundred rows, filter here
 * on the high-weight traits first — or add pgvector behind the same function.
 */
export async function findReferences() {
  await ensure();
  const all = await listJourneys();
  return all.filter((r) => Array.isArray(r.phases) && r.phases.length);
}

/* ── jobs: work too slow for a single request ─────────────────────────── */

export async function createJob({ id, kind, payload }) {
  await ensure();
  const row = { id, kind, state: "queued", step: "Queued", progress: 0, payload };
  if (MODE === "memory") { mem.jobs.set(id, { ...row, created_at: new Date(), updated_at: new Date() }); return row; }
  await sql`insert into jobs ${sql({ ...row, payload: sql.json(payload) })}`;
  return row;
}

export async function getJob(id) {
  await ensure();
  if (MODE === "memory") return mem.jobs.get(id) || null;
  const rows = await sql`select * from jobs where id = ${id}`;
  return rows[0] || null;
}

/**
 * Update a running job. Called several times during generation so the UI can
 * show what is happening rather than an undifferentiated spinner.
 */
export async function updateJob(id, patch) {
  await ensure();
  if (MODE === "memory") {
    const j = mem.jobs.get(id);
    if (j) mem.jobs.set(id, { ...j, ...patch, updated_at: new Date() });
    return;
  }
  const cols = {};
  for (const k of ["state", "step", "progress", "error"]) if (k in patch) cols[k] = patch[k];
  if ("result" in patch) cols.result = sql.json(patch.result);
  if (!Object.keys(cols).length) return;
  await sql`update jobs set ${sql(cols)}, updated_at = now() where id = ${id}`;
}

/** Housekeeping: finished jobs are not worth keeping around. */
export async function pruneJobs(olderThanHours = 24) {
  await ensure();
  if (MODE === "memory") {
    // +1 so that pruneJobs(0) means "everything", rather than excluding a job
    // created in the same millisecond as the call.
    const cutoff = Date.now() - olderThanHours * 3600000 + 1;
    for (const [id, j] of mem.jobs) if (+j.created_at < cutoff) mem.jobs.delete(id);
    return;
  }
  await sql`delete from jobs where created_at < now() - (${olderThanHours} || ' hours')::interval`;
}
