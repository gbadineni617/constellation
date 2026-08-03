"use client";

import React, { useState } from "react";
import { X, AlertTriangle, GitBranch, StickyNote, Check, Undo2, Hash } from "lucide-react";
import { C } from "@/lib/theme";
import { MARKER_KINDS, MARKER_KIND_IDS, markersAfter, markerAge, isOpenIssue } from "@/lib/markers";
import { Avatar } from "@/components/shared";

const ICON = { issue: AlertTriangle, decision: GitBranch, note: StickyNote };
// Hue comes from the kind and nothing else. Urgency is shown in the age text.
const TONE = Object.fromEntries(Object.entries(MARKER_KINDS).map(([k, v]) => [k, v.color]));
const TODAY = new Date("2026-07-26T00:00:00Z");

/**
 * What happened between two phases. Not a step, not a phase — the gap itself.
 * Two weeks lost to procurement, a locale dropped from wave one, a contact
 * changing. All of it currently lives in someone's memory.
 */
export function GapPanel({ rec, phaseId, beforeLabel, afterLabel, onClose, onAdd, onToggle, people }) {
  const [kind, setKind] = useState("issue");
  const [text, setText] = useState("");
  const [ref, setRef] = useState("");

  const marks = markersAfter(rec, phaseId);

  return (
    <div className="rounded-2xl p-5 mt-3 fade" style={{ background: C.panel, border: "1px solid " + C.violet + "55" }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="mono uppercase tracking-widest" style={{ fontSize: 10, color: C.faint }}>
            Between phases
          </div>
          <h3 className="disp text-base font-bold mt-1">
            {beforeLabel} <span style={{ color: C.faint, fontWeight: 400 }}>→</span> {afterLabel}
          </h3>
        </div>
        <button onClick={onClose} style={{ color: C.faint }}><X size={16} /></button>
      </div>

      {marks.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {marks.map((m) => {
            const Ic = ICON[m.kind];
            const live = isOpenIssue(m);
            const age = markerAge(m, TODAY);
            const resolved = m.kind === "issue" && m.state === "resolved";
            const tone = resolved ? C.faint : TONE[m.kind];
            return (
              <div key={m.id} className="rounded-lg px-3 py-2.5 flex items-start gap-2.5" style={{ background: C.panel2, borderLeft: "2px solid " + tone }}>
                <Ic size={13} style={{ color: tone, marginTop: 2, flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm" style={{ color: m.state === "resolved" ? C.faint : C.text, textDecoration: m.state === "resolved" ? "line-through" : "none" }}>
                    {m.text}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="mono rounded px-1" style={{ fontSize: 9, background: tone + "22", color: tone }}>
                      {MARKER_KINDS[m.kind].label}
                    </span>
                    {m.ref && (
                      <span className="mono inline-flex items-center gap-0.5" style={{ fontSize: 10, color: C.violet }}>
                        <Hash size={9} />{m.ref}
                      </span>
                    )}
                    <span className="mono" style={{ fontSize: 10, color: C.faint }}>{m.at}</span>
                    {live && age && (
                      <span
                        className="mono rounded px-1"
                        style={{
                          fontSize: 10,
                          color: age.stale ? C.pink : C.faint,
                          background: age.stale ? C.pink + "1A" : "transparent",
                          fontWeight: age.stale ? 700 : 400,
                        }}
                      >
                        {age.days}d open{age.stale ? " · stale" : ""}
                      </span>
                    )}
                    {m.owner && <Avatar id={m.owner} size={16} people={people} />}
                  </div>
                </div>
                {MARKER_KINDS[m.kind].stateful && (
                  <button
                    onClick={() => onToggle(m.id, live ? "resolved" : "open")}
                    title={live ? "Mark resolved" : "Reopen"}
                    className="shrink-0 rounded p-1"
                    style={{ color: C.faint }}
                  >
                    {live ? <Check size={12} strokeWidth={3} /> : <Undo2 size={12} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 pt-4" style={{ borderTop: "1px solid " + C.line }}>
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {MARKER_KIND_IDS.map((k) => {
            const Ic = ICON[k];
            const on = kind === k;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
                style={{
                  fontSize: 12,
                  background: on ? TONE[k] + "22" : "transparent",
                  border: "1px solid " + (on ? TONE[k] + "77" : C.line),
                  color: on ? C.text : C.muted,
                }}
              >
                <Ic size={12} style={{ color: on ? TONE[k] : C.faint }} />
                {MARKER_KINDS[k].label}
              </button>
            );
          })}
        </div>

        <div className="text-xs mb-2" style={{ color: C.faint }}>{MARKER_KINDS[kind].blurb}</div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder={
            kind === "issue" ? "e.g. Two weeks lost waiting on the procurement signature"
            : kind === "decision" ? "e.g. Agreed to drop es-CL from the first wave"
            : "e.g. Kat is on leave the first week of August"
          }
          className="w-full rounded-lg px-3 py-2 text-sm resize-none"
          style={{ background: C.panel2, border: "1px solid " + C.line, color: C.text, outline: "none" }}
        />
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Reference, optional"
          className="w-full rounded-lg px-3 py-2 text-sm mt-1.5"
          style={{ background: C.panel2, border: "1px solid " + C.line, color: C.text, outline: "none" }}
        />

        <button
          onClick={() => {
            if (!text.trim()) return;
            onAdd({ after: phaseId, kind, text: text.trim(), ref: ref.trim() });
            setText(""); setRef("");
          }}
          className="rounded-lg px-3.5 py-2 text-sm font-medium mt-2.5"
          style={{ background: text.trim() ? C.brand : C.panel2, color: text.trim() ? "#fff" : C.faint }}
        >
          {MARKER_KINDS[kind].verb}
        </button>
      </div>
    </div>
  );
}
