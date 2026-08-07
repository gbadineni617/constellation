/**
 * Resolve a step key from a built journey.
 *
 * Tests used to hardcode keys from the inferred spine. Now the spine comes from
 * the real checklists and keys derive from wording, so tests ask the journey
 * for a key rather than assuming one. That also means renaming a checklist line
 * does not silently break a test that was really about something else.
 */
export function stepKey(journey, phaseId, index = 0) {
  const phase = journey.find((p) => p.id === phaseId);
  if (!phase) throw new Error("no phase " + phaseId);
  const step = phase.items[index];
  if (!step) throw new Error("no step " + index + " in " + phaseId);
  return step.k;
}

/** First step in a phase that is currently open, for tests about outstanding work. */
export function openStepKey(journey, phaseId) {
  const phase = journey.find((p) => p.id === phaseId);
  const step = (phase?.items || []).find((i) => i.s === "open");
  if (!step) throw new Error("no open step in " + phaseId);
  return step.k;
}
