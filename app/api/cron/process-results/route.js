import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseServer";

function computeWeekLockTime(weekGames, deadlineMode) {
  if (weekGames.length === 0) return null;
  const dows = deadlineMode === "thursday" ? [4] : [0, 6];
  let candidates = weekGames.filter((g) => dows.includes(new Date(g.kickoff).getDay()));
  if (candidates.length === 0) candidates = weekGames;
  const earliest = candidates.reduce((min, g) => (new Date(g.kickoff) < new Date(min.kickoff) ? g : min));
  return new Date(new Date(earliest.kickoff).getTime() - 5 * 60000);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const providedSecret = searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  if (authHeader !== `Bearer ${expected}` && providedSecret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: settings } = await supabase.from("league_settings").select("*").eq("id", 1).single();
  const { data: games } = await supabase.from("games").select("*");
  const { data: entries } = await supabase.from("entries").select("*");
  const { data: picks } = await supabase.from("picks").select("*");

  const gamesByWeek = {};
  (games || []).forEach((g) => {
    gamesByWeek[g.week] = gamesByWeek[g.week] || [];
    gamesByWeek[g.week].push(g);
  });

  const now = new Date();
  const results = { picksGraded: 0, strikesAdded: 0, eliminated: 0 };

  async function applyStrike(entryId) {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry || !entry.alive) return;
    const newStrikes = (entry.strikes || 0) + 1;
    const stillAlive = newStrikes <= settings.mulligans;
    await supabase.from("entries").update({ strikes: newStrikes, alive: stillAlive }).eq("id", entryId);
    entry.strikes = newStrikes;
    entry.alive = stillAlive;
    results.strikesAdded++;
    if (!stillAlive) results.eliminated++;
  }

  // 1. Grade any pending pick whose game has gone final.
  for (const p of picks || []) {
    if (p.result !== "pending") continue;
    const game = (gamesByWeek[p.week] || []).find((g) => g.away_team === p.team || g.home_team === p.team);
    if (!game || game.status !== "final" || !game.winner) continue;

    const won = settings.loser_pool ? p.team !== game.winner : p.team === game.winner;
    await supabase.from("picks").update({ result: won ? "win" : "loss" }).eq("id", p.id);
    results.picksGraded++;
    if (!won) await applyStrike(p.entry_id);
  }

  // 2. Any alive entry with NO pick for a week whose deadline has already passed gets a strike too.
  const hasPick = {};
  (picks || []).forEach((p) => { hasPick[`${p.entry_id}-${p.week}`] = true; });

  for (const entry of entries || []) {
    if (!entry.alive) continue;
    for (let week = 1; week <= 18; week++) {
      const weekGames = gamesByWeek[week] || [];
      if (weekGames.length === 0) continue;

      let locked;
      if (settings.deadline_mode === "none") {
        locked = weekGames.every((g) => now >= new Date(g.kickoff));
      } else {
        const lockTime = computeWeekLockTime(weekGames, settings.deadline_mode);
        locked = lockTime ? now >= lockTime : false;
      }
      if (!locked) continue;

      const key = `${entry.id}-${week}`;
      if (hasPick[key]) continue;

      await supabase.from("picks").insert({ entry_id: entry.id, week, team: "NO PICK", result: "loss" });
      hasPick[key] = true;
      await applyStrike(entry.id);
    }
  }

  return NextResponse.json(results);
}
