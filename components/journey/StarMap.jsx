"use client";

import React from "react";

import { Check, Plus, AlertTriangle, GitBranch, StickyNote } from "lucide-react";

import { C, STATUS, STARS, SKY, NODE_GAP } from "@/lib/theme";
import { markersAfter, isOpenIssue, MARKER_KINDS, MARKER_KIND_IDS, dominantKind } from "@/lib/markers";
import { isOpen as isOpenTicket } from "@/lib/tickets";



export function StarMap({ journey, selId, onSelect, onAddPhase, rec, gapId, onSelectGap }) {
  const W = (journey.length + 1) * NODE_GAP;
  const midY = 96;
  const pos = journey.map((p, i) => ({ x: NODE_GAP / 2 + i * NODE_GAP, y: midY + (SKY[i % SKY.length] || 0) }));

  return (
    <div className="relative rounded-2xl mt-3" style={{ background: "radial-gradient(120% 90% at 20% 0%, " + C.violet + "16, transparent 62%)" }}>
      <div className="overflow-x-auto">
        <div className="relative" style={{ width: W, height: 218 }}>
          {/* ambient sky */}
          <svg width={W} height={218} className="absolute inset-0" style={{ pointerEvents: "none" }}>
            {STARS.map(([sx, sy], i) => (
              <circle key={i} cx={(sx / 100) * W} cy={(sy / 100) * 218} r={i % 3 === 0 ? 1.4 : 0.9} fill={C.text} opacity={0.18} />
            ))}
            {pos.map((p, i) => {
              if (i === 0) return null;
              const a = pos[i - 1], b = p;
              const prev = journey[i - 1].status, cur = journey[i].status;
              const dead = cur === "open" && prev !== "done";
              return (
                <line
                  key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={dead ? C.line : STATUS[prev].color}
                  strokeWidth={dead ? 1.25 : 1.75}
                  strokeDasharray={dead ? "3 4" : "none"}
                  opacity={dead ? 0.85 : 0.55}
                />
              );
            })}
            {pos.length > 0 && (
              <line
                x1={pos[pos.length - 1].x} y1={pos[pos.length - 1].y}
                x2={NODE_GAP / 2 + journey.length * NODE_GAP} y2={midY}
                stroke={C.line} strokeWidth={1.25} strokeDasharray="3 4" opacity={0.7}
              />
            )}
          </svg>

          {/* The gaps between phases. Plenty of what matters in an onboarding
              happens here and belongs to no step. */}
          {journey.slice(0, -1).map((p, i) => {
            const a = pos[i], b = pos[i + 1];
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const marks = markersAfter(rec, p.id);
            const openIssues = marks.filter(isOpenIssue).length;
            const active = gapId === p.id;

            const dom = dominantKind(marks);
            const tone = dom ? MARKER_KINDS[dom].color : C.faint;
            const size = marks.length ? 18 : 14;

            return (
              <button
                key={"gap-" + p.id}
                onClick={() => onSelectGap(active ? null : p.id)}
                title={marks.length ? marks.length + " recorded between " + p.label + " and " + journey[i + 1].label : "Record something between " + p.label + " and " + journey[i + 1].label}
                className="absolute rounded-full flex items-center justify-center gap-node"
                style={{
                  left: mx - size / 2,
                  top: my - size / 2,
                  width: size,
                  height: size,
                  background: marks.length ? tone + "26" : "transparent",
                  border: (marks.length ? "1.5px solid " : "1.5px dashed ") + tone,
                  color: tone,
                  opacity: marks.length ? 1 : 0.45,
                  transform: active ? "scale(1.3)" : "scale(1)",
                  zIndex: 3,
                }}
              >
                {openIssues ? (
                  <AlertTriangle size={9} />
                ) : dom === "decision" ? (
                  <GitBranch size={9} />
                ) : marks.length ? (
                  <StickyNote size={9} />
                ) : (
                  <Plus size={9} />
                )}
              </button>
            );
          })}

          {journey.map((p, i) => {
            const st = STATUS[p.status];
            const lit = p.status === "done";
            const isSel = p.id === selId;
            const { x, y } = pos[i];
            return (
              <div key={p.id} className="absolute" style={{ left: x - 56, top: y - 18, width: 112 }}>
                <div className="flex flex-col items-center relative">
                  <button
                    onClick={() => onSelect(p.id)}
                    className={"rounded-full flex items-center justify-center transition-transform " + (p.status === "active" ? "pulse " : "") + (lit ? "lit" : "")}
                    style={{
                      width: lit ? 34 : 30, height: lit ? 34 : 30,
                      background: lit ? st.color : C.panel,
                      border: "2px solid " + st.color,
                      color: lit ? C.bg : st.color,
                      transform: isSel ? "scale(1.18)" : "scale(1)",
                    }}
                  >
                    {lit ? <Check size={16} strokeWidth={3} /> : <span className="mono text-xs font-bold">{i + 1}</span>}
                  </button>

                  {/* A blocker inside this phase, visible without expanding anything */}
                  {(p.items || []).some((it) => (it.tickets || []).some(isOpenTicket)) && (
                    <span
                      title="A step in this phase is blocked"
                      className="absolute rounded-full"
                      style={{
                        width: 9, height: 9, background: C.pink,
                        border: "1.5px solid " + C.bg,
                        marginLeft: lit ? 26 : 22, marginTop: -4,
                      }}
                    />
                  )}
                  <div
                    className="text-center text-xs mt-2 leading-tight px-1"
                    style={{ color: isSel ? C.text : C.muted, fontWeight: isSel ? 600 : 400 }}
                  >
                    {p.label}
                  </div>
                  <div className="mono mt-0.5" style={{ fontSize: 10, color: C.faint }}>{p.week}</div>
                </div>
              </div>
            );
          })}

          {/* Add a phase */}
          <div className="absolute" style={{ left: NODE_GAP / 2 + journey.length * NODE_GAP - 56, top: midY - 18, width: 112 }}>
            <div className="flex flex-col items-center">
              <button
                onClick={onAddPhase}
                title="Add a phase"
                className="rounded-full flex items-center justify-center add-node"
                style={{ width: 30, height: 30, background: "transparent", border: "1.5px dashed " + C.faint, color: C.faint }}
              >
                <Plus size={15} />
              </button>
              <div className="text-center text-xs mt-2 leading-tight px-1" style={{ color: C.faint }}>Add a phase</div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend — colour plus icon, so it reads in greyscale too */}
      <div className="flex items-center gap-4 px-4 pb-3 flex-wrap">
        {MARKER_KIND_IDS.map((k) => {
          const Ic = { issue: AlertTriangle, decision: GitBranch, note: StickyNote }[k];
          return (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span
                className="rounded-full flex items-center justify-center"
                style={{ width: 14, height: 14, background: MARKER_KINDS[k].color + "26", border: "1px solid " + MARKER_KINDS[k].color }}
              >
                <Ic size={8} style={{ color: MARKER_KINDS[k].color }} />
              </span>
              <span style={{ fontSize: 11, color: C.muted }}>{MARKER_KINDS[k].label}</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1.5">
          <span className="rounded-full" style={{ width: 8, height: 8, background: C.pink }} />
          <span style={{ fontSize: 11, color: C.muted }}>Step blocked</span>
        </span>
      </div>
    </div>
  );
}
