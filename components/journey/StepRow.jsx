"use client";

import React, { useState } from "react";
import { Check, Minus, CalendarDays, AlertTriangle, MessageSquarePlus, MessageSquare, Hash, Undo2, Pencil, Trash2, X } from "lucide-react";
import { C, STATUS, PEOPLE } from "@/lib/theme";
import { dueState } from "@/lib/journey";
import { TICKET_STATES, isOpen, ticketAge } from "@/lib/tickets";
import { Avatar } from "@/components/shared";

const fmt = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
};

export function StepRow({ it, onCycle, onDue, onOwner, onTicket, onTicketState, onRename, onRemove, people, lock }) {
  const [editDue, setEditDue] = useState(false);
  const [editOwner, setEditOwner] = useState(false);
  const [raising, setRaising] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(it.t);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [text, setText] = useState("");
  const [ref, setRef] = useState("");

  const tickets = it.tickets || [];
  const openTickets = tickets.filter(isOpen);
  const s = STATUS[it.s];
  const d = dueState(it.due, it.s);

  const tone =
    !d ? C.faint :
    d.state === "overdue" ? C.pink :
    d.state === "soon" ? C.amber : C.muted;

  const label =
    !it.due ? "Set date" :
    d?.state === "overdue" ? d.days + "d late" :
    d?.state === "soon" ? (d.days === 0 ? "Due today" : d.days === 1 ? "Due tomorrow" : "In " + d.days + "d") :
    fmt(it.due);

  return (
    <div
      className="rounded-lg px-3 py-2.5 flex items-start gap-3"
      style={{
        background: C.panel2,
        border: "1px solid " + (d?.state === "overdue" ? C.pink + "44" : "transparent"),
      }}
    >
      <button
        onClick={() => !lock?.locked && onCycle(it.k)}
        disabled={Boolean(lock?.locked)}
        title={lock?.locked ? "Finish " + lock.blockedBy + " first" : "Click to change status"}
        className="mt-0.5 rounded flex items-center justify-center shrink-0"
        style={{
          width: 18, height: 18,
          background: it.s === "done" ? C.teal : it.s === "active" ? C.amber + "33" : "transparent",
          border: it.s === "done" ? "none" : "1.5px solid " + s.color,
          opacity: lock?.locked ? 0.35 : 1,
          cursor: lock?.locked ? "not-allowed" : "pointer",
        }}
      >
        {it.s === "done" && <Check size={12} strokeWidth={3} color={C.bg} />}
        {it.s === "na" && <Minus size={12} color={C.faint} />}
      </button>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && draft.trim()) { onRename(it.k, draft.trim()); setEditing(false); }
                if (e.key === "Escape") { setDraft(it.t); setEditing(false); }
              }}
              className="flex-1 rounded px-2 py-1 text-sm"
              style={{ background: C.bg, border: "1px solid " + C.violet + "77", color: C.text, outline: "none" }}
            />
            <button
              onClick={() => { if (draft.trim()) { onRename(it.k, draft.trim()); setEditing(false); } }}
              className="rounded p-1" style={{ color: C.teal }} title="Save"
            >
              <Check size={13} strokeWidth={3} />
            </button>
            <button
              onClick={() => { setDraft(it.t); setEditing(false); }}
              className="rounded p-1" style={{ color: C.faint }} title="Cancel"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="text-sm flex items-center gap-2 flex-wrap group" style={{ color: it.s === "done" ? C.muted : C.text }}>
            {it.t}
            {it.custom && (
              <span className="mono rounded px-1.5 shrink-0" style={{ fontSize: 9, background: C.violet + "26", color: C.violet }}>ADDED</span>
            )}
            {it.renamed && !it.custom && (
              <span className="mono rounded px-1.5 shrink-0" style={{ fontSize: 9, background: C.line, color: C.faint }} title="Renamed from the standard wording">EDITED</span>
            )}
            {d?.state === "overdue" && <AlertTriangle size={12} style={{ color: C.pink, flexShrink: 0 }} />}

            <span className="inline-flex items-center gap-1 row-actions ml-1">
              <button
                onClick={() => { setDraft(it.t); setEditing(true); }}
                className="rounded p-1"
                style={{ color: C.muted, border: "1px solid " + C.line, lineHeight: 0 }}
                title="Rename this step"
              >
                <Pencil size={11} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="rounded p-1"
                style={{ color: C.muted, border: "1px solid " + C.line, lineHeight: 0 }}
                title="Remove this step"
              >
                <Trash2 size={11} />
              </button>
            </span>
          </div>
        )}

        {confirmDelete && (
          <div className="flex items-center gap-2 mt-1.5 rounded-lg px-2.5 py-1.5" style={{ background: C.pink + "12", border: "1px solid " + C.pink + "33" }}>
            <span style={{ fontSize: 11, color: C.text }}>Remove this step from the journey?</span>
            <button
              onClick={() => { onRemove(it.k); setConfirmDelete(false); }}
              className="rounded px-2 py-0.5" style={{ fontSize: 11, background: C.pink, color: C.bg }}
            >
              Remove
            </button>
            <button onClick={() => setConfirmDelete(false)} className="rounded px-2 py-0.5" style={{ fontSize: 11, color: C.muted }}>
              Keep
            </button>
          </div>
        )}
        {it.note && <div className="text-xs mt-0.5" style={{ color: C.faint }}>{it.note}</div>}

        {lock?.locked && (
          <div className="text-xs mt-0.5" style={{ color: C.faint }}>
            Finish <span style={{ color: C.muted }}>{lock.blockedBy}</span> before confirming this
          </div>
        )}

        {/* Deadline and blockers */}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {editDue ? (
            <input
              type="date"
              autoFocus
              defaultValue={it.due || ""}
              onBlur={() => setEditDue(false)}
              onChange={(e) => { onDue(it.k, e.target.value || null); setEditDue(false); }}
              className="rounded px-1.5 py-0.5"
              style={{ fontSize: 11, background: C.bg, border: "1px solid " + C.line, color: C.text, colorScheme: "dark" }}
            />
          ) : (
            <button
              onClick={() => setEditDue(true)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
              style={{
                fontSize: 11,
                color: tone,
                background: d && d.state !== "scheduled" ? tone + "1A" : "transparent",
                border: "1px solid " + (d && d.state !== "scheduled" ? tone + "44" : C.line),
              }}
            >
              <CalendarDays size={10} /> {label}
            </button>
          )}

          {/* Raise a blocker on this step */}
          <button
            onClick={() => setRaising((v) => !v)}
            title={openTickets.length ? openTickets.length + " open blocker(s)" : "Log a blocker"}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
            style={{
              fontSize: 11,
              color: openTickets.length ? C.pink : C.faint,
              background: openTickets.length ? C.pink + "1A" : "transparent",
              border: "1px solid " + (openTickets.length ? C.pink + "44" : C.line),
            }}
          >
            {openTickets.length ? <MessageSquare size={10} /> : <MessageSquarePlus size={10} />}
            {openTickets.length ? openTickets.length + " blocked" : "Blocker"}
          </button>
        </div>

        {/* Existing blockers */}
        {tickets.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {tickets.map((t) => {
              const age = ticketAge(t, new Date("2026-07-26T00:00:00Z"));
              const live = isOpen(t);
              const tone = !live ? C.faint : age?.stale ? C.pink : C.amber;
              return (
                <div
                  key={t.id}
                  className="rounded-lg px-2.5 py-2 flex items-start gap-2"
                  style={{ background: C.bg, borderLeft: "2px solid " + tone }}
                >
                  <MessageSquare size={11} style={{ color: tone, marginTop: 3, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 12, color: live ? C.text : C.faint, textDecoration: live ? "none" : "line-through" }}>
                      {t.text}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="mono rounded px-1" style={{ fontSize: 9, background: tone + "22", color: tone }}>
                        {TICKET_STATES[t.state]?.label || t.state}
                      </span>
                      {t.ref && (
                        <span className="mono inline-flex items-center gap-0.5" style={{ fontSize: 10, color: C.violet }}>
                          <Hash size={9} />{t.ref}
                        </span>
                      )}
                      {live && age && (
                        <span className="mono" style={{ fontSize: 10, color: age.stale ? C.pink : C.faint }}>
                          {age.days}d open
                        </span>
                      )}
                      {t.owner && <Avatar id={t.owner} size={16} people={people} />}
                    </div>
                  </div>
                  <button
                    onClick={() => onTicketState(t.id, live ? "resolved" : "open")}
                    title={live ? "Mark resolved" : "Reopen"}
                    className="shrink-0 rounded p-1"
                    style={{ color: C.faint }}
                  >
                    {live ? <Check size={12} strokeWidth={3} /> : <Undo2 size={12} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Raise form */}
        {raising && (
          <div className="mt-2 rounded-lg p-2.5 fade" style={{ background: C.bg, border: "1px solid " + C.pink + "44" }}>
            <div className="mono uppercase tracking-wider mb-2" style={{ fontSize: 9, color: C.pink }}>
              What's blocking this
            </div>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder="e.g. Legal review of terminology not scheduled"
              className="w-full rounded px-2 py-1.5 resize-none"
              style={{ fontSize: 12, background: C.panel2, border: "1px solid " + C.line, color: C.text, outline: "none" }}
            />
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Ticket ref, optional — e.g. SUP-4821"
              className="w-full rounded px-2 py-1.5 mt-1.5"
              style={{ fontSize: 12, background: C.panel2, border: "1px solid " + C.line, color: C.text, outline: "none" }}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => {
                  if (!text.trim()) return;
                  onTicket(it.k, { text: text.trim(), ref: ref.trim(), owner: (it.who || [])[0] || "" });
                  setText(""); setRef(""); setRaising(false);
                }}
                className="rounded px-2.5 py-1 font-medium"
                style={{ fontSize: 12, background: text.trim() ? C.pink : C.panel2, color: text.trim() ? C.bg : C.faint }}
              >
                Log blocker
              </button>
              <button onClick={() => { setRaising(false); setText(""); setRef(""); }} className="rounded px-2 py-1" style={{ fontSize: 12, color: C.muted }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Owner */}
      <div className="shrink-0">
        {editOwner ? (
          <select
            autoFocus
            defaultValue={(it.who || [])[0] || ""}
            onBlur={() => setEditOwner(false)}
            onChange={(e) => { onOwner(it.k, e.target.value || null); setEditOwner(false); }}
            className="rounded px-1 py-0.5"
            style={{ fontSize: 11, background: C.bg, border: "1px solid " + C.line, color: C.text }}
          >
            <option value="">Unassigned</option>
            {Object.entries(people || PEOPLE).map(([k, p]) => <option key={k} value={k}>{p.name}</option>)}
          </select>
        ) : (
          <button onClick={() => setEditOwner(true)} title="Reassign" className="flex items-center gap-1">
            {(it.who || []).length
              ? (it.who || []).map((pid) => <Avatar key={pid} id={pid} people={people} />)
              : <span className="rounded-full" style={{ width: 20, height: 20, border: "1.5px dashed " + C.faint, display: "block" }} />}
          </button>
        )}
      </div>
    </div>
  );
}
