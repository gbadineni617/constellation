"use client";
import React, { useState } from "react";
import { ChevronRight, Database, HardDrive, Loader2, AlertCircle } from "lucide-react";
import { C, NAV } from "@/lib/theme";
import { useJourneys } from "@/lib/useJourneys";
import { Sidebar } from "@/components/Sidebar";
import { Constellation } from "@/components/Constellation";
import { Library } from "@/components/Library";
import { ProjectsSurface, TranslationsSurface, MarketplaceSurface, TeamSurface, ReportingSurface } from "@/components/surfaces";

export default function Page() {
  const [section, setSection] = useState("constellation");
  const { records, setRecords, status, mode, saving, error } = useJourneys();
  const [view, setView] = useState("choose");
  const [activeId, setActiveId] = useState(null);

  const active = records.find((r) => r.id === activeId);
  const navLabel = section === "constellation" ? "Constellation" : section === "library" ? "Library" : (NAV.find((n) => n.id === section) || {}).label;

  const CRUMB = { intake: "New journey", building: "New journey", past: "Past journeys", replicate: "Replicate" };
  const crumbs =
    section !== "constellation"
      ? ["Workspace", navLabel]
      : view === "journey" && active
      ? ["Constellation", "Past journeys", active.customer]
      : view === "replicate" && active
      ? ["Constellation", active.customer, "Replicate"]
      : CRUMB[view]
      ? ["Constellation", CRUMB[view]]
      : ["Constellation"];

  return (
    <div style={{ background: C.bg, color: C.text, minHeight: "100vh" }} className="flex">

      <Sidebar section={section} setSection={(s) => { setSection(s); if (s === "constellation" && view === "building") setView("choose"); }} />

      <main className="flex-1 min-w-0">
        <div className="flex items-center gap-2 px-5 h-16" style={{ borderBottom: "1px solid " + C.line }}>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <ChevronRight size={14} style={{ color: C.faint }} />}
              <span className="text-sm truncate" style={{ color: i === crumbs.length - 1 ? C.text : C.muted, fontWeight: i === crumbs.length - 1 ? 500 : 400 }}>
                {c}
              </span>
            </React.Fragment>
          ))}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span
              className="mono text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
              title={mode === "postgres" ? "Saved to Postgres" : "In memory only — changes are lost on restart"}
              style={{
                background: C.panel,
                color: saving ? C.violet : mode === "postgres" ? C.teal : C.amber,
              }}
            >
              {saving ? <Loader2 size={11} className="spin" /> : mode === "postgres" ? <Database size={11} /> : <HardDrive size={11} />}
              {saving ? "Saving" : mode === "postgres" ? "Saved" : "Not saved"}
            </span>
            <span className="rounded-full flex items-center justify-center disp text-xs font-bold" style={{ width: 30, height: 30, background: C.teal, color: C.bg }}>
              GR
            </span>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-5 py-7">
          {status === "loading" && (
            <div className="flex items-center gap-3 py-20 justify-center" style={{ color: C.muted }}>
              <Loader2 size={18} className="spin" /> Loading your journeys…
            </div>
          )}

          {status === "error" && (
            <div className="rounded-2xl p-5 flex items-start gap-3" style={{ background: C.panel, border: "1px solid " + C.pink + "55" }}>
              <AlertCircle size={18} style={{ color: C.pink, flexShrink: 0, marginTop: 1 }} />
              <div>
                <div className="text-sm">Could not load your journeys.</div>
                <div className="text-xs mt-1" style={{ color: C.faint }}>{error}</div>
              </div>
            </div>
          )}

          {status === "ready" && mode === "memory" && (
            <div className="rounded-xl px-4 py-3 mb-5 flex items-start gap-2.5" style={{ background: C.amber + "12", border: "1px solid " + C.amber + "3D" }}>
              <HardDrive size={15} style={{ color: C.amber, flexShrink: 0, marginTop: 1 }} />
              <div className="text-xs">
                <span style={{ color: C.text }}>Running without a database.</span>
                <span style={{ color: C.muted }}> Everything works, but changes disappear when the server restarts. Set <span className="mono">DATABASE_URL</span> in <span className="mono">.env.local</span> to keep them.</span>
              </div>
            </div>
          )}

          {status === "ready" && section === "constellation" && (
            <Constellation
              records={records} setRecords={setRecords}
              view={view} setView={setView}
              activeId={activeId} setActiveId={setActiveId}
            />
          )}
          {status === "ready" && section === "library" && <Library records={records} />}
          {status === "ready" && section === "projects" && <ProjectsSurface />}
          {status === "ready" && section === "translations" && <TranslationsSurface />}
          {status === "ready" && section === "marketplace" && <MarketplaceSurface />}
          {status === "ready" && section === "team" && <TeamSurface />}
          {status === "ready" && section === "reporting" && <ReportingSurface records={records} />}
        </div>
      </main>
    </div>
  );
}
