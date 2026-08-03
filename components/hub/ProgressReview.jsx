"use client";

import React, { useState } from "react";
import { Check, AlertTriangle, Quote } from "lucide-react";
import { C } from "@/lib/theme";

/**
 * Confirming what is already done.
 *
 * A customer mid-rollout should not get a journey that starts at zero. But a
 * wrongly-completed step tells them they signed off on something they did not,
 * which is worse than starting from nothing. So the model proposes, and an FDE
 * confirms, with the quoted evidence beside each claim.
 *
 * Claims without evidence start unticked. That asymmetry is the whole point.
 */
export function ProgressReview({ claims, unevidenced, onChange }) {
  const [accepted, setAccepted] = useState(() =>
    new Set(claims.filter((c) => c.evidence).map((c) => c.k))
  );

  if (!claims?.length) return null;

  const emit = (next) => {
    setAccepted(next);
    onChange(claims.filter((c) => next.has(c.k)));
  };

  const toggle = (k) => {
    const next = new Set(accepted);
    next.has(k) ? next.delete(k) : next.add(k);
    emit(next);
  };

  const byPhase = claims.reduce((acc, c) => {
    (acc[c.phase] = acc[c.phase] || []).push(c);
    return acc;
  }, {});

  return (
    <div className="rounded-xl p-4 mt-2 fade" style={{ background: C.panel, border: "1px solid " + C.teal + "44" }}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <div className="mono uppercase tracking-widest" style={{ fontSize: 10, color: C.teal }}>
          Already done
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => emit(new Set(claims.map((c) => c.k)))}
            style={{ fontSize: 11, color: C.muted }}
          >
            Accept all
          </button>
          <span style={{ color: C.line }}>·</span>
          <button onClick={() => emit(new Set())} style={{ fontSize: 11, color: C.muted }}>
            Start from zero
          </button>
        </div>
      </div>

      <div className="text-xs mb-3" style={{ color: C.muted }}>
        This customer looks partway through. {accepted.size} of {claims.length} accepted — untick anything that
        is not actually finished.
        {unevidenced > 0 && (
          <span style={{ color: C.amber }}>
            {" "}{unevidenced} {unevidenced === 1 ? "claim has" : "claims have"} nothing quoted behind them and
            start unticked.
          </span>
        )}
      </div>

      <div className="space-y-3">
        {Object.entries(byPhase).map(([phase, list]) => (
          <div key={phase}>
            <div className="mono uppercase tracking-wider mb-1.5" style={{ fontSize: 9, color: C.faint }}>
              {phase}
            </div>
            <div className="space-y-1">
              {list.map((c) => {
                const on = accepted.has(c.k);
                return (
                  <button
                    key={c.k}
                    onClick={() => toggle(c.k)}
                    className="w-full text-left rounded-lg px-2.5 py-2 flex items-start gap-2.5"
                    style={{
                      background: on ? C.panel2 : "transparent",
                      border: "1px solid " + (on ? C.teal + "44" : C.line),
                    }}
                  >
                    <span
                      className="mt-0.5 rounded flex items-center justify-center shrink-0"
                      style={{
                        width: 16, height: 16,
                        background: on ? C.teal : "transparent",
                        border: on ? "none" : "1.5px solid " + C.faint,
                      }}
                    >
                      {on && <Check size={11} strokeWidth={3} color={C.bg} />}
                    </span>

                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span style={{ fontSize: 12, color: on ? C.text : C.muted }}>{c.text}</span>
                        <span
                          className="mono rounded px-1"
                          style={{ fontSize: 9, background: (c.status === "done" ? C.teal : C.amber) + "22", color: c.status === "done" ? C.teal : C.amber }}
                        >
                          {c.status === "done" ? "DONE" : "IN PROGRESS"}
                        </span>
                      </span>

                      {c.evidence ? (
                        <span className="flex items-start gap-1.5 mt-1">
                          <Quote size={9} style={{ color: C.faint, marginTop: 3, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: C.faint, fontStyle: "italic" }}>{c.evidence}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 mt-1">
                          <AlertTriangle size={9} style={{ color: C.amber, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: C.amber }}>Nothing in the documents backs this up</span>
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
