"use client";

import React, { useState } from "react";

import { Check, Minus, Plus } from "lucide-react";

import { C, STATUS, PEOPLE } from "@/lib/theme";



export function Field({ label, icon: Ic, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {Ic && <Ic size={13} style={{ color: C.faint }} />}
        <span className="text-xs font-medium" style={{ color: C.muted }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

export function Avatar({ id, size = 20, people }) {
  const p = (people || PEOPLE)[id];
  if (!p) return null;
  return (
    <span
      title={p.name}
      className="rounded-full flex items-center justify-center mono font-bold shrink-0"
      style={{ fontSize: size <= 20 ? 9 : 10, width: size, height: size, background: p.color, color: C.bg }}
    >
      {p.initials}
    </span>
  );
}

export function Pill({ tone, children }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{ background: tone + "22", color: tone }}
    >
      {children}
    </span>
  );
}

export function MiniConstellation({ phases }) {
  return (
    <div className="flex items-center">
      {phases.map((p, i) => {
        const col = STATUS[p.status].color;
        const lit = p.status === "done";
        return (
          <React.Fragment key={p.id}>
            {i > 0 && (
              <span
                style={{
                  width: 14, height: 1.5, background: p.status === "open" ? C.line : col,
                  opacity: p.status === "open" ? 0.8 : 0.6,
                }}
              />
            )}
            <span
              title={p.label}
              className="rounded-full shrink-0"
              style={{
                width: lit ? 8 : 6, height: lit ? 8 : 6,
                background: lit ? col : "transparent",
                border: lit ? "none" : "1.5px solid " + col,
                boxShadow: lit ? "0 0 6px 1px " + col + "66" : "none",
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Nav
   ──────────────────────────────────────────────────────────── */

export function Popover({ children, width = 380 }) {
  return (
    <div
      className="absolute rounded-2xl p-4 fade"
      style={{ top: "calc(100% + 8px)", left: 0, width, zIndex: 30, background: C.panel2, border: "1px solid " + C.line, boxShadow: "0 18px 40px -12px #000000cc" }}
    >
      {children}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Onboarding agent — the only place a model runs.
   Code has already decided a nudge is warranted and what about;
   the model's job is deciding how to say it, and to whom.
   ──────────────────────────────────────────────────────────── */

export function SurfaceHead({ title, sub, action }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-5">
      <div>
        <h1 className="disp text-2xl font-bold">{title}</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>{sub}</p>
      </div>
      {action}
    </div>
  );
}

export function Row({ children, head }) {
  return (
    <div
      className="grid gap-3 items-center px-4 py-3 text-sm"
      style={{
        gridTemplateColumns: "2.2fr 1fr 1fr 1fr 0.6fr",
        borderBottom: "1px solid " + C.line,
        color: head ? C.faint : C.text,
        fontSize: head ? 11 : 14,
        textTransform: head ? "uppercase" : "none",
        letterSpacing: head ? "0.06em" : "normal",
      }}
    >
      {children}
    </div>
  );
}

export function AddForm({ kind, onCancel, onSave }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [who, setWho] = useState("kat");
  const iStyle = { background: C.bg, border: "1px solid " + C.line, color: C.text, outline: "none" };
  const isStep = kind === "step";

  return (
    <div className="rounded-xl p-4 mt-2 fade" style={{ background: C.panel2, border: "1px solid " + C.violet + "55" }}>
      <div className="mono uppercase tracking-wider mb-3" style={{ fontSize: 10, color: C.violet }}>
        {isStep ? "New step" : "New phase"}
      </div>
      <div className="space-y-3">
        <div>
          <div className="text-xs mb-1.5" style={{ color: C.muted }}>{isStep ? "Step name" : "Phase name"}</div>
          <input
            autoFocus value={a} onChange={(e) => setA(e.target.value)}
            placeholder={isStep ? "e.g. Security review with InfoSec" : "e.g. Procurement & legal"}
            className="w-full rounded-lg px-3 py-2 text-sm" style={iStyle}
          />
        </div>
        <div>
          <div className="text-xs mb-1.5" style={{ color: C.muted }}>{isStep ? "What needs to happen" : "What happens in this phase"}</div>
          <textarea
            value={b} onChange={(e) => setB(e.target.value)} rows={2}
            placeholder={isStep ? "The detail whoever picks this up will need" : "One sentence the customer can read"}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none" style={iStyle}
          />
        </div>
        {isStep && (
          <div>
            <div className="text-xs mb-1.5" style={{ color: C.muted }}>Owner</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(PEOPLE).map((pid) => (
                <button
                  key={pid} onClick={() => setWho(pid)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1"
                  style={{ background: who === pid ? C.panel : "transparent", border: "1px solid " + (who === pid ? C.violet + "77" : C.line) }}
                >
                  <Avatar id={pid} size={18} />
                  <span style={{ fontSize: 11, color: who === pid ? C.text : C.muted }}>{PEOPLE[pid].name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => a.trim() && onSave({ a: a.trim(), b: b.trim(), who })}
          className="rounded-lg px-3 py-1.5 text-sm font-medium"
          style={{ background: a.trim() ? C.brand : C.panel, color: a.trim() ? "#fff" : C.faint }}
        >
          Add {isStep ? "step" : "phase"}
        </button>
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm" style={{ color: C.muted }}>Cancel</button>
      </div>
    </div>
  );
}
