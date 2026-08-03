"use client";
import React from "react";
import { Sparkles, Settings, LayoutGrid, FileText, Store, Users, BarChart3, Library as LibraryIcon } from "lucide-react";

const ICONS = { projects: LayoutGrid, translations: FileText, marketplace: Store, team: Users, reporting: BarChart3 };
import { C, NAV } from "@/lib/theme";

export function Sidebar({ section, setSection }) {
  const item = (id, label, Ic, isNew) => {
    const on = section === id;
    return (
      <button
        key={id}
        onClick={() => setSection(id)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors"
        style={{
          background: on ? C.brand + "22" : "transparent",
          border: "1px solid " + (on ? C.brand + "44" : "transparent"),
          color: on ? C.text : C.muted,
          fontWeight: on ? 500 : 400,
        }}
      >
        <Ic size={17} style={{ color: on ? C.violet : C.muted }} />
        {label}
        {isNew && (
          <span
            className="ml-auto mono px-1.5 py-0.5 rounded"
            style={{ fontSize: 9, background: C.brand, color: "#fff" }}
          >
            NEW
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className="hidden md:flex flex-col shrink-0"
      style={{ width: 220, background: C.sidebar, borderRight: "1px solid " + C.line }}
    >
      <div className="flex items-center gap-2 px-5 h-16" style={{ borderBottom: "1px solid " + C.line }}>
        <span
          className="rounded-lg flex items-center justify-center disp font-bold"
          style={{ width: 30, height: 30, background: "linear-gradient(135deg," + C.brand + "," + C.violet + ")", color: "#fff" }}
        >
          S
        </span>
        <span className="disp text-lg font-bold">Smartcat</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((n) => item(n.id, n.label, ICONS[n.id], false))}
        <div className="pt-3 mt-3" style={{ borderTop: "1px solid " + C.line }}>
          <div className="px-3 pb-2 mono uppercase tracking-wider" style={{ fontSize: 9, color: C.faint }}>
            Onboarding
          </div>
          {item("constellation", "Constellation", Sparkles, true)}
          {item("library", "Library", LibraryIcon, false)}
        </div>
      </nav>

      <div className="px-3 py-4" style={{ borderTop: "1px solid " + C.line }}>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-default" style={{ color: C.muted }}>
          <Settings size={17} /> Settings
        </div>
      </div>
    </aside>
  );
}

/* ────────────────────────────────────────────────────────────
   The non-Constellation surfaces — quiet, so the star stays the star
   ──────────────────────────────────────────────────────────── */
