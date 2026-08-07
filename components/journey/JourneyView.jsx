"use client";

import React, { useState, useMemo, useEffect } from "react";

import { Check, Minus, Sparkles, ArrowLeft, ArrowUpRight, AlertCircle, AlertTriangle, ChevronDown, Layers, Languages, Gauge, Plug, Copy, Plus, Users, BadgeCheck, RefreshCw, ArrowRight, CalendarDays, Pencil, X } from "lucide-react";

import { C, STATUS, NEXT, PEOPLE, peopleOf } from "@/lib/theme";

import { buildJourney, progressOf, assess, copyFor, CONTENT_PATHS, CONTENT_COPY, HEALTH_TARGETS } from "@/lib/journey";
import { REVIEW_MODELS, REVIEW_MODEL_IDS, usesMarketplace, reviewModelUnknown } from "@/lib/marketplace";
import { coerceTicket, isOpen } from "@/lib/tickets";
import { coerceMarker } from "@/lib/markers";
import { TIERS, TIER_IDS, sequenceState, resolveTier, remapToTier } from "@/lib/checklist";
import { describeTarget } from "@/lib/surfaces";
import { isEmbedded, navigateHost } from "@/lib/embed";
import { readJson, apiFetch } from "@/lib/http";
import { isApproved, approve, unapprove } from "@/lib/corpus";
import { GapPanel } from "./GapPanel";

import { Pill, Avatar, Popover, AddForm } from "@/components/shared";

import { StarMap } from "./StarMap";

import { AgentPanel } from "./AgentPanel";
import { StepRow } from "./StepRow";
import { Roster } from "./Roster";



export function JourneyView({ rec, onBack, onAxis, onReplicate, siblings, onPatch }) {
  const journey = useMemo(() => buildJourney(rec), [rec]);
  const [selId, setSelId] = useState(rec.stage || "core");
  const [pop, setPop] = useState(null);
  const [showSteps, setShowSteps] = useState(false);
  const [adding, setAdding] = useState(null); // "step" | "phase" | null
  const [gapId, setGapId] = useState(null);
  const [editingPhase, setEditingPhase] = useState(false);
  const [remap, setRemap] = useState(null);
  const [phaseDraft, setPhaseDraft] = useState("");

  // Phases can be renamed, including the required ones. The id never changes, so
  // the spine still recognises them and everything keyed off the phase survives.
  /**
   * Switch plan.
   *
   * On a template journey this is just an axis. On a generated one the phases
   * came from the model adapting the other checklist, so the journey has to be
   * re-mapped — carrying status, notes and anything bespoke across rather than
   * discarding the work.
   */
  const switchTier = (t) => {
    if (t === resolveTier(rec.tier)) return;
    if (!generated) { onAxis("tier", t); return; }

    const out = remapToTier(rec, t);
    setRemap(out.orphaned.length ? { to: TIERS[t].label, ...out } : null);
    onPatch((r) => ({ ...r, tier: t, phases: out.phases }));
  };

  const renamePhase = () => {
    if (!phaseDraft.trim()) return;
    onPatch((r) => ({ ...r, phaseRenames: { ...(r.phaseRenames || {}), [sel.id]: phaseDraft.trim() } }));
    setEditingPhase(false);
  };
  const [embedded, setEmbedded] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncErr, setSyncErr] = useState("");

  // Pull the six health numbers from the workspace itself, rather than trusting
  // whatever a human last typed in.
  useEffect(() => { setEmbedded(isEmbedded()); }, []);

  const syncHealth = async () => {
    setSyncing(true); setSyncErr("");
    try {
      const res = await apiFetch("/api/smartcat/health");
      const data = await readJson(res);
      onPatch((r) => ({
        ...r,
        health: data.values.map((x) => (x == null ? 0 : x)),
        healthSource: { at: new Date().toISOString().slice(0, 10), sampled: data.sampled, excluded: data.excluded },
      }));
    } catch (e) {
      setSyncErr(e.message || String(e));
    } finally {
      setSyncing(false);
    }
  };

  const cycle = (key) =>
    onPatch((r) => ({ ...r, overrides: { ...(r.overrides || {}), [key]: NEXT[(r.overrides || {})[key] || currentStatus(key)] } }));

  const currentStatus = (key) => {
    for (const p of journey) { const it = p.items.find((x) => x.k === key); if (it) return it.s; }
    return "open";
  };

  const addStep = ({ a, b, who }) => {
    const k = "x" + Date.now();
    onPatch((r) => ({
      ...r,
      customItems: { ...(r.customItems || {}), [sel.id]: [...((r.customItems || {})[sel.id] || []), { k, t: a, note: b, who: [who] }] },
    }));
    setAdding(null); setShowSteps(true);
  };

  const addPhase = ({ a, b }) => {
    const id = "p" + Date.now();
    onPatch((r) => ({ ...r, customPhases: [...(r.customPhases || []), { id, label: a, week: "Added", blurb: b, proof: "" }] }));
    setAdding(null); setSelId(id);
  };

  const idx = Math.max(0, journey.findIndex((p) => p.id === selId));
  const sel = journey[idx];
  const { done, total, pct } = progressOf(journey);
  const lit = journey.filter((p) => p.status === "done").length;
  const copy = copyFor(sel, rec.contentPath);
  const stepsDone = sel.items.filter((i) => i.s === "done" || i.s === "na").length;
  const risk = useMemo(() => assess(rec, journey), [rec, journey]);
  const people = useMemo(() => peopleOf(rec), [rec]);

  // The whole map stays visible; only confirmation is sequenced. Hiding future
  // phases would stop an FDE looking ahead during a call, which is exactly when
  // they need to.
  const locks = useMemo(() => sequenceState(journey.map((p) => ({ ...p, steps: p.items }))), [journey]);
  const generated = Array.isArray(rec.phases) && rec.phases.length > 0;
  const approved = isApproved(rec);
  const phaseOverdue = risk.overdue.filter((o) => o.phase === sel.label).length;
  const phaseBlocked = sel.items.filter((i) => (i.tickets || []).some(isOpen)).length;

  // Where this phase's button should send you, and whether that is a new tab or
  // a navigation inside the host.
  const target = describeTarget(sel.surface, {
    embedded,
    region: rec.region || "us",
    accountId: rec.smartcatAccountId || "",
  });
  const metTargets = HEALTH_TARGETS.filter((m, i) => ((rec.health || [])[i] || 0) >= m.target).length;
  const upcoming = journey.slice(idx + 1, idx + 3);

  const toggle = (k) => setPop((p) => (p === k ? null : k));

  const ctl = (k, Ic, label, value, tone) => (
    <button
      onClick={() => toggle(k)}
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
      style={{ background: pop === k ? C.panel2 : C.panel, border: "1px solid " + (pop === k ? C.violet + "77" : C.line), color: C.muted }}
    >
      <Ic size={14} style={{ color: tone }} />
      <span style={{ color: C.faint }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 500 }}>{value}</span>
      <ChevronDown size={13} style={{ color: C.faint, transform: pop === k ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
    </button>
  );

  return (
    <>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm mb-4" style={{ color: C.muted }}>
        <ArrowLeft size={15} /> All journeys
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1" style={{ color: C.violet }}>
            <Sparkles size={15} />
            <span className="mono tracking-widest uppercase" style={{ fontSize: 11 }}>Your implementation journey</span>
          </div>
          <h1 className="disp text-2xl font-bold">{rec.customer}</h1>
          {approved && (
            <div className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 mt-2 mr-2" style={{ background: C.teal + "1A", border: "1px solid " + C.teal + "44" }}>
              <BadgeCheck size={12} style={{ color: C.teal }} />
              <span style={{ fontSize: 11, color: C.teal }}>
                Signed off{rec.approval?.by ? " by " + rec.approval.by : ""} — informs future journeys
              </span>
            </div>
          )}
          {rec.generatedFrom && (
            <div className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 mt-2" style={{ background: C.violet + "1A", border: "1px solid " + C.violet + "44" }}>
              <Sparkles size={12} style={{ color: C.violet }} />
              <span style={{ fontSize: 11, color: C.violet }}>
                Designed from {rec.generatedFrom}
              </span>
            </div>
          )}
          {rec.inheritedFrom && (
            <div className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 mt-2" style={{ background: C.teal + "1A", border: "1px solid " + C.teal + "44" }}>
              <Copy size={12} style={{ color: C.teal }} />
              <span style={{ fontSize: 11, color: C.teal }}>
                Started from {rec.inheritedFrom.customer} — {rec.inheritedFrom.carries.length} things carried over
              </span>
            </div>
          )}
          <div className="text-sm mt-1" style={{ color: C.muted }}>
            FDE <span style={{ color: C.text }}>{rec.fde}</span> · go-live <span style={{ color: C.text }}>{rec.goLive}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="mono text-3xl font-bold" style={{ color: C.violet }}>{pct}%</div>
          <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ width: 160, background: C.line }}>
            <div className="h-full rounded-full" style={{ width: pct + "%", background: "linear-gradient(90deg," + C.teal + "," + C.violet + ")", transition: "width .5s" }} />
          </div>
          <div className="text-xs mt-1" style={{ color: C.muted }}>
            {lit} of {journey.length} phases complete
          </div>
        </div>
      </div>

      {/* Controls — tucked into pop-ups so the map stays clean */}
      <div className="relative mt-5 flex flex-wrap gap-2" style={{ zIndex: 10 }}>
        {ctl("tier", Layers, "Plan", TIERS[resolveTier(rec.tier)].label, C.violet)}
        {!generated && ctl("content", Layers, "Content", rec.contentPath, C.violet)}
        {!generated && ctl("maturity", Languages, "Assets", rec.maturity === "greenfield" ? "New to localization" : "From a prior vendor", C.teal)}
        {ctl("reviewers", Users, "Reviewers", REVIEW_MODELS[rec.reviewModel]?.short || "Not established", reviewModelUnknown(rec) ? C.amber : C.pink)}
        {!generated && ctl("delivery", Plug, "Delivery", rec.delivery === "connected" ? (rec.connector || "Connected") : "Manual upload", C.pink)}
        {ctl("health", Gauge, "Health", metTargets + " of " + HEALTH_TARGETS.length + " targets met", metTargets === HEALTH_TARGETS.length ? C.teal : C.amber)}
        {/* Approval is the feedback loop: signing off is what makes a journey
            trustworthy enough to teach the next one. */}
        <button
          onClick={() => onPatch((r) => (isApproved(r) ? unapprove(r) : approve(r, rec.fde)))}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm ml-auto"
          style={{
            background: approved ? C.teal + "1A" : C.panel,
            border: "1px solid " + (approved ? C.teal + "77" : C.line),
            color: approved ? C.teal : C.muted,
          }}
          title={approved ? "Approved — this journey teaches the next one. Click to revoke." : "Approve so this journey can inform future ones"}
        >
          <BadgeCheck size={14} />
          {approved ? "Approved" : "Approve"}
          {approved && rec.approval?.at && (
            <span className="mono" style={{ fontSize: 10, color: C.faint }}>{rec.approval.at}</span>
          )}
        </button>

        <button
          onClick={onReplicate}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
          style={{ background: C.panel, border: "1px solid " + C.line, color: C.muted }}
        >
          <Copy size={14} /> Replicate for another team
          {siblings > 1 && <span className="mono" style={{ fontSize: 10, color: C.faint }}>{siblings} at {rec.org}</span>}
        </button>

        {pop && <button className="fixed inset-0" style={{ zIndex: 20, cursor: "default" }} onClick={() => setPop(null)} aria-label="Close" />}

        {pop === "tier" && (
          <Popover>
            <div className="text-xs mb-3" style={{ color: C.muted }}>
              Which implementation checklist this customer follows. The two are different
              methodologies, not one filtered.
            </div>
            <div className="space-y-1.5">
              {TIER_IDS.map((t) => (
                <button
                  key={t}
                  onClick={() => { switchTier(t); setPop(null); }}
                  className="w-full text-left rounded-lg px-3 py-2.5"
                  style={{
                    background: resolveTier(rec.tier) === t ? C.brand + "2E" : "transparent",
                    border: "1px solid " + (resolveTier(rec.tier) === t ? C.brand + "77" : C.line),
                  }}
                >
                  <div className="text-sm flex items-baseline gap-2" style={{ color: C.text }}>
                    {TIERS[t].label}
                    <span className="mono" style={{ fontSize: 10, color: C.faint }}>{TIERS[t].cadence}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: C.faint }}>{TIERS[t].blurb}</div>
                </button>
              ))}
            </div>
          </Popover>
        )}

        {pop === "content" && (
          <Popover>
            <div className="text-xs mb-3" style={{ color: C.muted }}>
              The path re-assembles around what you're translating.
            </div>
            <div className="space-y-1.5">
              {Object.keys(CONTENT_PATHS).map((r) => (
                <button
                  key={r}
                  onClick={() => { onAxis("contentPath", r); setPop(null); }}
                  className="w-full text-left rounded-lg px-3 py-2.5"
                  style={{ background: rec.contentPath === r ? C.brand + "2E" : "transparent", border: "1px solid " + (rec.contentPath === r ? C.brand + "77" : C.line) }}
                >
                  <div className="text-sm" style={{ color: C.text }}>{r}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.faint }}>{CONTENT_COPY[r].blurb}</div>
                </button>
              ))}
            </div>
          </Popover>
        )}

        {pop === "maturity" && (
          <Popover>
            <div className="text-xs mb-3" style={{ color: C.muted }}>
              Whether you're bringing translation memory with you changes the middle of the path.
            </div>
            <div className="space-y-1.5">
              {[
                ["greenfield", "New to localization", "We build your translation memory and glossary from your first projects."],
                ["mature", "Has assets from a prior vendor", "We import your TMX and termbase, then check locale codes and match rates."],
              ].map(([k, lbl, d]) => (
                <button
                  key={k}
                  onClick={() => { onAxis("maturity", k); setPop(null); }}
                  className="w-full text-left rounded-lg px-3 py-2.5"
                  style={{ background: rec.maturity === k ? C.teal + "22" : "transparent", border: "1px solid " + (rec.maturity === k ? C.teal + "77" : C.line) }}
                >
                  <div className="text-sm" style={{ color: C.text }}>{lbl}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.faint }}>{d}</div>
                </button>
              ))}
            </div>
          </Popover>
        )}

        {pop === "delivery" && (
          <Popover>
            <div className="text-xs mb-3" style={{ color: C.muted }}>
              How content reaches Smartcat. A connector adds a whole phase; manual upload doesn't.
            </div>
            <div className="space-y-1.5">
              {[
                ["manual", "Manual upload", "Someone uploads files and downloads the results. Nothing to configure."],
                ["connected", "Connected to a source system", "We wire up your CMS, LMS, or repo — five extra steps, then it runs itself."],
              ].map(([k, lbl, d]) => (
                <button
                  key={k}
                  onClick={() => { onAxis("delivery", k); setPop(null); }}
                  className="w-full text-left rounded-lg px-3 py-2.5"
                  style={{ background: (rec.delivery || "manual") === k ? C.pink + "22" : "transparent", border: "1px solid " + ((rec.delivery || "manual") === k ? C.pink + "77" : C.line) }}
                >
                  <div className="text-sm" style={{ color: C.text }}>{lbl}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.faint }}>{d}</div>
                </button>
              ))}
            </div>
          </Popover>
        )}

        {pop === "reviewers" && (
          <Popover width={420}>
            <div className="text-xs mb-3" style={{ color: C.muted }}>
              Who does the linguistic work. Marketplace adds a sourcing phase and a go-live gate.
            </div>
            <div className="space-y-1.5">
              {REVIEW_MODEL_IDS.map((k) => (
                <button
                  key={k}
                  onClick={() => { onAxis("reviewModel", k); setPop(null); }}
                  className="w-full text-left rounded-lg px-3 py-2.5"
                  style={{ background: rec.reviewModel === k ? C.pink + "22" : "transparent", border: "1px solid " + (rec.reviewModel === k ? C.pink + "77" : C.line) }}
                >
                  <div className="text-sm" style={{ color: C.text }}>{REVIEW_MODELS[k].label}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.faint }}>{REVIEW_MODELS[k].blurb}</div>
                </button>
              ))}
            </div>
          </Popover>
        )}

        {pop === "health" && (
          <Popover width={440}>
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={14} style={{ color: C.amber }} />
              <h3 className="disp text-sm font-bold">Workspace health</h3>
            </div>
            <div className="text-xs mb-3" style={{ color: C.muted }}>
              Every target has to be met before go-live sign-off.
            </div>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                onClick={syncHealth}
                disabled={syncing}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                style={{ fontSize: 11, background: C.panel, border: "1px solid " + C.line, color: syncing ? C.faint : C.text }}
              >
                <RefreshCw size={11} className={syncing ? "spin" : ""} />
                {syncing ? "Reading the workspace…" : "Pull from Smartcat"}
              </button>
              {rec.healthSource && !syncing && (
                <span className="mono" style={{ fontSize: 10, color: C.faint }}>
                  {rec.healthSource.sampled} projects · {rec.healthSource.at}
                </span>
              )}
            </div>

            {syncErr && (
              <div className="rounded-lg px-2.5 py-2 mb-3" style={{ background: C.pink + "12", border: "1px solid " + C.pink + "33" }}>
                <div style={{ fontSize: 11, color: C.text }}>{syncErr}</div>
              </div>
            )}
            <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {HEALTH_TARGETS.map((m, i) => {
                const now = (rec.health || [])[i] || 0;
                const hit = now >= m.target;
                return (
                  <div key={m.k}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span style={{ fontSize: 11, color: C.text }}>{m.k}</span>
                      <span className="mono shrink-0" style={{ fontSize: 11, color: hit ? C.teal : C.amber }}>
                        {now}<span style={{ color: C.faint }}>/{m.target}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: C.line }}>
                      <div className="h-full rounded-full" style={{ width: Math.min(100, (now / m.target) * 100) + "%", background: hit ? C.teal : C.amber }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Popover>
        )}
      </div>

      {generated && rec.rationale && (
        <div className="rounded-xl px-4 py-3 mt-4 flex items-start gap-2.5" style={{ background: C.panel, border: "1px solid " + C.line }}>
          <Sparkles size={14} style={{ color: C.violet, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div className="mono uppercase tracking-wider" style={{ fontSize: 10, color: C.faint }}>Why this path</div>
            <div className="text-sm mt-1" style={{ color: C.text }}>{rec.rationale}</div>
          </div>
        </div>
      )}

      {remap && (
        <div className="rounded-xl px-4 py-3 mt-4 flex items-start gap-2.5 fade" style={{ background: C.amber + "12", border: "1px solid " + C.amber + "3D" }}>
          <AlertTriangle size={14} style={{ color: C.amber, flexShrink: 0, marginTop: 2 }} />
          <div className="flex-1">
            <div className="text-sm" style={{ color: C.text }}>
              Switched to the {remap.to} checklist — {remap.carried} steps carried across.
            </div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>
              {remap.orphaned.length} step{remap.orphaned.length === 1 ? "" : "s"} had no equivalent and
              {remap.orphaned.length === 1 ? " was" : " were"} dropped: {remap.orphaned.slice(0, 3).join("; ")}
              {remap.orphaned.length > 3 ? " and " + (remap.orphaned.length - 3) + " more" : ""}.
            </div>
          </div>
          <button onClick={() => setRemap(null)} style={{ color: C.faint }}><X size={14} /></button>
        </div>
      )}

      {/* The shape of this particular path */}
      <div className="flex items-baseline gap-2 mt-5 flex-wrap">
        <span className="mono uppercase tracking-widest" style={{ fontSize: 10, color: C.faint }}>This path</span>
        <span className="mono text-sm" style={{ color: C.violet }}>{journey.length} phases</span>
        <span style={{ color: C.line }}>·</span>
        <span className="mono text-sm" style={{ color: C.violet }}>{total} steps</span>
        <span className="text-xs" style={{ color: C.faint }}>
          {generated
            ? "— designed for this customer, not a template"
            : journey.length <= 7
            ? "— the short path; nothing extra to configure"
            : journey.length >= 9
            ? "— the long path; a connector and a content type that both need work"
            : "— standard length"}
        </span>
      </div>

      {/* The map */}
      <StarMap
        journey={journey}
        selId={sel.id}
        onSelect={(id) => { setSelId(id); setShowSteps(false); setAdding(null); setGapId(null); }}
        onAddPhase={() => setAdding("phase")}
        rec={rec}
        gapId={gapId}
        onSelectGap={setGapId}
      />

      {gapId && (() => {
        const gi = journey.findIndex((p) => p.id === gapId);
        if (gi < 0 || gi >= journey.length - 1) return null;
        return (
          <GapPanel
            rec={rec}
            phaseId={gapId}
            beforeLabel={journey[gi].label}
            afterLabel={journey[gi + 1].label}
            people={people}
            onClose={() => setGapId(null)}
            onAdd={(m) => onPatch((r) => ({ ...r, markers: [...(r.markers || []), coerceMarker(m)] }))}
            onToggle={(id, state) =>
              onPatch((r) => ({ ...r, markers: (r.markers || []).map((x) => (x.id === id ? { ...x, state } : x)) }))
            }
          />
        );
      })()}

      {adding === "phase" && <AddForm kind="phase" onCancel={() => setAdding(null)} onSave={addPhase} />}

      {/* The selected phase, in plain language */}
      <div className="rounded-2xl p-6 fade mt-4" key={sel.id + rec.contentPath + rec.maturity} style={{ background: C.panel, border: "1px solid " + C.line }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="mono uppercase tracking-widest" style={{ fontSize: 10, color: C.faint }}>
            Phase {idx + 1} of {journey.length}
          </span>
          <Pill tone={STATUS[sel.status].color}>
            {sel.status === "done" ? "Achieved" : sel.status === "active" ? "In progress" : "Not started"}
          </Pill>
          <span className="mono text-xs" style={{ color: C.muted }}>{sel.week}</span>
        </div>

        {editingPhase ? (
          <div className="flex items-center gap-2 mt-2">
            <input
              autoFocus
              value={phaseDraft}
              onChange={(e) => setPhaseDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && phaseDraft.trim()) { renamePhase(); }
                if (e.key === "Escape") { setPhaseDraft(sel.label); setEditingPhase(false); }
              }}
              className="disp text-xl font-bold rounded px-2 py-1"
              style={{ background: C.panel2, border: "1px solid " + C.violet + "77", color: C.text, outline: "none", minWidth: 280 }}
            />
            <button onClick={renamePhase} className="rounded p-1" style={{ color: C.teal }} title="Save">
              <Check size={16} strokeWidth={3} />
            </button>
            <button onClick={() => { setPhaseDraft(sel.label); setEditingPhase(false); }} className="rounded p-1" style={{ color: C.faint }}>
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-2">
            <h2 className="disp text-xl font-bold">{sel.label}</h2>
            <button
              onClick={() => { setPhaseDraft(sel.label); setEditingPhase(true); }}
              className="rounded p-1 row-actions"
              style={{ color: C.muted, border: "1px solid " + C.line, lineHeight: 0 }}
              title="Rename this phase"
            >
              <Pencil size={12} />
            </button>
          </div>
        )}
        <p className="text-sm mt-2 leading-relaxed" style={{ color: C.text, maxWidth: 620 }}>{copy.blurb}</p>

        {/* Have you achieved it? */}
        <div className="rounded-xl px-4 py-3 mt-4 flex items-start gap-3" style={{ background: C.panel2, border: "1px solid " + (sel.status === "done" ? C.teal + "44" : C.line) }}>
          <span
            className="mt-0.5 rounded-full flex items-center justify-center shrink-0"
            style={{ width: 20, height: 20, background: sel.status === "done" ? C.teal : "transparent", border: sel.status === "done" ? "none" : "1.5px solid " + STATUS[sel.status].color }}
          >
            {sel.status === "done" && <Check size={13} strokeWidth={3} color={C.bg} />}
          </span>
          <div>
            <div className="mono uppercase tracking-wider" style={{ fontSize: 10, color: C.faint }}>
              {sel.status === "done" ? "You got this" : "You'll know it's done when"}
            </div>
            <div className="text-sm mt-1" style={{ color: C.text }}>{copy.proof}</div>
          </div>
        </div>

        {(() => {
          const blocked = sel.items.flatMap((i) => (i.tickets || []).filter(isOpen).map((t) => ({ t, step: i.t })));
          if (!blocked.length) return null;
          const first = blocked[0];
          return (
            <div className="rounded-xl px-4 py-3 mt-3 flex items-start gap-2.5" style={{ background: C.pink + "12", border: "1px solid " + C.pink + "3D" }}>
              <AlertTriangle size={14} style={{ color: C.pink, flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="mono uppercase tracking-wider" style={{ fontSize: 10, color: C.pink }}>
                  {blocked.length === 1 ? "Blocked" : blocked.length + " steps blocked"}
                </div>
                <div className="text-sm mt-1" style={{ color: C.text }}>{first.t.text}</div>
                <div className="text-xs mt-0.5" style={{ color: C.faint }}>
                  on "{first.step}"{first.t.ref ? " · " + first.t.ref : ""}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          {target.intent === "contact" ? (
            <button
              onClick={() => setContacting((c) => !c)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium"
              style={{ background: C.brand, color: "#fff" }}
            >
              {target.label} <CalendarDays size={15} />
            </button>
          ) : (
            <button
              onClick={() => navigateHost(target)}
              title={target.hint}
              className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium"
              style={{ background: C.brand, color: "#fff" }}
            >
              {target.label}
              {target.intent === "open" ? <ArrowUpRight size={15} /> : <ArrowRight size={15} />}
            </button>
          )}
          <button
            onClick={() => setShowSteps((s) => !s)}
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: C.muted }}
          >
            {showSteps ? "Hide" : "Show"} the {sel.items.length} steps
            <span className="mono" style={{ fontSize: 11, color: C.faint }}>({stepsDone}/{sel.items.length} done)</span>
            {phaseBlocked > 0 && (
              <span className="mono rounded px-1.5" style={{ fontSize: 10, background: C.pink + "22", color: C.pink }}>
                {phaseBlocked} blocked
              </span>
            )}
            {phaseOverdue > 0 && (
              <span className="mono rounded px-1.5" style={{ fontSize: 10, background: C.pink + "22", color: C.pink }}>
                {phaseOverdue} late
              </span>
            )}
            <ChevronDown size={14} style={{ transform: showSteps ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
          </button>
        </div>

        {contacting && (
          <div className="rounded-xl p-4 mt-3 fade" style={{ background: C.panel2, border: "1px solid " + C.line }}>
            <div className="mono uppercase tracking-wider mb-2" style={{ fontSize: 10, color: C.faint }}>
              This phase is a conversation
            </div>
            <div className="text-sm" style={{ color: C.text }}>
              {rec.fde} is your implementation engineer for this.
            </div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>
              {target.hint} Reach out however you normally would, or raise it at your next session.
            </div>
          </div>
        )}

        {showSteps && (
          <div className="mt-4 space-y-1.5 fade">
            {sel.items.map((it, i) => (
              <React.Fragment key={it.k || i}>
                {it.group && it.group !== sel.items[i - 1]?.group && (
                  <div className="mono uppercase tracking-wider pt-2 pb-1" style={{ fontSize: 10, color: C.faint }}>
                    {it.group}
                  </div>
                )}
              <StepRow
                it={it}
                onCycle={cycle}
                onDue={(k, v) => onPatch((r) => ({ ...r, dueDates: { ...(r.dueDates || {}), [k]: v } }))}
                onOwner={(k, v) => onPatch((r) => ({ ...r, owners: { ...(r.owners || {}), [k]: v } }))}
                people={people}
                lock={locks.get(it.k)}
                onRename={(k, t) => onPatch((r) => ({ ...r, renames: { ...(r.renames || {}), [k]: t } }))}
                onRemove={(k) => onPatch((r) => ({ ...r, removedSteps: [...(r.removedSteps || []), k] }))}
                onTicket={(k, t) =>
                  onPatch((r) => ({ ...r, tickets: [...(r.tickets || []), coerceTicket({ ...t, stepKey: k })] }))
                }
                onTicketState={(id, state) =>
                  onPatch((r) => ({
                    ...r,
                    tickets: (r.tickets || []).map((x) =>
                      x.id === id
                        ? { ...x, state, resolvedAt: state === "resolved" ? new Date().toISOString().slice(0, 10) : "" }
                        : x
                    ),
                  }))
                }
              />
              </React.Fragment>
            ))}

            {adding === "step" ? (
              <AddForm kind="step" onCancel={() => setAdding(null)} onSave={addStep} />
            ) : (
              <button
                onClick={() => setAdding("step")}
                className="w-full rounded-lg px-3 py-2.5 flex items-center gap-2.5 text-sm"
                style={{ border: "1px dashed " + C.line, color: C.muted }}
              >
                <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: 18, height: 18, border: "1.5px dashed " + C.faint }}>
                  <Plus size={11} style={{ color: C.faint }} />
                </span>
                Add a step to {sel.label}
              </button>
            )}
          </div>
        )}
      </div>

      {/* What happens next */}
      {upcoming.length > 0 && (
        <div className="mt-4">
          <div className="mono uppercase tracking-widest mb-2" style={{ fontSize: 10, color: C.faint }}>What happens next</div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
            {upcoming.map((p, n) => {
              const c = copyFor(p, rec.contentPath);
              return (
                <button
                  key={p.id}
                  onClick={() => { setSelId(p.id); setShowSteps(false); }}
                  className="text-left rounded-xl p-4 hover-lift"
                  style={{ background: C.panel, border: "1px solid " + C.line }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full flex items-center justify-center mono font-bold shrink-0"
                      style={{ width: 20, height: 20, fontSize: 10, border: "1.5px solid " + STATUS[p.status].color, color: STATUS[p.status].color }}
                    >
                      {idx + n + 2}
                    </span>
                    <span className="text-sm font-medium truncate">{p.label}</span>
                    <span className="mono ml-auto shrink-0" style={{ fontSize: 10, color: C.faint }}>{p.week}</span>
                  </div>
                  <div className="text-xs mt-2 leading-relaxed" style={{ color: C.muted }}>{c.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Shown whenever pairs exist, not only for Marketplace engagements: knowing
          which locales have a reviewer is useful even when they are all internal. */}
      {(usesMarketplace(rec) || (rec.pairs || []).length > 0) && <Roster rec={rec} onPatch={onPatch} />}

      <AgentPanel rec={rec} risk={risk} />
    </>
  );
}
