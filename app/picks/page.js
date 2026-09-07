"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";

export default function PicksPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [entryIdx, setEntryIdx] = useState(0);
  const [week, setWeek] = useState(1);
  const [games, setGames] = useState([]);
  const [myPicks, setMyPicks] = useState([]); // all picks for this entry, all weeks
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const entry = entries[entryIdx];

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        window.location.href = "/account";
        return;
      }
      const { data: entryRows } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", authData.user.id)
        .order("entry_number");
      setEntries(entryRows || []);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadWeekData() {
      if (!entry) return;
      const { data: gameRows } = await supabase
        .from("games")
        .select("*")
        .eq("week", week)
        .order("kickoff");
      setGames(gameRows || []);

      const { data: pickRows } = await supabase
        .from("picks")
        .select("*")
        .eq("entry_id", entry.id);
      setMyPicks(pickRows || []);
    }
    loadWeekData();
  }, [entry, week]); // eslint-disable-line react-hooks/exhaustive-deps

  const usedTeams = new Set(
    myPicks.filter((p) => p.week !== week).map((p) => p.team)
  );
  const currentPick = myPicks.find((p) => p.week === week);

  const pickTeam = async (team) => {
    if (usedTeams.has(team)) return;
    setSaving(true);
    setMessage("");

    // Single-pick mode for now: clear any existing pick(s) for this week, then insert the new one.
    await supabase.from("picks").delete().eq("entry_id", entry.id).eq("week", week);
    const { error } = await supabase
      .from("picks")
      .insert({ entry_id: entry.id, week, team, result: "pending" });

    if (error) {
      setMessage(error.message);
    } else {
      const { data: pickRows } = await supabase.from("picks").select("*").eq("entry_id", entry.id);
      setMyPicks(pickRows || []);
      setMessage(`Saved: ${team} for Week ${week}.`);
    }
    setSaving(false);
  };

  if (loading) return <Shell><p>Loading…</p></Shell>;
  if (!entry) return <Shell><p>No entry found — visit /account first.</p></Shell>;

  return (
    <Shell>
      <h1 style={h1}>Make your pick</h1>

      {entries.length > 1 && (
        <select value={entryIdx} onChange={(e) => setEntryIdx(Number(e.target.value))} style={select}>
          {entries.map((e, i) => <option key={e.id} value={i}>Entry {i + 1}</option>)}
        </select>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0" }}>
        <button onClick={() => setWeek((w) => Math.max(1, w - 1))} style={arrowBtn}>←</button>
        <strong>Week {week}</strong>
        <button onClick={() => setWeek((w) => Math.min(18, w + 1))} style={arrowBtn}>→</button>
      </div>

      {currentPick && <p style={{ color: "var(--turf)" }}>Current pick: <strong>{currentPick.team}</strong></p>}
      {message && <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>{message}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {games.map((g) => (
          <div key={g.id} style={row}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)", width: 90 }}>
              {new Date(g.kickoff).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
            </span>
            {[g.away_team, g.home_team].map((team, i) => (
              <button
                key={team}
                disabled={saving || (usedTeams.has(team) && currentPick?.team !== team)}
                onClick={() => pickTeam(team)}
                style={{
                  ...teamBtn,
                  background: currentPick?.team === team ? "var(--turf)" : usedTeams.has(team) ? "rgba(28,28,28,0.08)" : "#fff",
                  color: currentPick?.team === team ? "var(--chalk)" : usedTeams.has(team) ? "rgba(28,28,28,0.35)" : "var(--ink)",
                }}
              >
                {team}{i === 0 ? " @" : ""}
              </button>
            ))}
          </div>
        ))}
        {games.length === 0 && <p>No games found for this week yet.</p>}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>{children}</div>;
}
const h1 = { fontSize: 22, marginBottom: 8 };
const select = { padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(28,28,28,0.2)" };
const arrowBtn = { width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--wood)", background: "#fff", cursor: "pointer" };
const row = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid rgba(28,28,28,0.1)", borderRadius: 8, background: "#fff" };
const teamBtn = { padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(28,28,28,0.15)", cursor: "pointer", fontSize: 13 };
