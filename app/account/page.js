"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";

export default function AccountPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      let { data } = await supabase.auth.getUser();

      // No session at all yet? Create an anonymous one automatically —
      // no email, no waiting, no rate limit.
      if (!data.user) {
        const { data: anon, error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) {
          setError(anonError.message);
          setLoading(false);
          return;
        }
        data = { user: anon.user };
      }

      setAuthUser(data.user);

      const { data: row } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .maybeSingle();
      setProfile(row || null);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const completeProfile = async (e) => {
  e.preventDefault();
  setError("");
  if (!name.trim() || !email.trim()) {
    setError("Enter your name and email.");
    return;
  }
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .insert({ id: authUser.id, email: email.trim(), name: name.trim() })
    .select()
    .single();
  if (userError) {
    setError(userError.message);
    return;
  }
  // Every account starts with one entry automatically.
  await supabase
    .from("entries")
    .insert({ user_id: authUser.id, entry_number: 1 });

  setProfile(userRow);
};

  if (loading) return <Shell><p>Loading…</p></Shell>;

  // Session exists, but no profile row yet — first visit on this browser.
  if (!profile) {
    return (
      <Shell>
        <h1 style={h1}>Join the pool</h1>
        <p>What name should show up, and what email should we use for notifications?</p>
        <form onSubmit={completeProfile} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={input}
          />
          <button type="submit" style={{ ...button, alignSelf: "flex-start" }}>Join the pool</button>
        </form>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={h1}>My account</h1>
      <p><strong>{profile.name}</strong><br />{profile.email}</p>
      <p style={{ marginTop: 24, color: "var(--ink-soft)", fontSize: 14 }}>
        Entries, picks, and standings land here in the next build phase.
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return <div style={{ maxWidth: 480, margin: "60px auto", padding: 24 }}>{children}</div>;
}
const h1 = { fontSize: 22, marginBottom: 16 };
const input = { padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(28,28,28,0.2)", fontSize: 14 };
const button = { padding: "10px 18px", borderRadius: 6, border: "none", background: "var(--turf)", color: "var(--chalk)", fontWeight: 700, fontSize: 14, cursor: "pointer" };
