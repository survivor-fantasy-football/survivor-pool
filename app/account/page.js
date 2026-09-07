"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabaseClient";

export default function AccountPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [authUser, setAuthUser] = useState(null); // the Supabase auth session user
  const [profile, setProfile] = useState(null); // our public.users row

  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getUser();
      setAuthUser(data.user || null);

      if (data.user) {
        const { data: row } = await supabase
          .from("users")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();
        setProfile(row || null);
      }
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });
    if (error) setError(error.message);
    else setLinkSent(true);
  };

  const completeProfile = async (e) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    const { data, error } = await supabase
      .from("users")
      .insert({ id: authUser.id, email: authUser.email, name: name.trim() })
      .select()
      .single();
    if (error) setError(error.message);
    else setProfile(data);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
    setProfile(null);
  };

  if (loading) return <Shell><p>Loading…</p></Shell>;

  // Not logged in yet — this is the "sign up / log in" screen.
  if (!authUser) {
    return (
      <Shell>
        <h1 style={h1}>Last One Standing</h1>
        {linkSent ? (
          <p>Check <strong>{email}</strong> for a sign-in link.</p>
        ) : (
          <form onSubmit={sendMagicLink} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
            <button type="submit" style={button}>Email me a sign-in link</button>
          </form>
        )}
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </Shell>
    );
  }

  // Logged in, but this is the very first visit — we know their email
  // (from the magic link) but not their name yet.
  if (!profile) {
    return (
      <Shell>
        <h1 style={h1}>One more thing</h1>
        <p>What name should show up in the pool?</p>
        <form onSubmit={completeProfile} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />
          <button type="submit" style={button}>Join the pool</button>
        </form>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </Shell>
    );
  }

  // Returning, fully set-up user.
  return (
    <Shell>
      <h1 style={h1}>My account</h1>
      <p><strong>{profile.name}</strong><br />{profile.email}</p>
      <button onClick={signOut} style={button}>Log out</button>
      <p style={{ marginTop: 24, color: "var(--ink-soft)", fontSize: 14 }}>
        Entries, picks, and standings land here in the next build phase.
      </p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ maxWidth: 480, margin: "60px auto", padding: 24 }}>
      {children}
    </div>
  );
}
const h1 = { fontSize: 22, marginBottom: 16 };
const input = { padding: "10px 12px", borderRadius: 6, border: "1px solid rgba(28,28,28,0.2)", fontSize: 14, flex: "1 1 220px" };
const button = { padding: "10px 18px", borderRadius: 6, border: "none", background: "var(--turf)", color: "var(--chalk)", fontWeight: 700, fontSize: 14, cursor: "pointer" };
