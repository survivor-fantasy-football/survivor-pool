"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [settings, setSettings] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (user) {
        const { data: profile } = await supabase.from("users").select("is_commissioner").eq("id", user.id).maybeSingle();
        setIsCommissioner(!!profile?.is_commissioner);
      }
      const { data: settingsRow } = await supabase.from("league_settings").select("*").eq("id", 1).single();
      setSettings(settingsRow);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key, value) => setSettings((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setMessage("");
    const { error } = await supabase.from("league_settings").update(settings).eq("id", 1);
    setMessage(error ? error.message : "Saved.");
  };

  if (loading || !settings) return <Shell><p>Loading…</p></Shell>;

  return (
    <Shell>
      <h1 style={h1}>Settings</h1>
      {!isCommissioner && <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>Read-only — only the commissioner can change these.</p>}

      <Field label="League name">
        <input disabled={!isCommissioner} value={settings.league_name} onChange={(e) => set("league_name", e.target.value)} style={input} />
      </Field>

      <Field label="Entries allowed per player">
        <input disabled={!isCommissioner} type="number" min={1} max={10} value={settings.entries_allowed} onChange={(e) => set("entries_allowed", Number(e.target.value))} style={numInput} />
      </Field>

      <Field label="Mulligans (strikes allowed)">
        <input disabled={!isCommissioner} type="number" min={0} max={3} value={settings.mulligans} onChange={(e) => set("mulligans", Number(e.target.value))} style={numInput} />
      </Field>

      <Field label="Pick deadline">
        <select disabled={!isCommissioner} value={settings.deadline_mode} onChange={(e) => set("deadline_mode", e.target.value)} style={input}>
          <option value="thursday">5 min before Thursday night kickoff</option>
          <option value="weekend">5 min before the first Sat/Sun game</option>
          <option value="none">No deadline — lock team-by-team as games start</option>
        </select>
      </Field>

      <CheckField label="Loser pool" disabled={!isCommissioner} checked={settings.loser_pool} onChange={(v) => set("loser_pool", v)} />
      <CheckField label="Future picking allowed" disabled={!isCommissioner} checked={settings.future_picking} onChange={(v) => set("future_picking", v)} />
      <CheckField label="Prevent picking against the same team back-to-back" disabled={!isCommissioner} checked={settings.prevent_same_team} onChange={(v) => set("prevent_same_team", v)} />
      <CheckField label="Require 2 picks per week (multiple pick selections)" disabled={!isCommissioner} checked={settings.multi_pick_enabled} onChange={(v) => set("multi_pick_enabled", v)} />
      {settings.multi_pick_enabled && (
        <Field label="Starting week for 2-pick requirement">
          <input disabled={!isCommissioner} type="number" min={1} max={18} value={settings.multi_pick_start_week} onChange={(e) => set("multi_pick_start_week", Number(e.target.value))} style={numInput} />
        </Field>
      )}
      <CheckField label="Play a postseason round" disabled={!isCommissioner} checked={settings.postseason} onChange={(v) => set("postseason", v)} />
      {settings.postseason && (
        <CheckField label="Postseason pick 'em (all teams, every round)" disabled={!isCommissioner} checked={settings.postseason_pick_em} onChange={(v) => set("postseason_pick_em", v)} />
      )}

      {isCommissioner && <button onClick={save} style={button}>Save changes</button>}
      {message && <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>{message}</p>}
    </Shell>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}
function CheckField({ label, checked, onChange, disabled }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 14, opacity: disabled ? 0.6 : 1 }}>
      <input type="checkbox" disabled={disabled} checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
function Shell({ children }) {
  return <div style={{ maxWidth: 480, margin: "40px auto", padding: 24 }}>{children}</div>;
}
const h1 = { fontSize: 22, marginBottom: 12 };
const input = { padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(28,28,28,0.2)", width: "100%" };
const numInput = { ...input, width: 80 };
const button = { padding: "10px 18px", borderRadius: 6, border: "none", background: "var(--turf)", color: "var(--chalk)", fontWeight: 700, cursor: "pointer" };
