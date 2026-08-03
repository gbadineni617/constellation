"use client";

import React, { useState } from "react";

import { JourneyView } from "./journey/JourneyView";

import { ChooseScreen, PastJourneys, Intake, Building, Replicate } from "./hub";

import { ArrowLeft } from "lucide-react";

import { C } from "@/lib/theme";

import { buildJourney } from "@/lib/journey";



export function Constellation({ records, setRecords, view, setView, activeId, setActiveId }) {
  const [contentPath, setContentPath] = useState("e-Learning");
  const [maturity, setMaturity] = useState("greenfield");
  const [delivery, setDelivery] = useState("manual");
  const [connector, setConnector] = useState("");
  const [plan, setPlan] = useState(null);
  const [acceptedClaims, setAcceptedClaims] = useState([]);
  const [sourceName, setSourceName] = useState("");
  const [market, setMarket] = useState({ reviewModel: "unknown", specialization: "", turnaround: "Standard", pairs: [], industry: "" });
  const [form, setForm] = useState({ name: "", useCase: "", pain: "", goLive: "", metrics: "", team: "", integrations: "" });
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const active = records.find((r) => r.id === activeId);

  const loadExample = () => {
    setForm({
      name: "Walmart Supplier Academy",
      useCase: "Translate Supplier Academy L&D (SCORM / Rise / Storyline) to launch non-English markets.",
      pain: "Every course goes out to a vendor by email and comes back three weeks later, one language at a time.",
      goLive: "Early August · Grow with Walmart Canada (fr-CA) first",
      metrics: "Speed to market · on-time course delivery · translation quality",
      team: "Kat (Dir.), Phillip, Cody, Ryan (CA reviewer), Paul (FDE), James (AM)",
      integrations: "Airtable (via API); MX/CAM + Chile microsites later",
    });
    setContentPath("e-Learning");
    setMaturity("greenfield");
    setDelivery("manual");
    setPlan(null);
    setAcceptedClaims([]);
    setSourceName("");
    setMarket({ reviewModel: "unknown", specialization: "", turnaround: "Standard", pairs: [], industry: "" });
  };

  /** Take what the model pulled out of a document and put it into the form. */
  const applyExtraction = (r) => {
    setForm((f) => ({ ...f, ...r.fields }));
    setContentPath(r.contentPath);
    setMaturity(r.maturity);
    setDelivery(r.delivery);
    setConnector(r.connector || "");
    setPlan(r.plan || null);
    // Evidenced claims start accepted; the review panel can revise this.
    setAcceptedClaims((r.plan?.claims || []).filter((x) => x.evidence));
    setSourceName(r.sourceName || "");
    setMarket({ reviewModel: r.reviewModel, specialization: r.specialization, turnaround: r.turnaround, pairs: r.pairs || [], industry: r.fields?.industry || "" });
  };

  const generate = () => {
    const id = "j" + Date.now();
    const accepted = new Set(acceptedClaims.map((x) => x.k));
    const rec = {
      id,
      customer: form.name || "New customer",
      useCase: form.useCase || "Localize content to launch into new markets.",
      goLive: form.goLive || "To be confirmed",
      contentPath, maturity, delivery, connector,
      reviewModel: market.reviewModel, specialization: market.specialization,
      turnaround: market.turnaround, pairs: market.pairs, industry: market.industry,
      fde: "Gagan Reddy",
      segment: "NA Enterprise",
      team: ["kat", "paul", "jackie"],
      updated: "Today",
      stage: plan ? plan.stage : "prep",
      stageProgress: 0.6,
      health: [0, 0, 0, 0, 0, 0],
      // A designed journey carries its own phases; without one we fall back to the template
      ...(plan
        ? {
            // Only the claims a human accepted survive. Anything unticked reverts
            // to open — a journey must never say a step is done on the model's word alone.
            phases: plan.phases.map((p) => ({
              ...p,
              steps: p.steps.map((st) => {
                const claimed = st.status === "done" || st.status === "active";
                if (!claimed) return st;
                return accepted.has(st.k) ? st : { ...st, status: "open", evidence: "" };
              }),
            })),
            people: plan.people,
            rationale: plan.rationale,
            generatedFrom: sourceName || "your document",
            // Snapshot of what was generated, before anyone edited it. The diff between
            // this and `phases` is the FDE's judgement, and it is the strongest signal
            // the corpus has — see editSignal() in lib/corpus.js.
            planOriginal: { phases: plan.phases },
          }
        : {}),
      nudge:
        (form.pain ? "You logged this as the pain to remove: " + form.pain + " " : "") +
        "Kickoff is the next gate — confirm the content-type path and set a weekly cadence to light the second star.",
      notes: {
        goals: form.useCase || "",
        who: form.team || "",
        welcome: form.metrics ? "Success = " + form.metrics : "",
        provision: form.integrations ? "Integrations in scope: " + form.integrations : "",
      },
    };
    setRecords((rs) => [rec, ...rs]);
    setActiveId(id);
    setView("building");
    setTimeout(() => setView("journey"), 1900);
  };

  const setAxis = (key, val) =>
    setRecords((rs) => rs.map((r) => (r.id === activeId ? { ...r, [key]: val } : r)));

  if (view === "building") return <Building name={form.name || "the customer"} />;

  const siblingsOf = (r) => records.filter((x) => x.org === r.org).length;

  const replicate = ({ name, useCase, goLive, contentPath: cp, carries }) => {
    const id = "j" + Date.now();
    const rec = {
      id,
      customer: name || active.org + " · new team",
      org: active.org,
      useCase: useCase || "Adopting the pipeline " + active.customer + " already proved out.",
      goLive: goLive || "To be confirmed",
      contentPath: cp, maturity: active.maturity, delivery: active.delivery, connector: active.connector,
      fde: active.fde, segment: active.segment,
      team: active.team.slice(0, 2),
      updated: "Today",
      stage: "kickoff", stageProgress: 0.3,
      startDate: "2026-07-26", lastActivityDate: "2026-07-26",
      ownerName: "the new team lead",
      health: (active.health || []).map((h) => Math.round(h * 0.85)),
      inheritedFrom: { id: active.id, customer: active.customer, carries },
      notes: {},
    };
    setRecords((rs) => [rec, ...rs]);
    setActiveId(id);
    setView("building");
    setTimeout(() => setView("journey"), 1900);
  };

  if (view === "replicate" && active) {
    return <Replicate parent={active} records={records} onCancel={() => setView("journey")} onCreate={replicate} />;
  }

  if (view === "journey" && active) {
    return (
      <JourneyView
        rec={active}
        onBack={() => setView("past")}
        onAxis={setAxis}
        onReplicate={() => setView("replicate")}
        siblings={siblingsOf(active)}
        onPatch={(fn) => setRecords((rs) => rs.map((r) => (r.id === activeId ? fn(r) : r)))}
      />
    );
  }

  if (view === "past") {
    return (
      <PastJourneys
        records={records}
        onOpen={(id) => { setActiveId(id); setView("journey"); }}
        onBack={() => setView("choose")}
        onNew={() => setView("intake")}
      />
    );
  }

  if (view === "intake") {
    return (
      <div className="fade">
        <button onClick={() => setView("choose")} className="inline-flex items-center gap-1.5 text-sm mb-4" style={{ color: C.muted }}>
          <ArrowLeft size={15} /> Constellation
        </button>
        <h1 className="disp text-2xl font-bold">Tell Constellation about the customer</h1>
        <p className="text-sm mt-1 mb-6" style={{ color: C.muted }}>
          The essentials are enough — it assembles the phases, sessions, and go-live gates from there.
        </p>
        <Intake
          form={form} setF={setF}
          contentPath={contentPath} setContentPath={setContentPath}
          maturity={maturity} setMaturity={setMaturity}
          delivery={delivery} setDelivery={setDelivery}
          onLoadExample={loadExample}
          onExtracted={applyExtraction}
          onProgressChange={setAcceptedClaims}
          onGenerate={generate}
        />
      </div>
    );
  }

  return <ChooseScreen records={records} onNew={() => setView("intake")} onPast={() => setView("past")} />;
}

/* ────────────────────────────────────────────────────────────
   App shell
   ──────────────────────────────────────────────────────────── */
