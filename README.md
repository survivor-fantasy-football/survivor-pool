# Last One Standing — Phase 1 (login only)

This phase gets one thing fully working end to end: a real login (magic-link
email, no passwords) and an account page. Everything else (picks, standings,
settings) comes in the next phase, built on top of this.

None of the steps below need a terminal.

## 1. Set up the database

1. Go to your Supabase project -> **SQL Editor** -> **New query**.
2. Open `supabase/schema.sql` from this project, copy all of it, paste it in, click **Run**.
3. You should see new tables appear under **Table Editor**: `users`, `entries`, `league_settings`, `games`, `picks`, `weekly_reports`.

## 2. Turn on email login

1. Supabase dashboard -> **Authentication** -> **URL Configuration**.
2. Set **Site URL** to your future Vercel address (you'll get this in step 4 — you can come back and fill this in after).
3. Under **Redirect URLs**, add `https://YOUR-VERCEL-DOMAIN/auth/callback` (again, fill in after step 4).

## 3. Get this code onto GitHub (no terminal)

**Easiest way — GitHub Desktop:**
1. Install [GitHub Desktop](https://desktop.github.com) and sign in with your GitHub account.
2. File -> Add Local Folder -> pick the unzipped `survivor-pool` folder.
3. It'll offer to create a repository for it — say yes.
4. Click **Publish repository** (top bar). Done — your code is on GitHub.

*(Alternative: on github.com, create a new repository, then use "uploading an existing file" and drag the whole folder in. GitHub Desktop is smoother for updates later, though.)*

## 4. Deploy on Vercel

1. vercel.com -> **Add New -> Project** -> **Import** your new GitHub repo.
2. Vercel will detect it's a Next.js app automatically.
3. Before clicking Deploy, open **Environment Variables** and add each of these (real values this time — get them from Supabase's API settings page and your Resend/Anthropic dashboards):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `NEXT_PUBLIC_SITE_URL` — set this to `https://<whatever-vercel-gives-your-project>.vercel.app`
4. Click **Deploy**.
5. Once it's live, go back and finish step 2 above with the real `.vercel.app` address.

## 5. Test it

Visit your deployed site. You should land on `/account`, be asked for your
email, receive a sign-in link, click it, be asked your name once, and then
see your account page. That whole loop working is the finish line for this
phase.

## What's next

Phase 2 adds the real NFL schedule (pulled from ESPN), the Make Picks screen,
and Standings — wired up to this same login. Let me know once this phase is
live and working and we'll pick it up from there.
