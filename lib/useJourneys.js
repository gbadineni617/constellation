"use client";

import { useState, useEffect, useRef } from "react";
import { readJson, apiFetch } from "./http";

/**
 * Loads journeys from the server and writes changes back.
 *
 * Saving is optimistic and debounced: the UI updates immediately, and whatever
 * actually changed is persisted a moment later. Every existing call site that
 * used setRecords keeps working unchanged — the saving happens by watching the
 * array, not by asking callers to remember to save.
 */
export function useJourneys() {
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [mode, setMode] = useState(null);          // postgres | memory
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const lastSaved = useRef(new Map());   // id -> serialised copy at last save
  const timer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/journeys");
        const data = await readJson(res);
        if (cancelled) return;
        for (const r of data.journeys) lastSaved.current.set(r.id, JSON.stringify(r));
        setRecords(data.journeys);
        setMode(data.mode);
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e.message || String(e));
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status !== "ready") return;

    const dirty = records.filter((r) => lastSaved.current.get(r.id) !== JSON.stringify(r));
    if (!dirty.length) return;

    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaving(true);
      for (const rec of dirty) {
        try {
          const res = await apiFetch("/api/journeys/" + encodeURIComponent(rec.id), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(rec),
          });
          if (!res.ok) throw new Error("save failed");
          lastSaved.current.set(rec.id, JSON.stringify(rec));
        } catch {
          setError("Some changes could not be saved.");
        }
      }
      setSaving(false);
    }, 700);

    return () => clearTimeout(timer.current);
  }, [records, status]);

  return { records, setRecords, status, mode, saving, error };
}
