"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";

function computeWeekLockTime(weekGames, deadlineMode) {
  if (weekGames.length === 0) return null;
  const dows = deadlineMode === "thursday" ? [4] : [0, 6];
  let candidates = weekGames.filter((g) => dows.includes(new Date(g.kickoff).getDay()));
  if (candidates.length === 0) candidates = weekGames;
  const earliest = candidates.reduce((min, g) => (new Date(g.kickoff) < new Date(min.kickoff) ? g : min));
  return new Date(new Date(earliest.kickoff).getTime() - 5 * 60000);
}

export default function PicksPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [entryIdx, setEntryIdx] = useState(0);
  const [week, setWeek] = useState(1);
  const [games, setGames] = useState([]);
  const [prevWeekGames, setPrevWeekGames] = useState([]);
  const [myPicks, setMyPicks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const entry = entries[entryIdx];

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        window.location.href = "/account";
        return;
      }
      const user = sessionData.session.user;
      const { data: entryRows } = await supabase.from("entries").select("*").eq("user_id", user.id).order("entry_number");
      const { data: settingsRow } = await supabase.from("league_settings").select("*").eq("id", 1).single();
      setEntries(entryRows || []);
      setSettings(settingsRow);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadWeekData() {
      if (!entry) return;
      const { data: gameRows } = await supabase.from("games").select("*").eq("week", week).order("kickoff");
      const { data: prevGameRows } = await supabase.from("games").select("*").eq("week", week - 1).order("kickoff");
      const { data: pickRows } = await supabase.from("picks").select("*").eq("entry_id", entry.id);
      setGames(gameRows || []);
      setPrevWeekGames(prevGameRows || []);
      setMyPicks(pickRows || []);
    }
    loadWeekData();
  }, [entry, week]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !settings) return <Shell><p>Loading…</p></Shell>;
  if (!entry) return <Shell><p>No entry found — visit /account first.</p></Shell>;

  const requiredPicks = settings.multi_pick_enabled && week >= settings.multi_pick_start_week ? 2 : 1;
  const currentWeekPicks = myPicks.filter((p) => p.week === week);
  const currentTeams = currentWeekPicks.map((p) => p.team);
  const usedTeams = new Set(myPicks.filter((p) => p.week !== week).map((p) => p.team));

  // Deadline lock
  const now = new Date();
  let weekLocked = false;
  if (settings.deadline_mode !== "none") {
    const lockTime = computeWeekLockTime(games, settings.deadline_mode);
    weekLocked = lockTime ? now >= lockTime : false;
  }
  const isGameLocked = (team) => {
    if (settings.deadline_mode !== "none") return weekLocked;
    const game = games.find((g) => g.away_team === team || g.home_team === team);
    return game ? now >= new Date(game.kickoff) : false;
  };

  // Prevent-same-team: block the team that would repeat last week's opponent matchup
  const restrictedTeams = new Set();
  if (settings.prevent_same_team && week > 1) {
    const lastWeekTeams = myPicks.filter((p) => p.week === week - 1).map((p) => p.team);
    lastWeekTeams.forEach((t) => {
      const lastGame = prevWeekGames.find((g) => g.away_team === t || g.home_team === t);
      const lastOpp = lastGame ? (lastGame.away_team === t ? lastGame.home_team : lastGame.away_team) : null;
      if (!lastOpp) return;
      const thisGame = games.find((g) => g.away_team === lastOpp || g.home_team === lastOpp);
      if (thisGame) restrictedTeams.add(thisGame.away_team === lastOpp ? thisGame.home_team : thisGame.away_team);
    });
  }

  // Future-picking: if off, only the earliest not-yet-picked week is editable
  let pickableWeek = true;
  if (!settings.future_picking) {
    const pickedWeeks = new Set(myPicks.map((p) => p.week));
    let nextUnpicked = 1;
    while (pickedWeeks.has(nextUnpicked) && nextUnpicked <= 18) nextUnpicked++;
    pickableWeek = week === nextUnpicked;
  }

  const pickTeam = async (team) => {
    if (usedTeams.has(team) || restrictedTeams.has(team) || isGameLocked(team) || !pickableWeek) return;
    setSaving(true);
    setMessage("");

    let nextTeams;
    if (currentTeams.includes(team)) {
      nextTeams = currentTeams.filter((t) => t !== team);
    } else {
      nextTeams = [...currentTeams, team];
      if (nextTeams.length > requiredPicks) nextTeams = nextTeams.slice(nextTeams.length - requiredPicks);
    }

    await supabase.from("picks").delete().eq("entry_id", entry.id).eq("week", week);
    if (nextTeams.length > 0) {
      await supabase.from("picks").insert(nextTeams.map((t) => ({ entry_id: entry.id, week, team: t, result: "pending" })));
    }
    const { data: pickRows } = await supabase.from("picks").select("*").eq("entry_id", entry.id);
    setMyPicks(pickRows || []);
    setMessage(nextTeams.length ? `Saved: ${nextTeams.join(", ")} for Week ${week}.` : `Cleared Week ${week}.`);
    setSaving(false);
  };

  return (
    <Shell>
      <h1 style={h1}>{settings.loser_pool ? "Pick who loses" : "Make your pick"}</h1>

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

      {requiredPicks > 1 && <p style={note}>Multiple pick selections is on — choose {requiredPicks} teams this week.</p>}
      {weekLocked && <p style={{ ...note, color: "var(--danger)" }}>This week's deadline has passed — picks are locked.</p>}
      {!pickableWeek && <p style={{ ...note, color: "var(--danger)" }}>Future picking is off — make your Week {week - 1 >= 1 ? "earlier" : ""} pick first.</p>}

      {currentTeams.length > 0 && <p style={{ color: "var(--turf)" }}>Current pick: <strong>{currentTeams.join(", ")}</strong></p>}
      {message && <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>{message}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {games.map((g) => (
          <div key={g.id} style={row}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)", width: 90 }}>
              {new Date(g.kickoff).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}
            </span>
            {[g.away_team, g.home_team].map((team, i) => {
              const disabled =
                saving ||
                !pickableWeek ||
                isGameLocked(team) ||
                restrictedTeams.has(team) ||
                (usedTeams.has(team) && !currentTeams.includes(team));
              const selected = currentTeams.includes(team);
              return (
                <button
                  key={team}
                  disabled={disabled}
                  onClick={() => pickTeam(team)}
                  title={restrictedTeams.has(team) ? "Would repeat last week's matchup" : usedTeams.has(team) ? "Already used this season" : ""}
                  style={{
                    ...teamBtn,
                    background: selected ? "var(--turf)" : disabled ? "rgba(28,28,28,0.08)" : "#fff",
                    color: selected ? "var(--chalk)" : disabled ? "rgba(28,28,28,0.35)" : "var(--ink)",
                  }}
                >
                  {team}{i === 0 ? " @" : ""}
                </button>
              );
            })}
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
const note = { fontSize: 13, color: "var(--ink-soft)" };
const select = { padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(28,28,28,0.2)" };
const arrowBtn = { width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--wood)", background: "#fff", cursor: "pointer" };
const row = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid rgba(28,28,28,0.1)", borderRadius: 8, background: "#fff" };
const teamBtn = { padding: "8px 12px", borderRadius: 6, border: "1px solid rgba(28,28,28,0.15)", cursor: "pointer", fontSize: 13 };
