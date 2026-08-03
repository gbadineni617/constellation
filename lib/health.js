import { listProjects, getProject } from "./smartcat.js";
import { HEALTH_TARGETS } from "./journey.js";

/**
 * Workspace health, computed from the workspace itself.
 *
 * Until now `health` was a hardcoded array on each record — numbers a human
 * typed in. These are the go-live gate, so they should be observations, not
 * claims. This module turns real project data into the same six numbers.
 *
 * Everything here is arithmetic. No model is involved in deciding whether an
 * account is adopting the platform, for the same reason no model decides
 * whether a journey is at risk: an FDE has to be able to explain the number.
 */

/** Names that mean somebody was poking around, not doing work. */
const NOISE = /^(test|asdf|qwerty|untitled|sample|demo|tmp|temp|copy of)\b|^\W*$/i;

/** A project this small is almost certainly someone trying the interface. */
const MIN_REAL_WORDS = 100;

/**
 * Separate real work from experimentation. Getting this wrong in either
 * direction ruins the numbers: count the junk and adoption looks worse than it
 * is; exclude too eagerly and it looks better.
 */
export function isRealProject(p) {
  const name = String(p?.name || "").trim();
  if (!name || NOISE.test(name)) return false;
  const words = Number(p?.statistics?.totalWords ?? p?.wordsCount ?? 0);
  if (words && words < MIN_REAL_WORDS) return false;
  return true;
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

/**
 * Compute the six health metrics from a list of enriched projects.
 * Kept pure and separate from fetching so it can be tested without a network.
 */
export function computeHealth(projects, users = []) {
  const real = projects.filter(isRealProject);
  const n = real.length;

  const withTm = real.filter((p) => (p.translationMemories || []).length > 0).length;
  const withGlossary = real.filter((p) => (p.glossaries || []).length > 0).length;
  const withTemplate = real.filter((p) => Boolean(p.workflowStages?.length || p.assignmentTemplateId)).length;
  const withAgent = real.filter((p) =>
    (p.workflowStages || []).some((s) => /ai|agent|auto/i.test(String(s?.stageType || s?.name || "")))
  ).length;
  const complete = real.filter((p) => {
    const done = Number(p?.statistics?.completedWords ?? 0);
    const total = Number(p?.statistics?.totalWords ?? 0);
    return total > 0 && done >= total;
  }).length;

  // "Active in the last 30 days" is only answerable if we were given users.
  const cutoff = Date.now() - 30 * 86400000;
  const activeUsers = users.filter((u) => {
    const seen = u?.lastActivityDate || u?.lastLoginDate;
    return seen && new Date(seen).getTime() > cutoff;
  }).length;

  const values = [
    pct(withTm, n),
    pct(withGlossary, n),
    pct(withTemplate, n),
    pct(withAgent, n),
    pct(complete, n),
    users.length ? pct(activeUsers, users.length) : null,
  ];

  return {
    values,
    // What each number is made of, so a customer can be told where it came from
    detail: HEALTH_TARGETS.map((m, i) => ({
      key: m.k,
      target: m.target,
      value: values[i],
      met: values[i] != null && values[i] >= m.target,
      unknown: values[i] == null,
    })),
    sampled: n,
    excluded: projects.length - n,
    projectsTotal: projects.length,
  };
}

/**
 * Fetch and compute. One call for the list, then one per project for the
 * details — which is why lib/smartcat.js throttles. On a large workspace this
 * is slow by design rather than rate-limited into failure.
 */
export async function fetchHealth({ limit = 60 } = {}) {
  const list = await listProjects();
  if (!Array.isArray(list)) return { error: "Smartcat did not return a project list." };

  // Newest first, so a capped sample reflects current practice rather than history.
  const ordered = [...list].sort(
    (a, b) => new Date(b.creationDate || 0) - new Date(a.creationDate || 0)
  );
  const sample = ordered.slice(0, limit);

  const enriched = [];
  for (const p of sample) {
    try {
      enriched.push(await getProject(p.id));
    } catch {
      enriched.push(p);   // partial data beats abandoning the whole computation
    }
  }

  return {
    ...computeHealth(enriched),
    capped: list.length > limit ? { shown: limit, total: list.length } : null,
  };
}
