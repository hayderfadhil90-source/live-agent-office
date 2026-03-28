-- ============================================================
-- Live Agent Office — Supabase / PostgreSQL Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── profiles ────────────────────────────────────────────────
-- Mirrors auth.users so the app can reference user data safely.
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row when a new user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── workspaces ──────────────────────────────────────────────
create table if not exists workspaces (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text not null,
  template_name text not null default 'office',
  created_at    timestamptz not null default now(),
  -- MVP: one workspace per user
  unique (user_id)
);

-- ─── agents ──────────────────────────────────────────────────
create table if not exists agents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  role         text not null check (role in ('support','content','booking','assistant')),
  status       text not null default 'idle' check (status in ('idle','working','replying','error')),
  avatar_style text not null default 'blue',
  pos_x        integer not null default 300,
  pos_y        integer not null default 280,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- MVP: one agent per workspace
  unique (workspace_id)
);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agents_updated_at on agents;
create trigger agents_updated_at
  before update on agents
  for each row execute procedure update_updated_at();

-- ─── events ──────────────────────────────────────────────────
create table if not exists events (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references agents(id) on delete cascade,
  event_type text not null check (event_type in (
    'message_received','thinking_started','reply_sent',
    'task_started','task_completed','error_happened','status_changed'
  )),
  status     text check (status in ('idle','working','replying','error')),
  message    text,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_agent_id_idx on events(agent_id);
create index if not exists events_created_at_idx on events(created_at desc);

-- ─── webhook_tokens ──────────────────────────────────────────
create table if not exists webhook_tokens (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  token        text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at   timestamptz not null default now(),
  -- one token per workspace for MVP
  unique (workspace_id)
);

-- ─── Row Level Security ───────────────────────────────────────
alter table profiles         enable row level security;
alter table workspaces       enable row level security;
alter table agents           enable row level security;
alter table events           enable row level security;
alter table webhook_tokens   enable row level security;

-- profiles: users can only see/edit their own profile
create policy "profiles: own row" on profiles
  for all using (auth.uid() = id);

-- workspaces: users own their workspaces
create policy "workspaces: owner" on workspaces
  for all using (auth.uid() = user_id);

-- agents: accessible by workspace owner
create policy "agents: workspace owner" on agents
  for all using (
    workspace_id in (
      select id from workspaces where user_id = auth.uid()
    )
  );

-- events: accessible by workspace owner
create policy "events: workspace owner" on events
  for all using (
    agent_id in (
      select a.id from agents a
      join workspaces w on w.id = a.workspace_id
      where w.user_id = auth.uid()
    )
  );

-- webhook_tokens: accessible by workspace owner
create policy "webhook_tokens: owner" on webhook_tokens
  for all using (
    workspace_id in (
      select id from workspaces where user_id = auth.uid()
    )
  );

-- ─── Service role bypass (for webhook API) ───────────────────
-- The API route uses the service role key, which bypasses RLS.
-- No extra policies needed for that path.

-- ─── Realtime ────────────────────────────────────────────────
-- Enable realtime on agents and events tables so the frontend
-- can subscribe to changes via Supabase Realtime.
alter publication supabase_realtime add table agents;
alter publication supabase_realtime add table events;

-- ─── Seed data (dev only) ────────────────────────────────────
-- Uncomment to insert test data after creating a user in Supabase Auth.
/*
insert into workspaces (id, user_id, name, template_name)
values ('00000000-0000-0000-0000-000000000001',
        '<your-auth-uid>',
        'My Office', 'office');

insert into agents (id, workspace_id, name, role, status, avatar_style)
values ('00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'Atlas', 'support', 'idle', 'blue');

insert into webhook_tokens (workspace_id)
values ('00000000-0000-0000-0000-000000000001');
*/
