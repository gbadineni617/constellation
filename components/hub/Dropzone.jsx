"use client";

import React, { useState, useRef } from "react";
import { Upload, Sparkles, Check, AlertCircle, FileText, ClipboardPaste, X } from "lucide-react";
import { C } from "@/lib/theme";
import { readJson, apiFetch } from "@/lib/http";
import { LABELS } from "@/lib/intake";
import { ProgressReview } from "./ProgressReview";

const TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|log|vtt|srt|eml|rtf|html?|xml|ya?ml)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;
const SHEET_EXT = /\.(xlsx|xls|xlsm|ods)$/i;
const MAX_MB = 6;
const MAX_FILES = 8;

function classify(name) {
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.docx?$/i.test(name)) return "docx";
  if (SHEET_EXT.test(name)) return "sheet";
  if (IMAGE_EXT.test(name)) return "image";
  if (TEXT_EXT.test(name)) return "text";
  return null;
}

const readAsText = (f) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error("Could not read that file."));
    r.onload = () => res(r.result);
    r.readAsText(f);
  });

const readAsBase64 = (f) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error("Could not read that file."));
    r.onload = () => res(String(r.result).split(",")[1]);
    r.readAsDataURL(f);
  });

export function Dropzone({ onExtracted, onUseExample, onProgressChange }) {
  const [over, setOver] = useState(false);
  const [state, setState] = useState("idle"); // idle | reading | error | done
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [source, setSource] = useState("");
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");
  const [skipped, setSkipped] = useState([]);
  const [step, setStep] = useState("");
  const [pct, setPct] = useState(0);
  const inputRef = useRef(null);

  /**
   * Start a job and follow it.
   *
   * The upload returns a job id immediately rather than the finished plan,
   * because designing a journey takes longer than a request is allowed to.
   * Polling also means we can say what is happening — 45 seconds of spinner
   * reads as broken even when it is working.
   */
  const send = async (payload, label) => {
    setState("reading"); setErr(""); setResult(null); setSource(label);
    setStep("Uploading"); setPct(2);

    try {
      const res = await apiFetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { id } = await readJson(res);
      if (!id) throw new Error("The server did not start the job.");

      const startedAt = Date.now();
      let nudged = false;

      for (;;) {
        await new Promise((r) => setTimeout(r, 1500));

        if (Date.now() - startedAt > 6 * 60 * 1000) {
          throw new Error("That is taking unusually long. Try one document rather than several.");
        }

        const job = await readJson(await apiFetch("/api/intake/" + id));
        if (job.step) setStep(job.step);
        if (typeof job.progress === "number") setPct(job.progress);

        if (job.state === "failed") throw new Error(job.error || "Generation failed.");
        if (job.state === "done") {
          setResult(job.result);
          setState("done");
          onExtracted({ ...job.result, sourceName: label });
          return;
        }

        // A job still sitting at "queued" after 15 seconds means the invocation
        // that should have run it died — a deploy mid-flight, or the platform
        // reclaiming it. Nudge the retry endpoint once rather than waiting out
        // the full timeout on a job that will never move.
        if (!nudged && job.state === "queued" && Date.now() - startedAt > 15000) {
          nudged = true;
          setStep("Restarting");
          apiFetch("/api/intake/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          }).catch(() => {});
        }
      }
    } catch (e) {
      setErr(e.message || String(e));
      setState("error");
    }
  };

  const handleFiles = async (fileList) => {
    const chosen = Array.from(fileList || []).slice(0, MAX_FILES);
    if (!chosen.length) return;

    const rejected = [];
    const payload = [];

    for (const file of chosen) {
      const kind = classify(file.name);
      if (!kind) { rejected.push(file.name + " — unsupported format"); continue; }
      if (file.size > MAX_MB * 1024 * 1024) {
        rejected.push(file.name + " — " + (file.size / 1048576).toFixed(1) + " MB, over the " + MAX_MB + " MB limit");
        continue;
      }
      try {
        const content = kind === "text" ? await readAsText(file) : await readAsBase64(file);
        payload.push({ name: file.name, kind, content });
      } catch {
        rejected.push(file.name + " — could not be read");
      }
    }

    if (!payload.length) {
      setErr(rejected.join("; ") || "Nothing readable in that.");
      setState("error");
      return;
    }

    setSkipped(rejected);
    const label = payload.length === 1 ? payload[0].name : payload.length + " documents";
    await send({ files: payload }, label);
  };

  const drop = (e) => {
    e.preventDefault(); setOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const border =
    state === "error" ? C.pink + "77" :
    state === "done" ? C.teal + "66" :
    over ? C.violet : C.line;

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        onClick={() => state !== "reading" && inputRef.current?.click()}
        className="rounded-xl px-4 py-5 transition-colors"
        style={{
          border: "1.5px dashed " + border,
          background: over ? C.brand + "14" : C.panel,
          cursor: state === "reading" ? "default" : "pointer",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple
          accept=".pdf,.doc,.docx,.xlsx,.xls,.xlsm,.ods,.txt,.md,.csv,.tsv,.json,.log,.vtt,.srt,.eml,.rtf,.html,.xml,.yaml,.yml,.png,.jpg,.jpeg,.webp,.gif"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />

        <div className="flex items-center gap-3">
          <span
            className={"rounded-lg flex items-center justify-center shrink-0 " + (state === "reading" ? "pulse" : "")}
            style={{ width: 38, height: 38, background: state === "done" ? C.teal + "22" : C.brand + "22" }}
          >
            {state === "reading" ? <Sparkles size={18} style={{ color: C.violet }} />
              : state === "done" ? <Check size={18} strokeWidth={3} style={{ color: C.teal }} />
              : <Upload size={18} style={{ color: C.violet }} />}
          </span>

          <div className="flex-1 min-w-0">
            {state === "reading" ? (
              <>
                <div className="text-sm font-medium">{step || "Reading"} · {source}</div>
                <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: 3, background: C.line }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: Math.max(2, pct) + "%", background: "linear-gradient(90deg," + C.teal + "," + C.violet + ")", transition: "width .6s ease" }}
                  />
                </div>
                <div className="text-xs mt-1" style={{ color: C.faint }}>
                  This takes up to a minute. You can leave the page open.
                </div>
              </>
            ) : state === "done" ? (
              <>
                <div className="text-sm font-medium">Read {source}</div>
                <div className="text-xs" style={{ color: C.faint }}>Everything below is filled in. Check it before you generate.</div>
              </>
            ) : (
              <>
                <div className="text-sm font-medium">Drop everything you have on this customer</div>
                <div className="text-xs" style={{ color: C.faint }}>
                  Brief, transcript, email thread, tracker spreadsheet — up to {MAX_FILES} at once. PDF, Word, Excel, text, or a screenshot.
                </div>
              </>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onUseExample(); setState("idle"); setResult(null); }}
            className="text-xs font-medium rounded-lg px-3 py-2 shrink-0"
            style={{ background: C.panel2, color: C.text, border: "1px solid " + C.line }}
          >
            Use Walmart example
          </button>
        </div>
      </div>

      {/* Paste, because half the time the notes are in an email */}
      {!pasting ? (
        <button
          onClick={() => setPasting(true)}
          className="inline-flex items-center gap-1.5 text-xs mt-2"
          style={{ color: C.muted }}
        >
          <ClipboardPaste size={13} /> or paste the notes instead
        </button>
      ) : (
        <div className="mt-2 rounded-xl p-3" style={{ background: C.panel, border: "1px solid " + C.line }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: C.muted }}>Paste kickoff notes, an email, or a transcript</span>
            <button onClick={() => { setPasting(false); setPasted(""); }} style={{ color: C.faint }}><X size={14} /></button>
          </div>
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            rows={5}
            placeholder="Paste anything — I'll pull out what matters."
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ background: C.bg, border: "1px solid " + C.line, color: C.text, outline: "none" }}
          />
          <button
            onClick={() => pasted.trim() && send({ kind: "text", content: pasted, filename: "pasted notes" }, "your notes")}
            disabled={!pasted.trim() || state === "reading"}
            className="rounded-lg px-3 py-1.5 text-sm font-medium mt-2"
            style={{ background: pasted.trim() ? C.brand : C.panel2, color: pasted.trim() ? "#fff" : C.faint }}
          >
            {state === "reading" ? "Reading…" : "Read this"}
          </button>
        </div>
      )}

      {skipped.length > 0 && state === "done" && (
        <div className="rounded-lg px-3 py-2 mt-2" style={{ background: C.panel, border: "1px solid " + C.line }}>
          <div style={{ fontSize: 11, color: C.muted }}>Skipped: {skipped.join("; ")}</div>
        </div>
      )}

      {state === "error" && (
        <div className="rounded-xl px-4 py-3 mt-2 flex items-start gap-2.5" style={{ background: C.panel, border: "1px solid " + C.pink + "55" }}>
          <AlertCircle size={15} style={{ color: C.pink, marginTop: 1, flexShrink: 0 }} />
          <div>
            <div className="text-sm" style={{ color: C.text }}>{err}</div>
            <div className="text-xs mt-0.5" style={{ color: C.faint }}>You can always fill the form in by hand below.</div>
          </div>
        </div>
      )}

      {/* What it found, and why it classified the way it did */}
      {state === "done" && result && (
        <div className="rounded-xl p-4 mt-2 fade" style={{ background: C.panel, border: "1px solid " + C.teal + "44" }}>
          <div className="flex flex-wrap gap-1.5">
            {result.found.map((f) => (
              <span key={f} className="inline-flex items-center gap-1 rounded-md px-2 py-1" style={{ fontSize: 11, background: C.teal + "1A", color: C.teal }}>
                <Check size={10} strokeWidth={3} /> {LABELS[f]}
              </span>
            ))}
            {result.missing.map((f) => (
              <span key={f} className="rounded-md px-2 py-1" style={{ fontSize: 11, background: C.panel2, color: C.faint }}>
                {LABELS[f]} — not mentioned
              </span>
            ))}
          </div>

          <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: "1px solid " + C.line }}>
            {[
              ["Content type", result.contentPath, result.reasoning.contentPath],
              ["Linguistic assets", result.maturity === "mature" ? "From a prior vendor" : "New to localisation", result.reasoning.maturity],
              ["Delivery", result.delivery === "connected" ? (result.connector || "Connected") : "Manual upload", result.reasoning.delivery],
              ["Reviewers", result.reviewModel === "unknown" ? "Not established — worth asking" : (result.reviewModel === "ai_only" ? "AI only" : result.reviewModel === "internal" ? "Their own reviewers" : result.reviewModel === "hybrid" ? "Hybrid" : "Marketplace"), result.reasoning.reviewModel],
            ].map(([k, v, why]) => (
              <div key={k} className="flex items-baseline gap-2" style={{ fontSize: 11 }}>
                <span style={{ color: C.faint, width: 108, flexShrink: 0 }}>{k}</span>
                <span style={{ color: C.text, fontWeight: 500 }}>{v}</span>
                {why && <span style={{ color: C.faint }}>— {why}</span>}
              </div>
            ))}
          </div>

          {result.claims?.length > 0 && (
            <ProgressReview
              claims={result.claims}
              unevidenced={result.unevidenced || 0}
              onChange={onProgressChange}
            />
          )}

          {result.files?.length > 1 && (
            <div className="mb-3 pb-3" style={{ borderBottom: "1px solid " + C.line }}>
              <div className="mono uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: C.faint }}>
                Read together
              </div>
              {result.files.map((f) => (
                <div key={f.name} className="flex items-baseline gap-2" style={{ fontSize: 11 }}>
                  <span style={{ color: f.ok ? C.text : C.faint }}>{f.name}</span>
                  <span style={{ color: C.faint }}>
                    {f.ok ? (f.truncated ? "truncated" : f.kind) : f.reason}
                  </span>
                </div>
              ))}
            </div>
          )}

          {result.patternsPending && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid " + C.line }}>
              <div className="mono uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: C.faint }}>
                No team conventions yet
              </div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {result.patternsPending.sampled} approved comparable journeys, {result.patternsPending.needed} needed.
                Approve your good journeys and they start informing new ones.
              </div>
            </div>
          )}

          {result.patterns && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid " + C.line }}>
              <div className="mono uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: C.faint }}>
                Team conventions applied
              </div>
              <div style={{ fontSize: 11, color: C.text }}>
                {result.patterns.steps} recurring steps and {result.patterns.phases} recurring phases,
                measured across {result.patterns.sampled} comparable journeys.
              </div>
              <div className="text-xs mt-1" style={{ color: C.faint }}>
                Every comparable journey informs these. The examples below are only the closest few.
              </div>
            </div>
          )}

          {result.references?.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid " + C.line }}>
              <div className="mono uppercase tracking-widest mb-2" style={{ fontSize: 10, color: C.faint }}>
                Learned from
              </div>
              <div className="space-y-1">
                {result.references.map((r) => (
                  <div key={r.id} className="flex items-baseline gap-2" style={{ fontSize: 11 }}>
                    <span style={{ color: C.text }}>{r.customer}</span>
                    <span style={{ color: C.faint }}>{r.reason}</span>
                    <span className="mono ml-auto" style={{ color: r.score >= 70 ? C.teal : C.muted }}>{r.score}%</span>
                  </div>
                ))}
              </div>
              <div className="text-xs mt-2" style={{ color: C.faint }}>
                Past journeys this team built for comparable customers, used as worked examples.
              </div>
            </div>
          )}

          {result.plan && result.plan.phases?.length > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid " + C.line }}>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="mono uppercase tracking-widest" style={{ fontSize: 10, color: C.faint }}>Designed path</span>
                <span className="mono" style={{ fontSize: 11, color: C.violet }}>
                  {result.plan.phases.length} phases · {result.plan.phases.reduce((n, p) => n + p.steps.length, 0)} steps
                </span>
              </div>
              <div className="space-y-1">
                {result.plan.phases.map((p, i) => (
                  <div key={p.id} className="flex items-baseline gap-2" style={{ fontSize: 11 }}>
                    <span className="mono" style={{ color: C.faint, width: 16 }}>{i + 1}</span>
                    <span style={{ color: C.text }}>{p.label}</span>
                    {p.custom && (
                      <span className="mono rounded px-1" style={{ fontSize: 9, background: C.violet + "26", color: C.violet }}>FOR THEM</span>
                    )}
                    <span className="mono ml-auto" style={{ color: C.faint }}>{p.steps.length}</span>
                  </div>
                ))}
              </div>
              {result.plan.rationale && (
                <div className="text-xs mt-2.5" style={{ color: C.muted }}>{result.plan.rationale}</div>
              )}
              {result.plan.generatedNotes?.length > 0 && (
                <div className="mt-2.5 rounded-lg px-2.5 py-2" style={{ background: C.amber + "12", border: "1px solid " + C.amber + "2E" }}>
                  <div className="mono uppercase tracking-wider mb-1" style={{ fontSize: 9, color: C.amber }}>Guardrails applied</div>
                  {result.plan.generatedNotes.map((n, i) => (
                    <div key={i} style={{ fontSize: 10, color: C.muted }}>{n}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 mt-3 pt-3" style={{ borderTop: "1px solid " + C.line }}>
            <FileText size={12} style={{ color: C.faint, marginTop: 2, flexShrink: 0 }} />
            <span className="text-xs" style={{ color: C.faint }}>
              Designed from one document. Correct anything below, then generate — the phases marked <span style={{ color: C.violet }}>FOR THEM</span> exist because this document called for them. The six required gates are always present.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
