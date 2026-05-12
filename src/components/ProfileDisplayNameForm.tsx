"use client";

import { useState } from "react";

export function ProfileDisplayNameForm({ initialDisplayName }: { initialDisplayName: string | null }) {
  const [value, setValue] = useState(initialDisplayName ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ displayName: value.trim() === "" ? null : value }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMsg(json.error || `HTTP ${res.status}`);
        return;
      }
      setMsg("Saved.");
      window.setTimeout(() => setMsg(null), 2400);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <label className="block text-sm font-medium text-slate-200">
        Display name
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={80}
          className="theme-input mt-1 w-full max-w-md rounded-lg border border-white/25 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400/50"
          placeholder="Shown on your posts (optional)"
          autoComplete="nickname"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-3 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:opacity-50"
      >
        {busy ? "…" : "Save"}
      </button>
      {msg ? <p className="mt-2 text-sm text-emerald-300/90">{msg}</p> : null}
    </div>
  );
}
