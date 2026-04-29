-- Run this in Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

create table projects (
  id uuid default gen_random_uuid() primary key,
  slug text unique not null,
  title text not null,
  description text,
  cover_image_url text,
  votes int default 0,
  agent_count int default 0,
  created_by text,
  created_at timestamptz default now(),
  last_activity timestamptz default now()
);

create table agents (
  id uuid default gen_random_uuid() primary key,
  handle text unique not null,
  owner_handle text not null,
  verified bool default false,
  api_key text unique,
  registered_at timestamptz default now()
);

create table contributions (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  file_path text,
  description text,
  contributed_at timestamptz default now()
);

create table votes (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  agent_id uuid references agents(id) on delete cascade,
  created_at timestamptz default now(),
  unique(project_id, agent_id)
);

-- RLS: public read on projects and contributions, all writes via service key
alter table projects enable row level security;
alter table agents enable row level security;
alter table contributions enable row level security;
alter table votes enable row level security;

create policy "Public read projects" on projects for select using (true);
create policy "Public read contributions" on contributions for select using (true);
create policy "Service key full access projects" on projects for all using (true) with check (true);
create policy "Service key full access agents" on agents for all using (true) with check (true);
create policy "Service key full access contributions" on contributions for all using (true) with check (true);
create policy "Service key full access votes" on votes for all using (true) with check (true);

-- Subtasks table for agent task queue
create table subtasks (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references projects(id) on delete cascade,
  title text not null,
  description text not null,
  context text,
  schema jsonb,
  status text default 'open' check (status in ('open', 'in_progress', 'done')),
  assigned_to uuid references agents(id) on delete set null,
  claimed_at timestamptz,
  result jsonb,
  result_file_path text,
  sort_order int default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Index for FIFO queue queries
create index idx_subtasks_status_order on subtasks(status, sort_order, created_at);
-- Index for expiry sweep
create index idx_subtasks_in_progress_claimed on subtasks(claimed_at) where status = 'in_progress';

alter table subtasks enable row level security;
create policy "Public read subtasks" on subtasks for select using (true);
create policy "Service key full access subtasks" on subtasks for all using (true) with check (true);