"use client";

import React, { useState } from "react";
import { Users, ChevronDown, Check, ShieldCheck, Search, Copy, ArrowUpRight, ArrowRight } from "lucide-react";
import { C } from "@/lib/theme";
import { PAIR_STATES, PAIR_STATE_IDS, rosterState, REVIEW_MODELS } from "@/lib/marketplace";
import { marketplaceQuery, sourcingBrief, describeTarget } from "@/lib/surfaces";
import { navigateHost, isEmbedded } from "@/lib/embed";

const TONE = { scoping: C.faint, sourcing: C.muted, trial: C.amber, approved: C.teal, active: C.teal };

/**
 * The pair matrix. Deliberately not a single percentage: an enterprise rollout
 * stalls on two locales out of thirteen, and that is exactly what an average hides.
 */
export function Roster({ rec, onPatch }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const embedded = typeof window !== "undefined" && isEmbedded();

  /**
   * Hand off to Marketplace with this pair's requirements already applied.
   * Everything the search needs is already on the record, so re-typing it is
   * exactly the duplicated effort this product exists to remove.
   */
  const findFor = (pair) => {
    const q = marketplaceQuery(rec, pair);
    const t = describeTarget("marketplace", { embedded, region: rec.region || "us", accountId: rec.smartcatAccountId || "" });
    navigateHost({
      path: q.path,
      href: (t.href || "").replace(/\/marketplace$/, "") + q.path,
    });
  };

  const brief = sourcingBrief(rec, rec.pairs);

  const copyBrief = () => {
    if (!brief) return;
    if (navigator.clipboard) navigator.clipboard.writeText(brief.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const r = rosterState(rec);
  if (!r.total) return null;

  const cyclePair = (i) => {
    const next = PAIR_STATE_IDS[(PAIR_STATE_IDS.indexOf(r.pairs[i].state) + 1) % PAIR_STATE_IDS.length];
    onPatch((rr) => ({ ...rr, pairs: (rr.pairs || []).map((p, j) => (j === i ? { ...p, state: next } : p)) }));
  };

  return (
    <div className="rounded-2xl mt-4" style={{ background: C.panel, border: "1px solid " + (r.complete ? C.teal + "44" : C.line) }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 px-5 py-4 text-left">
        <Users size={15} style={{ color: r.complete ? C.teal : C.amber, flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div className="disp text-sm font-bold">Linguist roster</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {REVIEW_MODELS[rec.reviewModel]?.short || "Marketplace"}
            {rec.specialization ? " · " + rec.specialization : ""}
            {rec.turnaround ? " · " + rec.turnaround : ""}
          </div>
        </div>
        <span className="mono text-sm shrink-0" style={{ color: r.complete ? C.teal : C.amber }}>
          {r.ready}/{r.total} approved
        </span>
        <ChevronDown size={15} style={{ color: C.faint, transform: open ? "rotate(180deg)" : "none", transition: "transform .18s" }} />
      </button>

      {!open && (
        <div className="px-5 pb-4">
          <div className="flex gap-1">
            {r.pairs.map((p, i) => (
              <span
                key={i}
                title={p.source + " → " + p.target + " · " + PAIR_STATES[p.state].label}
                className="flex-1 rounded-full"
                style={{ height: 4, background: PAIR_STATES[p.state].done ? C.teal : TONE[p.state], opacity: PAIR_STATES[p.state].done ? 1 : 0.5 }}
              />
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="px-5 pb-5 fade">
          <div className="text-xs mb-3" style={{ color: C.muted }}>
            Go-live is blocked on any pair without an approved linguist. Click a status to move it along.
          </div>
          <div className="space-y-1.5">
            {r.pairs.map((p, i) => {
              const st = PAIR_STATES[p.state];
              return (
                <div key={i} className="rounded-lg px-3 py-2 flex items-center gap-3" style={{ background: C.panel2 }}>
                  <span className="mono shrink-0" style={{ fontSize: 12, color: C.text, width: 118 }}>
                    {p.source} <span style={{ color: C.faint }}>→</span> {p.target}
                  </span>

                  {p.certification !== "None" && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 shrink-0" style={{ fontSize: 10, background: C.violet + "22", color: C.violet }}>
                      <ShieldCheck size={9} /> {p.certification}
                    </span>
                  )}

                  <span className="mono shrink-0" style={{ fontSize: 11, color: C.faint }}>
                    {p.reviewers} {p.reviewers === 1 ? "reviewer" : "reviewers"}
                  </span>

                  {p.note && <span className="text-xs truncate" style={{ color: C.faint }}>{p.note}</span>}

                  <div className="ml-auto flex items-center gap-1.5 shrink-0">
                    {!st.done && (
                      <button
                        onClick={() => findFor(p)}
                        title={"Search Marketplace: " + marketplaceQuery(rec, p).summary}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
                        style={{ fontSize: 11, background: C.brand + "1F", color: C.violet, border: "1px solid " + C.brand + "55" }}
                      >
                        <Search size={10} /> Find
                        {embedded ? <ArrowRight size={10} /> : <ArrowUpRight size={10} />}
                      </button>
                    )}
                    <button
                      onClick={() => cyclePair(i)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
                      style={{ fontSize: 11, background: TONE[p.state] + "1F", color: TONE[p.state], border: "1px solid " + TONE[p.state] + "44" }}
                    >
                      {st.done && <Check size={10} strokeWidth={3} />} {st.label}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {r.blocked.length > 0 && (
            <div className="text-xs mt-3" style={{ color: C.amber }}>
              Waiting on {r.blocked.map((p) => p.target).join(", ")}.
            </div>
          )}

          {brief && (
            <div className="rounded-xl p-3 mt-3" style={{ background: C.panel2, border: "1px solid " + C.line }}>
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="mono uppercase tracking-wider" style={{ fontSize: 10, color: C.faint }}>
                  Sourcing brief · {brief.count} {brief.count === 1 ? "pair" : "pairs"}
                </div>
                <button
                  onClick={copyBrief}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1"
                  style={{ fontSize: 11, background: C.panel, border: "1px solid " + C.line, color: C.text }}
                >
                  <Copy size={11} /> {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre
                className="mt-2 whitespace-pre-wrap"
                style={{ fontSize: 11, color: C.muted, fontFamily: "inherit", margin: 0 }}
              >
                {brief.text}
              </pre>
              <div className="text-xs mt-2" style={{ color: C.faint }}>
                Everything the Marketplace team needs, assembled from the journey. Nothing to re-type.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
