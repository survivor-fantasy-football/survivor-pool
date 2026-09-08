import { NextResponse } from "next/server";
import { createAdminClient } from "../../../lib/supabaseServer";

function computeLockTime(weekGames, deadlineMode) {
  if (weekGames.length === 0) return null;
  const dows = deadlineMode === "thursday" ? [4] : [0, 6];
  let candidates = weekGames.filter((g) => dows.includes(new Date(g.kickoff).getDay()));
  if (candidates.length === 0) candidates = weekGames;
  const earliest = candidates.reduce((min, g) => (new Date(g.kickoff) < new Date(min.kickoff) ? g : min));
  return new Date(new Date(earliest.kickoff).getTime() - 5 * 60000);
}

export async function GET() {
  const supabase = createAdminClient();

  const [{ data: users }, { data: entries }, { data: picks }, { data: games }, { data: settingsRow }] =
    await Promise.all([
      supabase.from("users").select("id, name"),
      supabase.from("entries").select("*").order("entry_number"),
      supabase.from("picks").select("*"),
      supabase.from("games").select("*"),
      supabase.from("league_settings").select("*").eq("id", 1).single(),
    ]);

  const deadlineMode = settingsRow?.deadline_mode || "weekend";
  const now = new Date();
  const gamesByWeek = {};
  (games || []).forEach((g) => {
    gamesByWeek[g.week] = gamesByWeek[g.week] || [];
    gamesByWeek[g.week].push(g);
  });

  const usersById = Object.fromEntries((users || []).map((u) => [u.id, u]));
  const countByUser = {};
  (entries || []).forEach((e) => { countByUser[e.user_id] = (countByUser[e.user_id] || 0) + 1; });

  const rows = (entries || []).map((e) => {
    const name = usersById[e.user_id]?.name || "Unknown";
    const label = countByUser[e.user_id] > 1 ? `${name} — Entry ${e.entry_number}` : name;
    return { id: e.id, alive: e.alive, label };
  });

  const picksByEntry = {};
  (picks || []).forEach((p) => {
    const weekGames = gamesByWeek[p.week] || [];
    let locked;
    if (deadlineMode === "none") {
      const game = weekGames.find((g) => g.away_team === p.team || g.home_team === p.team);
      locked = game ? now >= new Date(game.kickoff) : false;
    } else {
      const lockTime = computeLockTime(weekGames, deadlineMode);
      locked = lockTime ? now >= lockTime : false;
    }

    picksByEntry[p.entry_id] = picksByEntry[p.entry_id] || {};
    picksByEntry[p.entry_id][p.week] = picksByEntry[p.entry_id][p.week] || [];
    picksByEntry[p.entry_id][p.week].push({
      team: locked ? p.team : null,
      result: locked ? p.result : null,
    });
  });

  return NextResponse.json({ rows, picksByEntry });
}
