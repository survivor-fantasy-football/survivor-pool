-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

-- One row per person, keyed to Supabase's own auth system (so id = the logged-in user's id).
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  notify_reminder boolean default false,
  is_commissioner boolean default false,
  created_at timestamptz default now()
);

-- One row per entry (a user can have several, up to the league cap).
create table entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  entry_number int not null,        -- 1, 2, 3... per user, for display ("Entry 2")
  alive boolean default true,
  strikes int default 0,
  created_at timestamptz default now()
);

-- League-wide settings (one row).
create table league_settings (
  id int primary key default 1,
  league_name text default 'Last One Standing',
  entries_allowed int default 3,
  mulligans int default 1,
  deadline_mode text default 'weekend',  -- 'thursday' | 'weekend' | 'none'
  loser_pool boolean default false,
  future_picking boolean default false,
  prevent_same_team boolean default false,
  multi_pick_enabled boolean default false,
  multi_pick_start_week int default 5,
  postseason boolean default false,
  postseason_pick_em boolean default false,
  current_week int default 1,
  season_started boolean default false,
  updated_at timestamptz default now()
);
insert into league_settings (id) values (1);

-- Cached NFL schedule (refreshed from ESPN's API in phase 2).
create table games (
  id text primary key,
  week int not null,
  kickoff timestamptz not null,
  away_team text not null,
  home_team text not null,
  international boolean default false,
  status text default 'scheduled',  -- 'scheduled' | 'in_progress' | 'final'
  winner text
);

-- One row per entry, per week, per team picked (supports 2-team "multiple pick" mode).
create table picks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references entries(id) on delete cascade,
  week int not null,
  team text not null,
  result text default 'pending',    -- 'pending' | 'win' | 'loss'
  created_at timestamptz default now(),
  unique (entry_id, week, team)
);

-- Generated weekly report content.
create table weekly_reports (
  week int primary key,
  survived_summary text,
  unlikeliest_survivor text,
  most_common_pick text,
  elimination_writeup text,
  sent_at timestamptz
);

-- Row-level security: on by default, meaning NO ONE can read/write until we
-- add policies. This keeps the database locked down while we build.
alter table users enable row level security;
alter table entries enable row level security;
alter table picks enable row level security;

-- A logged-in person can see and create their own user row.
create policy "read own user row" on users for select using (auth.uid() = id);
create policy "insert own user row" on users for insert with check (auth.uid() = id);

-- A logged-in person can see and manage entries/picks tied to their own user_id.
-- (More granular commissioner-only policies get added in a later phase.)
create policy "read own entries" on entries for select using (
  user_id in (select id from users where id = auth.uid())
);
create policy "insert own entries" on entries for insert with check (
  user_id in (select id from users where id = auth.uid())
);
create policy "read own picks" on picks for select using (
  entry_id in (select id from entries where user_id = auth.uid())
);
create policy "write own picks" on picks for insert with check (
  entry_id in (select id from entries where user_id = auth.uid())
);
create policy "update own picks" on picks for update using (
  entry_id in (select id from entries where user_id = auth.uid())
);
