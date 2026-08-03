"use client";

import React, { useState, useEffect } from "react";
import { Library as LibraryIcon, FileText, Loader2, AlertCircle, Link2, BadgeCheck } from "lucide-react";
import { C } from "@/lib/theme";
import { SurfaceHead } from "@/components/shared";
import { traitsOf, editSignal, isApproved, MIN_CORPUS_FOR_PATTERNS } from "@/lib/corpus";

const KIND = { text: "Text", pdf: "PDF", docx: "Word", image: "Image" };

const when = (d) => {
  if (!d) return "";
  const t = new Date(d);
  return t.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

/**
 * The corpus, made visible. Two things live here: the source documents journeys were
 * designed from, and the designed journeys themselves — which is what gets retrieved
 * as worked examples next time someone drops a comparable brief.
 */
export function Library({ records }) {
  const [docs, setDocs] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const res = await fetch("/api/documents");
        const data = await res.json();
        if (off) return;
        setDocs(data.documents || []);
        setStatus("ready");
      } catch {
        if (!off) setStatus("error");
      }
    })();
    return () => { off = true; };
  }, []);

  const designed = (records || []).filter((r) => Array.isArray(r.phases) && r.phases.length);
  const approved = designed.filter(isApproved);
  const shortBy = Math.max(0, MIN_CORPUS_FOR_PATTERNS - approved.length);

  return (
    <>
      <SurfaceHead
        title="Library"
        sub="What Constellation has learned from. Comparable journeys get used as examples next time."
      />

      <div className="rounded-2xl p-5 mb-4" style={{ background: C.panel, border: "1px solid " + C.line }}>
        <div className="flex items-center gap-2 mb-1">
          <LibraryIcon size={15} style={{ color: C.violet }} />
          <h3 className="disp text-sm font-bold">Designed journeys — {designed.length}</h3>
        </div>
        <div className="text-xs mb-3" style={{ color: C.muted }}>
          These are what get retrieved when a new document arrives. Approved ones rank highest,
          then ones an FDE corrected by hand — the corrections are the judgement worth copying.
        </div>

        <div
          className="rounded-lg px-3 py-2.5 mb-4 flex items-start gap-2.5"
          style={{
            background: shortBy ? C.amber + "12" : C.teal + "12",
            border: "1px solid " + (shortBy ? C.amber + "33" : C.teal + "33"),
          }}
        >
          <BadgeCheck size={14} style={{ color: shortBy ? C.amber : C.teal, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12 }}>
            <span style={{ color: C.text }}>{approved.length} approved of {designed.length}.</span>{" "}
            <span style={{ color: C.muted }}>
              {shortBy
                ? "Team conventions start being applied at " + MIN_CORPUS_FOR_PATTERNS + " approved journeys — " + shortBy + " to go. Unapproved drafts never define a convention."
                : "Conventions are being drawn from these. Only approved journeys count."}
            </span>
          </div>
        </div>

        {designed.length === 0 ? (
          <div className="text-sm" style={{ color: C.faint }}>
            Nothing yet. Generate a journey from a document and it becomes a reference for the next one.
          </div>
        ) : (
          <div className="space-y-2">
            {designed.map((r) => {
              const t = traitsOf(r);
              const e = editSignal(r);
              return (
                <div key={r.id} className="rounded-lg px-3 py-2.5" style={{ background: C.panel2 }}>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm">{r.customer}</span>
                    {isApproved(r) && (
                      <span className="mono rounded px-1.5 inline-flex items-center gap-1" style={{ fontSize: 9, background: C.teal + "22", color: C.teal }}>
                        <BadgeCheck size={9} /> APPROVED
                      </span>
                    )}
                    {e.edited && (
                      <span className="mono rounded px-1.5" style={{ fontSize: 9, background: C.teal + "22", color: C.teal }}>
                        CORRECTED · {e.changes}
                      </span>
                    )}
                    <span className="mono ml-auto" style={{ fontSize: 11, color: C.faint }}>
                      {r.phases.length} phases
                    </span>
                  </div>
                  <div className="mono mt-1" style={{ fontSize: 10, color: C.faint }}>
                    {[t.contentPath, t.maturity, t.delivery, t.reviewModel, t.specialization].filter(Boolean).join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl p-5" style={{ background: C.panel, border: "1px solid " + C.line }}>
        <div className="flex items-center gap-2 mb-1">
          <FileText size={15} style={{ color: C.muted }} />
          <h3 className="disp text-sm font-bold">Source documents — {docs.length}</h3>
        </div>
        <div className="text-xs mb-4" style={{ color: C.muted }}>
          The briefs, notes and transcripts journeys were designed from. Stored as extracted
          text, not original files.
        </div>

        {status === "loading" && (
          <div className="flex items-center gap-2 text-sm" style={{ color: C.faint }}>
            <Loader2 size={14} className="spin" /> Loading…
          </div>
        )}

        {status === "error" && (
          <div className="flex items-start gap-2 text-sm" style={{ color: C.muted }}>
            <AlertCircle size={14} style={{ color: C.pink, flexShrink: 0, marginTop: 2 }} />
            Could not load the library.
          </div>
        )}

        {status === "ready" && docs.length === 0 && (
          <div className="text-sm" style={{ color: C.faint }}>
            Nothing stored yet. Documents are kept automatically when you generate from one.
          </div>
        )}

        {status === "ready" && docs.length > 0 && (
          <div className="space-y-1.5">
            {docs.map((d) => (
              <div key={d.id} className="rounded-lg px-3 py-2 flex items-center gap-3" style={{ background: C.panel2 }}>
                <span className="mono rounded px-1.5 shrink-0" style={{ fontSize: 9, background: C.line, color: C.muted }}>
                  {KIND[d.kind] || d.kind}
                </span>
                <span className="text-sm truncate">{d.filename}</span>
                {d.customer && (
                  <span className="inline-flex items-center gap-1 shrink-0" style={{ fontSize: 11, color: C.violet }}>
                    <Link2 size={10} /> {d.customer}
                  </span>
                )}
                <span className="mono ml-auto shrink-0" style={{ fontSize: 10, color: C.faint }}>{when(d.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
