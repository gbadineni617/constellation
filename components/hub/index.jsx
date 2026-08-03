"use client";

import React, { useState, useMemo } from "react";

import { Sparkles, Rocket, Clock, ArrowRight, ArrowLeft, Plus, Search, Copy, Check, Zap, Users, Upload, Target, CalendarDays, Plug } from "lucide-react";

import { C, STATUS, RISK, peopleOf } from "@/lib/theme";

import { buildJourney, progressOf, assess, PHASE_ORDER, CONTENT_PATHS } from "@/lib/journey";

import { Field, Avatar, Pill, MiniConstellation } from "@/components/shared";
import { Dropzone } from "./Dropzone";



export function JourneyCard({ rec, onOpen }) {
  const phases = useMemo(() => buildJourney(rec), [rec]);
  const { done, total, pct } = progressOf(phases);
  const risk = useMemo(() => assess(rec, phases), [rec, phases]);
  const r = RISK[risk.level];

  return (
    <button
      onClick={onOpen}
      className="text-left rounded-2xl p-5 w-full transition-transform hover-lift"
      style={{ background: C.panel, border: "1px solid " + C.line }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="disp text-base font-bold truncate">{rec.customer}</div>
          <div className="mono mt-1" style={{ fontSize: 11, color: C.faint }}>
            {rec.segment} · FDE {rec.fde}
          </div>
        </div>
        <span className="text-right shrink-0">
          <Pill tone={r.color}>{r.label}</Pill>
          {risk.daysLeft != null && risk.level !== "complete" && (
            <span className="mono block mt-1.5" style={{ fontSize: 10, color: risk.daysLeft <= 14 ? C.amber : C.faint }}>
              {risk.daysLeft} days to go-live
            </span>
          )}
        </span>
      </div>

      <div className="text-xs mt-3 leading-relaxed" style={{ color: C.muted }}>{rec.useCase}</div>

      {rec.inheritedFrom && (
        <div className="inline-flex items-center gap-1.5 mt-2.5">
          <Copy size={11} style={{ color: C.teal }} />
          <span style={{ fontSize: 11, color: C.teal }}>Started from {rec.inheritedFrom.customer}</span>
        </div>
      )}

      {risk.level === "at_risk" || risk.level === "overdue" ? (
        <div className="flex items-center gap-2 mt-3 rounded-lg px-2.5 py-2" style={{ background: C.amber + "14", border: "1px solid " + C.amber + "33" }}>
          <Zap size={12} style={{ color: C.amber, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: C.amber }}>
            {(risk.signals.find((s) => s.hot) || risk.signals[0]).t}
          </span>
        </div>
      ) : null}

      <div className="mt-4"><MiniConstellation phases={phases} /></div>

      <div className="flex items-center gap-3 mt-4">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}>
          <div className="h-full rounded-full" style={{ width: pct + "%", background: "linear-gradient(90deg," + C.teal + "," + C.violet + ")" }} />
        </div>
        <span className="mono shrink-0" style={{ fontSize: 11, color: C.violet }}>{pct}%</span>
      </div>

      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="flex items-center gap-1">
          {(rec.team || []).slice(0, 4).map((id) => <Avatar key={id} id={id} people={peopleOf(rec)} />)}
          {(rec.team || []).length > 4 && (
            <span className="mono" style={{ fontSize: 10, color: C.faint, marginLeft: 2 }}>+{(rec.team || []).length - 4}</span>
          )}
        </div>
        <span className="mono" style={{ fontSize: 11, color: C.faint }}>{done}/{total} · {rec.updated}</span>
      </div>
    </button>
  );
}

export function Intake({ form, setF, contentPath, setContentPath, maturity, setMaturity, delivery, setDelivery, onLoadExample, onExtracted, onProgressChange, onGenerate }) {
  const iStyle = { background: C.panel2, border: "1px solid " + C.line, color: C.text, outline: "none" };
  return (
    <div className="max-w-2xl fade">
      <Dropzone onExtracted={onExtracted} onUseExample={onLoadExample} onProgressChange={onProgressChange} />

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px" style={{ background: C.line }} />
        <span className="text-xs" style={{ color: C.faint }}>or fill it in</span>
        <div className="flex-1 h-px" style={{ background: C.line }} />
      </div>

      <div className="space-y-4">
        <Field label="Customer name">
          <input value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="e.g. Walmart Supplier Academy" className="w-full rounded-lg px-3 py-2 text-sm" style={iStyle} />
        </Field>

        <Field label="Primary use case & goals">
          <textarea value={form.useCase} onChange={(e) => setF("useCase", e.target.value)} rows={2} placeholder="What are they trying to achieve, and why now?" className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={iStyle} />
        </Field>

        <Field label="What's painful today">
          <textarea value={form.pain} onChange={(e) => setF("pain", e.target.value)} rows={2} placeholder="The manual step, the delay, the vendor cost — whatever they complained about on the call" className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={iStyle} />
        </Field>

        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Target go-live" icon={CalendarDays}>
            <input value={form.goLive} onChange={(e) => setF("goLive", e.target.value)} placeholder="e.g. early August" className="w-full rounded-lg px-3 py-2 text-sm" style={iStyle} />
          </Field>
          <Field label="Metrics for success" icon={Target}>
            <input value={form.metrics} onChange={(e) => setF("metrics", e.target.value)} placeholder="e.g. speed to market, quality" className="w-full rounded-lg px-3 py-2 text-sm" style={iStyle} />
          </Field>
        </div>

        <Field label="Primary content type">
          <div className="flex flex-wrap gap-2">
            {Object.keys(CONTENT_PATHS).map((r) => (
              <button
                key={r}
                onClick={() => setContentPath(r)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{
                  background: contentPath === r ? C.brand : C.panel2,
                  color: contentPath === r ? "#fff" : C.muted,
                  border: "1px solid " + (contentPath === r ? C.brand : C.line),
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>

        <Field label="How does content reach Smartcat?" icon={Plug}>
          <div className="flex flex-wrap gap-2">
            {[["manual", "Manual upload"], ["connected", "Through a connector"]].map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setDelivery(k)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{ background: delivery === k ? C.pink : C.panel2, color: delivery === k ? C.bg : C.muted, border: "1px solid " + (delivery === k ? C.pink : C.line) }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Do they already have TMs / glossaries?">
          <div className="flex flex-wrap gap-2">
            {[["greenfield", "New to localization"], ["mature", "Has assets from a prior vendor"]].map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setMaturity(k)}
                className="px-3 py-1.5 rounded-lg text-sm"
                style={{
                  background: maturity === k ? C.teal : C.panel2,
                  color: maturity === k ? C.bg : C.muted,
                  border: "1px solid " + (maturity === k ? C.teal : C.line),
                }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Who's on the team" icon={Users}>
          <input value={form.team} onChange={(e) => setF("team", e.target.value)} placeholder="Names & roles, comma-separated" className="w-full rounded-lg px-3 py-2 text-sm" style={iStyle} />
          {form.team.trim() && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.team.split(",").map((t) => t.trim()).filter(Boolean).map((t, i) => (
                <span key={i} className="text-xs rounded-full px-2.5 py-1" style={{ background: C.panel2, color: C.text }}>{t}</span>
              ))}
            </div>
          )}
        </Field>

        <Field label="Integrations in scope">
          <input value={form.integrations} onChange={(e) => setF("integrations", e.target.value)} placeholder="e.g. Airtable, Sitecore, WordPress…" className="w-full rounded-lg px-3 py-2 text-sm" style={iStyle} />
        </Field>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button onClick={onGenerate} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ background: C.brand, color: "#fff" }}>
          <Rocket size={16} /> Generate the journey
        </button>
        <span className="text-xs" style={{ color: C.faint }}>You can edit anything after — the FDE stays in control.</span>
      </div>
    </div>
  );
}

export function Building({ name }) {
  const lines = [
    "Reading goals & success metrics",
    "Matching content type & linguistic assets",
    "Laying out sessions and sign-off gates",
    "Setting workspace-health targets",
  ];
  return (
    <div className="max-w-md mx-auto py-20 text-center fade">
      <div className="mx-auto mb-6 rounded-2xl flex items-center justify-center pulse" style={{ width: 56, height: 56, background: C.brand + "22", border: "1px solid " + C.brand + "55" }}>
        <Sparkles size={26} style={{ color: C.violet }} />
      </div>
      <h2 className="disp text-xl font-bold mb-1">Assembling {name}'s constellation</h2>
      <p className="text-sm mb-6" style={{ color: C.muted }}>Reading your inputs and laying out the path…</p>
      <div className="space-y-2.5 text-sm text-left mx-auto" style={{ maxWidth: 340 }}>
        {lines.map((t, i) => (
          <div key={i} className="flex items-center gap-2 build-row" style={{ animationDelay: i * 0.34 + "s", color: C.text }}>
            <Check size={15} style={{ color: C.teal }} /> {t}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Replicate({ parent, records, onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [useCase, setUseCase] = useState("");
  const [goLive, setGoLive] = useState("");
  const [contentPath, setContentPath] = useState(parent.contentPath);
  const carries = (parent.inheritedFrom && parent.inheritedFrom.carries) || [
    "Workspace & project templates", "AI translation profile",
    parent.maturity === "mature" ? "TMX + termbase" : "Translation memory built so far",
    "Reviewer roster", "Locale set",
  ];
  const siblings = records.filter((r) => r.org === parent.org).length;
  const iStyle = { background: C.panel2, border: "1px solid " + C.line, color: C.text, outline: "none" };

  return (
    <div className="fade">
      <button onClick={onCancel} className="inline-flex items-center gap-1.5 text-sm mb-4" style={{ color: C.muted }}>
        <ArrowLeft size={15} /> Back to {parent.customer}
      </button>

      <div className="flex items-center gap-2 mb-1" style={{ color: C.violet }}>
        <Copy size={15} />
        <span className="mono tracking-widest uppercase" style={{ fontSize: 11 }}>Replicate</span>
      </div>
      <h1 className="disp text-2xl font-bold">Onboard another team at {parent.org}</h1>
      <p className="text-sm mt-1 mb-6" style={{ color: C.muted }}>
        {parent.org} already has {siblings === 1 ? "a journey" : siblings + " journeys"} here. The new team starts from that
        work instead of from nothing.
      </p>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", alignItems: "start" }}>
        <div className="space-y-4">
          <Field label="New team or business unit">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Walmart Canada Marketing" className="w-full rounded-lg px-3 py-2 text-sm" style={iStyle} />
          </Field>
          <Field label="What's different about their content">
            <textarea value={useCase} onChange={(e) => setUseCase(e.target.value)} rows={2} placeholder="Only what changes — the rest carries over" className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={iStyle} />
          </Field>
          <Field label="Target go-live" icon={CalendarDays}>
            <input value={goLive} onChange={(e) => setGoLive(e.target.value)} placeholder="e.g. October 2026" className="w-full rounded-lg px-3 py-2 text-sm" style={iStyle} />
          </Field>
          <Field label="Primary content type">
            <div className="flex flex-wrap gap-2">
              {Object.keys(CONTENT_PATHS).map((r) => (
                <button key={r} onClick={() => setContentPath(r)} className="px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: contentPath === r ? C.brand : C.panel2, color: contentPath === r ? "#fff" : C.muted, border: "1px solid " + (contentPath === r ? C.brand : C.line) }}>
                  {r}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="rounded-2xl p-5" style={{ background: "linear-gradient(150deg," + C.teal + "1A," + C.panel + " 60%)", border: "1px solid " + C.teal + "44" }}>
          <div className="mono uppercase tracking-widest" style={{ fontSize: 10, color: C.teal }}>Carries over</div>
          <div className="text-sm mt-2" style={{ color: C.muted }}>
            From <span style={{ color: C.text }}>{parent.customer}</span> — nobody redoes this.
          </div>
          <div className="mt-4 space-y-2">
            {carries.map((c) => (
              <div key={c} className="flex items-center gap-2.5">
                <Check size={14} strokeWidth={3} style={{ color: C.teal, flexShrink: 0 }} />
                <span className="text-sm">{c}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4" style={{ borderTop: "1px solid " + C.line }}>
            <div className="mono uppercase tracking-widest mb-2" style={{ fontSize: 10, color: C.faint }}>Still theirs to do</div>
            {["Their own content through UAT", "Their reviewers signing off", "Their go-live gate"].map((c) => (
              <div key={c} className="flex items-center gap-2.5 mb-1.5">
                <span className="rounded-full shrink-0" style={{ width: 13, height: 13, border: "1.5px solid " + C.faint }} />
                <span className="text-sm" style={{ color: C.muted }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={() => onCreate({ name, useCase, goLive, contentPath, carries })}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
          style={{ background: C.brand, color: "#fff" }}
        >
          <Rocket size={16} /> Create their journey
        </button>
        <span className="text-xs" style={{ color: C.faint }}>They'll start with the setup phase already complete.</span>
      </div>
    </div>
  );
}

export function ChooseScreen({ records, onNew, onPast }) {
  const assessed = records.map((r) => ({ rec: r, risk: assess(r, buildJourney(r)) }));
  const live = assessed.filter((a) => a.risk.level === "complete").length;
  const needy = assessed.filter((a) => a.risk.level === "at_risk" || a.risk.level === "overdue").length;
  const recent = assessed.slice(0, 3);

  return (
    <div className="fade">
      <div className="flex items-center gap-2 mb-1" style={{ color: C.violet }}>
        <Sparkles size={15} />
        <span className="mono tracking-widest uppercase" style={{ fontSize: 11 }}>Constellation</span>
      </div>
      <h1 className="disp text-2xl font-bold">Onboarding journeys</h1>
      <p className="text-sm mt-1" style={{ color: C.muted }}>
        Every customer gets a path made of phases, sessions, and sign-off gates. Pick up where you left off, or map someone new.
      </p>

      <div className="grid gap-4 mt-7" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
        {/* ── Start a new journey ── */}
        <button
          onClick={onNew}
          className="text-left rounded-2xl p-6 hover-lift flex flex-col"
          style={{
            background: "linear-gradient(150deg," + C.brand + "26," + C.panel + " 62%)",
            border: "1px solid " + C.brand + "55",
            minHeight: 268,
          }}
        >
          <span
            className="rounded-xl flex items-center justify-center"
            style={{ width: 42, height: 42, background: C.brand + "2E", border: "1px solid " + C.brand + "55" }}
          >
            <Rocket size={20} style={{ color: C.violet }} />
          </span>

          <h2 className="disp text-lg font-bold mt-4">Start a new journey</h2>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: C.muted }}>
            Answer a short intake — goals, content, team, what hurts today — and Constellation maps the phases,
            sessions, and sign-off gates for you.
          </p>

          {/* An unlit path, waiting to be drawn */}
          <div className="mt-auto pt-6">
            <div className="mono uppercase tracking-widest mb-2.5" style={{ fontSize: 9, color: C.faint }}>
              Nothing lit yet
            </div>
            <div className="flex items-center">
              {PHASE_ORDER.map((p, i) => (
                <React.Fragment key={p}>
                  {i > 0 && <span style={{ width: 14, height: 1.5, background: C.line }} />}
                  <span
                    className="rounded-full shrink-0"
                    style={{ width: 6, height: 6, border: "1.5px solid " + C.faint }}
                  />
                </React.Fragment>
              ))}
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold mt-5" style={{ color: C.violet }}>
              Begin intake <ArrowRight size={15} />
            </span>
          </div>
        </button>

        {/* ── Past journeys ── */}
        <button
          onClick={onPast}
          className="text-left rounded-2xl p-6 hover-lift flex flex-col"
          style={{ background: C.panel, border: "1px solid " + C.line, minHeight: 268 }}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="rounded-xl flex items-center justify-center"
              style={{ width: 42, height: 42, background: C.panel2, border: "1px solid " + C.line }}
            >
              <Clock size={20} style={{ color: C.teal }} />
            </span>
            <span className="text-right">
              <span className="disp text-2xl font-bold block leading-none">{records.length}</span>
              <span className="mono" style={{ fontSize: 10, color: needy ? C.amber : C.faint }}>
                {needy ? needy + " need attention" : live + " live"}
              </span>
            </span>
          </div>

          <h2 className="disp text-lg font-bold mt-4">Past journeys</h2>
          <p className="text-sm mt-1.5 leading-relaxed" style={{ color: C.muted }}>
            Open any customer you've mapped — their phases, health metrics, and what's blocking the next gate.
          </p>

          <div className="mt-auto pt-6 space-y-2.5">
            {recent.map(({ rec: r, risk }) => {
              const ph = buildJourney(r);
              const hot = risk.level === "at_risk" || risk.level === "overdue";
              return (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="rounded-full shrink-0" style={{ width: 5, height: 5, background: hot ? C.amber : "transparent" }} />
                  <span className="text-xs truncate" style={{ color: C.text, width: 112 }}>{r.customer}</span>
                  <MiniConstellation phases={ph} />
                  <span className="mono ml-auto" style={{ fontSize: 11, color: hot ? C.amber : risk.pct === 100 ? C.teal : C.violet }}>{risk.pct}%</span>
                </div>
              );
            })}
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: C.teal, paddingTop: 8 }}>
              View all <ArrowRight size={15} />
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}

export function PastJourneys({ records, onOpen, onBack, onNew }) {
  const [q, setQ] = useState("");
  const rank = { overdue: 0, at_risk: 1, on_track: 2, complete: 3 };
  const shown = records
    .filter((r) => r.customer.toLowerCase().includes(q.trim().toLowerCase()))
    .slice()
    .sort((a, b) => rank[assess(a, buildJourney(a)).level] - rank[assess(b, buildJourney(b)).level]);

  return (
    <div className="fade">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm mb-4" style={{ color: C.muted }}>
        <ArrowLeft size={15} /> Constellation
      </button>

      <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="disp text-2xl font-bold">Past journeys</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Everything you've mapped, most at risk first.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: C.panel, border: "1px solid " + C.line }}>
            <Search size={14} style={{ color: C.faint }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search journeys"
              className="text-sm bg-transparent"
              style={{ outline: "none", color: C.text, width: 148 }}
            />
          </div>
          <button onClick={onNew} className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium" style={{ background: C.brand, color: "#fff" }}>
            <Plus size={15} /> New journey
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl px-6 py-12 text-center" style={{ background: C.panel, border: "1px dashed " + C.line }}>
          <div className="text-sm" style={{ color: C.text }}>No journey matches "{q}".</div>
          <div className="text-xs mt-1" style={{ color: C.faint }}>Clear the search, or map this customer as a new journey.</div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(shown.reduce((acc, r) => {
            const k = r.org || r.customer;
            (acc[k] = acc[k] || []).push(r);
            return acc;
          }, {})).map(([org, list]) => (
            <div key={org}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="disp text-sm font-bold">{org}</span>
                {list.length > 1 && (
                  <span className="mono rounded-full px-2 py-0.5" style={{ fontSize: 10, background: C.teal + "1F", color: C.teal }}>
                    {list.length} teams
                  </span>
                )}
                <div className="flex-1 h-px" style={{ background: C.line }} />
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
                {list.map((r) => <JourneyCard key={r.id} rec={r} onOpen={() => onOpen(r.id)} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
