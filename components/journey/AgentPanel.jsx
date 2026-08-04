"use client";

import React, { useState } from "react";

import { Zap, Sparkles, AlertCircle, Mail, MessageSquare, Copy } from "lucide-react";

import { C, RISK } from "@/lib/theme";
import { readJson } from "@/lib/http";

import { PEOPLE } from "@/lib/theme";

import { HEALTH_TARGETS } from "@/lib/journey";



export function AgentPanel({ rec, risk }) {
  const [channel, setChannel] = useState("email");
  const [state, setState] = useState("idle"); // idle | writing | done | error
  const [draft, setDraft] = useState(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  const quiet = risk.level === "on_track" || risk.level === "complete";

  const facts = () => {
    const L = [];
    L.push("Customer: " + rec.customer);
    L.push("What they're trying to do: " + rec.useCase);
    L.push("Main contact: " + (rec.ownerName || "the customer lead"));
    L.push("Their implementation engineer: " + rec.fde);
    L.push("Target go-live: " + rec.goLive + (risk.daysLeft != null ? " (" + risk.daysLeft + " days away)" : ""));
    L.push("Progress: " + risk.pct + "% of the onboarding path complete (" + risk.done + " of " + risk.total + " steps)");
    if (risk.expected != null) L.push("Expected at this point in the timeline: " + risk.expected + "%");
    if (risk.idle != null) L.push("Days since anyone touched the workspace: " + risk.idle);
    if (risk.missed.length)
      L.push("Health targets not yet met: " + risk.missed.map((m) => m.k + " (" + m.now + "% vs " + m.target + "% target)").join("; "));
    if (risk.markers?.issues.length)
      L.push("Issues recorded between phases:\n" + risk.markers.issues.map((m) =>
        "  - after " + (m.afterLabel || "a phase") + ": " + m.text +
        " (open " + (m.age?.days ?? 0) + " days" + (m.ref ? ", ref " + m.ref : "") + ")").join("\n"));
    if (risk.markers?.decisions.length)
      L.push("Decisions already agreed, do not re-open these: " +
        risk.markers.decisions.map((m) => m.text).join("; "));
    if (risk.tickets?.open.length)
      L.push("Blockers logged against specific steps:\n" + risk.tickets.open.map((t) =>
        "  - \"" + t.step + "\" is blocked: " + t.text +
        " (open " + (t.age?.days ?? 0) + " days" + (t.ref ? ", ref " + t.ref : "") + ")").join("\n"));
    if (risk.roster && risk.roster.blocked.length)
      L.push("Language pairs with no approved linguist yet: " +
        risk.roster.blocked.map((p) => p.source + ">" + p.target + " (" + p.state + ")").join(", ") +
        ". Go-live is blocked on these.");
    if (risk.overdue.length)
      L.push("Steps already past their agreed date:\n" + risk.overdue.map((o) =>
        "  - \"" + o.t + "\" was due " + o.due + ", now " + o.d.days + " days late" +
        (o.owners.length ? " (owner: " + o.owners.join(", ") + ")" : "")).join("\n"));
    if (risk.dueSoon.length)
      L.push("Steps due within days:\n" + risk.dueSoon.map((o) =>
        "  - \"" + o.t + "\" due " + o.due + (o.d.days === 0 ? " (today)" : " (in " + o.d.days + " days)") +
        (o.owners.length ? " (owner: " + o.owners.join(", ") + ")" : "")).join("\n"));
    if (risk.blockers.length)
      L.push("Steps still open that should be done by now:\n" + risk.blockers.map((b) =>
        "  - [" + b.phase + "] " + b.text + (b.note ? " — " + b.note : "") + (b.who.length ? " (owner: " + b.who.join(", ") + ")" : "")).join("\n"));
    return L.join("\n");
  };

  const write = async () => {
    setState("writing"); setErr(""); setCopied(false);
    const prompt = [
      "You are the onboarding agent inside Smartcat's Constellation product. A customer's implementation is off track and you are writing the nudge that goes out.",
      "",
      "Write as the implementation engineer (" + rec.fde + "), not as a bot. Do not mention that you are an AI.",
      "",
      "Rules:",
      "- Lead with the single most consequential thing, not a list.",
      "- Name the specific blocked step and who owns it. Be concrete about the ask.",
      "- Reference the date pressure once. Do not repeat it or catastrophise.",
      "- Helpful and matter-of-fact. No guilt, no exclamation marks, no 'just checking in'.",
      "- Make the next action a single, small, obvious thing they can do this week.",
      channel === "email"
        ? "- Channel: email. Six sentences at most. Include a subject line under nine words."
        : "- Channel: Slack DM. Three sentences at most, conversational, no subject line, no greeting block.",
      "",
      "Here is the current state:",
      facts(),
      "",
      'Respond with ONLY a JSON object, no markdown fences, no preamble: {"subject": string, "body": string, "why": string}',
      '"why" is one short sentence for the engineer explaining why this nudge is being sent now. For Slack, set "subject" to an empty string.',
    ].join("\n");

    try {
      // The key lives on the server. The browser never sees it.
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      setDraft(await readJson(res));
      setState("done");
    } catch (e) {
      setErr(String(e.message || e));
      setState("error");
    }
  };

  const copy = () => {
    const t = (draft.subject ? draft.subject + "\n\n" : "") + draft.body;
    if (navigator.clipboard) navigator.clipboard.writeText(t);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="rounded-2xl p-5 fade mt-4" style={{ background: "linear-gradient(135deg,#1D1830,#171327)", border: "1px solid " + C.violet + "55" }}>
      <div className="flex items-center gap-2 flex-wrap">
        <Zap size={15} style={{ color: C.violet }} />
        <span className="mono text-xs uppercase tracking-wider" style={{ color: C.violet }}>Onboarding agent</span>
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: RISK[risk.level].color + "22", color: RISK[risk.level].color }}>
          {RISK[risk.level].label}
        </span>
      </div>

      {/* Computed signals — this is arithmetic, not a model output */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {risk.signals.map((s, i) => (
          <span
            key={i}
            className="mono rounded-md px-2 py-1"
            style={{ fontSize: 11, background: s.hot ? C.amber + "1F" : C.panel2, color: s.hot ? C.amber : C.muted, border: "1px solid " + (s.hot ? C.amber + "44" : C.line) }}
          >
            {s.t}
          </span>
        ))}
      </div>

      {quiet ? (
        <div className="text-sm mt-3" style={{ color: C.muted }}>{RISK[risk.level].tone} The agent stays quiet until something slips.</div>
      ) : (
        <>
          <div className="text-sm mt-3" style={{ color: C.text }}>
            {RISK[risk.level].tone} Worth a nudge to {rec.ownerName || "the customer lead"} — I can draft it.
          </div>

          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <div className="inline-flex rounded-lg p-0.5" style={{ background: C.panel2 }}>
              {[["email", "Email", Mail], ["slack", "Slack", MessageSquare]].map(([k, lbl, Ic]) => (
                <button
                  key={k}
                  onClick={() => { setChannel(k); setState("idle"); setDraft(null); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm"
                  style={{ background: channel === k ? C.brand : "transparent", color: channel === k ? "#fff" : C.muted }}
                >
                  <Ic size={13} /> {lbl}
                </button>
              ))}
            </div>
            <button
              onClick={write}
              disabled={state === "writing"}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium"
              style={{ background: C.brand, color: "#fff", opacity: state === "writing" ? 0.65 : 1 }}
            >
              <Sparkles size={15} />
              {state === "writing" ? "Writing…" : draft ? "Rewrite" : "Draft the reminder"}
            </button>
          </div>

          {state === "writing" && (
            <div className="text-xs mt-3 mono" style={{ color: C.faint }}>Reading the signals above and drafting…</div>
          )}

          {state === "error" && (
            <div className="rounded-xl px-4 py-3 mt-3" style={{ background: C.panel2, border: "1px solid " + C.pink + "55" }}>
              <div className="text-sm" style={{ color: C.text }}>Couldn't reach the model.</div>
              <div className="text-xs mt-1" style={{ color: C.faint }}>{err} The signals above are computed locally and are still accurate.</div>
            </div>
          )}

          {state === "done" && draft && (
            <div className="rounded-xl p-4 mt-3 fade" style={{ background: C.panel, border: "1px solid " + C.line }}>
              {draft.subject ? (
                <div className="pb-3 mb-3" style={{ borderBottom: "1px solid " + C.line }}>
                  <div className="mono uppercase tracking-wider" style={{ fontSize: 9, color: C.faint }}>Subject</div>
                  <div className="text-sm font-medium mt-1">{draft.subject}</div>
                </div>
              ) : null}
              <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: C.text }}>{draft.body}</div>
              {draft.why && (
                <div className="text-xs mt-4 pt-3 flex items-start gap-2" style={{ borderTop: "1px solid " + C.line, color: C.faint }}>
                  <AlertCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{draft.why}</span>
                </div>
              )}
              <div className="flex items-center gap-2 mt-4">
                <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm" style={{ background: C.panel2, color: C.text, border: "1px solid " + C.line }}>
                  <Copy size={13} /> {copied ? "Copied" : "Copy"}
                </button>
                <span className="text-xs" style={{ color: C.faint }}>Nothing sends until you send it.</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
