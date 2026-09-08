"use client";

import { useEffect, useState } from "react";

const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

export default function StandingsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [picksByEntry, setPicksByEntry] = useState({});

  useEffect(() => {
    fetch("/api/standings")
      .then((r) => r.json())
      .then((data) => {
        setRows(data.rows || []);
        setPicksByEntry(data.picksByEntry || {});
        setLoading(false);
      });
  }, []);

  if (loading) return <Shell><p>Loading…</p></Shell>;

  const alive = rows.filter((r) => r.alive);
  const eliminated = rows.filter((r) => !r.alive);

  const renderRow = (row) => (
    <tr key={row.id}>
      <td style={{ ...td, position: "sticky", left: 0, background: "var(--chalk)", textAlign: "left", fontWeight: 700, color: row.alive ? "var(--ink)" : "var(--danger)", whiteSpace: "nowrap" }}>
        {row.label}
      </td>
      {WEEKS.map((w) => {
        const picksThisWeek = picksByEntry[row.id]?.[w] || [];
        const hasStrike = picksThisWeek.some((p) => p.result === "loss");
        const anyPick = picksThisWeek.length > 0;
        const revealed = picksThisWeek.some((p) => p.team);
        return (
          <td key={w} style={{ ...td, color: !anyPick ? "rgba(28,28,28,0.3)" : hasStrike ? "var(--danger)" : "var(--ink)" }}>
            {!anyPick ? "–" : revealed ? picksThisWeek.map((p) => p.team).join(" / ") : "✓"}
          </td>
        );
      })}
    </tr>
  );

  return (
    <Shell wide>
      <h1 style={h1}>Standings — {alive.length} alive of {rows.length}</h1>
      <div style={{ overflowX: "auto", border: "1px solid rgba(28,28,28,0.1)", borderRadius: 8, marginTop: 16 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
          <thead>
            <tr>
              <th style={{ ...th, position: "sticky", left: 0, textAlign: "left" }}>Entry</th>
              {WEEKS.map((w) => <th key={w} style={th}>W{w}</th>)}
            </tr>
          </thead>
          <tbody>
            {alive.map(renderRow)}
            {eliminated.length > 0 && (
              <tr><td colSpan={19} style={{ padding: "8px 10px", background: "rgba(178,58,46,0.08)", fontWeight: 700, fontSize: 12, color: "var(--danger)" }}>ELIMINATED</td></tr>
            )}
            {eliminated.map(renderRow)}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 10 }}>
        ✓ means a pick exists but isn't revealed yet — it unlocks into the real team name once that week's deadline passes. "–" means no pick at all.
      </p>
    </Shell>
  );
}

function Shell({ children, wide }) {
  return <div style={{ maxWidth: wide ? 1000 : 560, margin: "40px auto", padding: 24 }}>{children}</div>;
}
const h1 = { fontSize: 22 };
const th = { padding: "8px 10px", background: "var(--turf)", color: "var(--chalk)", fontSize: 11.5, fontWeight: 700 };
const td = { padding: "8px 10px", borderTop: "1px solid rgba(28,28,28,0.08)", textAlign: "center", whiteSpace: "nowrap" };
