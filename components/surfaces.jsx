"use client";

import React from "react";

import { Plus, Upload, Download, FileText, Star, MoreHorizontal, TrendingUp, Globe, Clock, Target } from "lucide-react";

import { C, PEOPLE } from "@/lib/theme";

import { buildJourney, progressOf } from "@/lib/journey";

import { Avatar, SurfaceHead, Row } from "./shared";



export function ProjectsSurface() {
  const rows = [
    ["Grow with Walmart Canada — Module 3", "fr-CA", "In translation", "Jul 24", C.amber],
    ["Supplier Academy — Onboarding 101", "es-MX", "In review", "Jul 23", C.violet],
    ["HID Q3 Product Sheets", "de-DE +3", "Complete", "Jul 21", C.teal],
    ["EU Storefront — Netherlands", "nl-NL", "Complete", "Jul 19", C.teal],
    ["Recruiter Templates — Poland", "pl-PL", "Draft", "Jul 18", C.faint],
  ];
  return (
    <>
      <SurfaceHead
        title="Projects"
        sub="Everything in flight across your workspaces."
        action={
          <button className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium" style={{ background: C.brand, color: "#fff" }}>
            <Plus size={15} /> New project
          </button>
        }
      />
      <div className="rounded-2xl overflow-hidden" style={{ background: C.panel, border: "1px solid " + C.line }}>
        <Row head><span>Project</span><span>Target</span><span>Status</span><span>Updated</span><span /></Row>
        {rows.map(([n, l, s, u, col]) => (
          <Row key={n}>
            <span className="truncate">{n}</span>
            <span className="mono" style={{ color: C.muted, fontSize: 12 }}>{l}</span>
            <span style={{ color: col }}>{s}</span>
            <span style={{ color: C.faint, fontSize: 12 }}>{u}</span>
            <MoreHorizontal size={15} style={{ color: C.faint, marginLeft: "auto" }} />
          </Row>
        ))}
      </div>
    </>
  );
}

export function TranslationsSurface() {
  const files = [
    ["module-03-fr-CA.scorm", "SCORM 1.2", "4,210 words", 82],
    ["onboarding-101.storyline", "Storyline", "6,840 words", 55],
    ["hid-product-sheet.docx", "Word", "1,190 words", 100],
    ["storefront-nl.json", "JSON", "980 strings", 100],
  ];
  return (
    <>
      <SurfaceHead
        title="Translations"
        sub="Files moving through AI translation, review, and export."
        action={
          <button className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium" style={{ background: C.panel2, color: C.text, border: "1px solid " + C.line }}>
            <Upload size={15} /> Upload files
          </button>
        }
      />
      <div className="space-y-2">
        {files.map(([n, t, w, p]) => (
          <div key={n} className="rounded-xl px-4 py-3 flex items-center gap-4" style={{ background: C.panel, border: "1px solid " + C.line }}>
            <FileText size={17} style={{ color: C.violet }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{n}</div>
              <div className="mono" style={{ fontSize: 11, color: C.faint }}>{t} · {w}</div>
            </div>
            <div style={{ width: 120 }}>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.line }}>
                <div className="h-full rounded-full" style={{ width: p + "%", background: p === 100 ? C.teal : C.violet }} />
              </div>
            </div>
            <span className="mono" style={{ fontSize: 12, color: p === 100 ? C.teal : C.muted, width: 38, textAlign: "right" }}>{p}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function MarketplaceSurface() {
  const cards = [
    ["fr-CA legal review", "Certified reviewers, Quebec compliance", 4.9, "12 available"],
    ["es-MX subject-matter review", "Retail & supply-chain specialists", 4.8, "31 available"],
    ["ja-JP technical linguists", "Life sciences & instrumentation", 4.9, "8 available"],
    ["AI dubbing — 11 locales", "Voice cloning with timing control", 4.7, "Instant"],
  ];
  return (
    <>
      <SurfaceHead title="Marketplace" sub="Vetted linguists and services you can add to any workflow." />
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
        {cards.map(([t, d, r, a]) => (
          <div key={t} className="rounded-2xl p-4" style={{ background: C.panel, border: "1px solid " + C.line }}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium">{t}</div>
              <span className="inline-flex items-center gap-1 mono shrink-0" style={{ fontSize: 11, color: C.amber }}>
                <Star size={11} fill={C.amber} /> {r}
              </span>
            </div>
            <div className="text-xs mt-1.5" style={{ color: C.muted }}>{d}</div>
            <div className="mono mt-3" style={{ fontSize: 11, color: C.faint }}>{a}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function TeamSurface() {
  const members = [
    ["kat", "Workspace admin", "Active today"],
    ["phil", "Content / ID", "Active today"],
    ["ryan", "Reviewer — fr-CA", "2 days ago"],
    ["paul", "Forward-deployed engineer", "Active today"],
    ["james", "Account manager", "Yesterday"],
    ["jackie", "Customer success", "Active today"],
  ];
  return (
    <>
      <SurfaceHead
        title="Team"
        sub="Who has access, and what they can do."
        action={
          <button className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium" style={{ background: C.brand, color: "#fff" }}>
            <Plus size={15} /> Invite people
          </button>
        }
      />
      <div className="rounded-2xl overflow-hidden" style={{ background: C.panel, border: "1px solid " + C.line }}>
        {members.map(([id, role, seen], i) => (
          <div key={id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i === members.length - 1 ? "none" : "1px solid " + C.line }}>
            <Avatar id={id} size={28} />
            <div className="flex-1 min-w-0">
              <div className="text-sm">{PEOPLE[id].name}</div>
              <div style={{ fontSize: 12, color: C.faint }}>{role}</div>
            </div>
            <span className="mono" style={{ fontSize: 11, color: C.muted }}>{seen}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function ReportingSurface({ records }) {
  const stats = [
    ["Words translated", "1.84M", "+12% vs. last month", TrendingUp],
    ["Active locales", "24", "across 5 accounts", Globe],
    ["Avg. turnaround", "2.1 days", "down from 9 days", Clock],
    ["On-time delivery", "96%", "target 90%", Target],
  ];
  const bars = [
    ["fr-CA", 88], ["es-MX", 74], ["de-DE", 61], ["nl-NL", 52],
    ["ja-JP", 44], ["pl-PL", 31], ["zh-CN", 22],
  ];
  return (
    <>
      <SurfaceHead
        title="Reporting"
        sub="Enterprise Reports — the same numbers that gate go-live."
        action={
          <button className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium" style={{ background: C.panel2, color: C.text, border: "1px solid " + C.line }}>
            <Download size={15} /> Export
          </button>
        }
      />
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))" }}>
        {stats.map(([k, v, sub, Ic]) => (
          <div key={k} className="rounded-2xl p-4" style={{ background: C.panel, border: "1px solid " + C.line }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: C.faint }}>
              <Ic size={14} /><span style={{ fontSize: 12 }}>{k}</span>
            </div>
            <div className="disp text-2xl font-bold">{v}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <div className="rounded-2xl p-5" style={{ background: C.panel, border: "1px solid " + C.line }}>
          <h3 className="disp text-sm font-bold mb-4">Volume by target locale</h3>
          <div className="space-y-2.5">
            {bars.map(([l, v]) => (
              <div key={l} className="flex items-center gap-3">
                <span className="mono" style={{ fontSize: 11, color: C.muted, width: 46 }}>{l}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: C.line }}>
                  <div className="h-full rounded-full" style={{ width: v + "%", background: "linear-gradient(90deg," + C.brand + "," + C.violet + ")" }} />
                </div>
                <span className="mono" style={{ fontSize: 11, color: C.faint, width: 26, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ background: C.panel, border: "1px solid " + C.line }}>
          <h3 className="disp text-sm font-bold mb-1">Onboarding pipeline</h3>
          <div className="text-xs mb-4" style={{ color: C.muted }}>Live from Constellation.</div>
          <div className="space-y-3">
            {records.map((r) => {
              const { pct } = progressOf(buildJourney(r));
              return (
                <div key={r.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs truncate">{r.customer}</span>
                    <span className="mono shrink-0" style={{ fontSize: 11, color: pct === 100 ? C.teal : C.violet }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: C.line }}>
                    <div className="h-full rounded-full" style={{ width: pct + "%", background: pct === 100 ? C.teal : C.violet }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────
   Constellation — hub with two tabs
   ──────────────────────────────────────────────────────────── */
