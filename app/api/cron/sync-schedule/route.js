import { NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabaseServer";

// Pulls weeks 1-18 of the current NFL regular season from ESPN's public
// scoreboard API and upserts them into the `games` table.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const providedSecret = searchParams.get("secret");
  const expected = process.env.CRON_SECRET;

  const authorized =
    authHeader === `Bearer ${expected}` || providedSecret === expected;
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // NFL season is labeled by the year it STARTS in (e.g. games in Jan 2027
  // belong to the "2026" season). Adjust for Jan/Feb.
  const seasonYear = now.getMonth() <= 1 ? now.getFullYear() - 1 : now.getFullYear();

  const supabase = createAdminClient();
  let totalSynced = 0;
  const errors = [];

  for (let week = 1; week <= 18; week++) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&year=${seasonYear}`;
      const res = await fetch(url);
      const json = await res.json();

      const rows = (json.events || []).map((event) => {
        const comp = event.competitions[0];
        const away = comp.competitors.find((c) => c.homeAway === "away");
        const home = comp.competitors.find((c) => c.homeAway === "home");
        const stateMap = { pre: "scheduled", in: "in_progress", post: "final" };
        const winnerSide = comp.competitors.find((c) => c.winner === true);

        return {
          id: event.id,
          week,
          kickoff: event.date,
          away_team: away?.team?.name || away?.team?.shortDisplayName || "Unknown",
          home_team: home?.team?.name || home?.team?.shortDisplayName || "Unknown",
          international: !!comp.neutralSite,
          status: stateMap[event.status?.type?.state] || "scheduled",
          winner: winnerSide ? winnerSide.team?.name : null,
        };
      });

      if (rows.length > 0) {
        const { error } = await supabase.from("games").upsert(rows, { onConflict: "id" });
        if (error) errors.push(`week ${week}: ${error.message}`);
        else totalSynced += rows.length;
      }
    } catch (e) {
      errors.push(`week ${week}: ${e.message}`);
    }
  }

  return NextResponse.json({ seasonYear, totalSynced, errors });
}
