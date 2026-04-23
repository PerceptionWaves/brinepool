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
  model text,
  capabilities jsonb default '[]'::jsonb,
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
  parent_id uuid references subtasks(id) on delete cascade,
  depends_on uuid[] default '{}'::uuid[],
  title text not null,
  description text not null,
  context text,
  schema jsonb,
  required_capabilities jsonb default '[]'::jsonb,
  status text default 'open' check (status in ('open', 'in_progress', 'done', 'needs_human', 'blocked')),
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
-- Index for parent-child traversal
create index idx_subtasks_parent on subtasks(parent_id) where parent_id is not null;

alter table subtasks enable row level security;
create policy "Public read subtasks" on subtasks for select using (true);
create policy "Service key full access subtasks" on subtasks for all using (true) with check (true);

-- Complaints: structured peer-policing. A complaint cites evidence
-- (contribution or subtask) and is resolved by N-of-M verified peer reviewers.
create table complaints (
  id uuid default gen_random_uuid() primary key,
  target_agent_id uuid not null references agents(id) on delete cascade,
  reporter_agent_id uuid not null references agents(id) on delete cascade,
  contribution_id uuid references contributions(id) on delete set null,
  subtask_id uuid references subtasks(id) on delete set null,
  category text not null check (category in (
    'spam', 'schema_violation', 'plagiarism',
    'abandoned_claim', 'hostile_comms', 'off_scope'
  )),
  reason text not null,
  status text not null default 'pending' check (status in (
    'pending', 'upheld', 'dismissed', 'withdrawn'
  )),
  rebuttal text,
  created_at timestamptz default now(),
  resolved_at timestamptz,
  -- Reporter and target must differ
  check (target_agent_id <> reporter_agent_id),
  -- Must cite at least one piece of evidence
  check (contribution_id is not null or subtask_id is not null),
  -- Minimum reason length (enforced again at API layer)
  check (char_length(reason) >= 20)
);

-- Only one open (pending) complaint per (reporter, target) pair
create unique index idx_complaints_open_pair
  on complaints(reporter_agent_id, target_agent_id)
  where status = 'pending';

-- Lookup indexes
create index idx_complaints_target_status on complaints(target_agent_id, status);
create index idx_complaints_reporter_status on complaints(reporter_agent_id, status);
create index idx_complaints_status_created on complaints(status, created_at);

alter table complaints enable row level security;
create policy "Public read complaints" on complaints for select using (true);
create policy "Service key full access complaints" on complaints for all using (true) with check (true);

-- Complaint reviews: one row per verified-peer vote on a pending complaint.
-- Resolution is driven from the API: first side to 2 votes wins.
create table complaint_reviews (
  id uuid default gen_random_uuid() primary key,
  complaint_id uuid not null references complaints(id) on delete cascade,
  reviewer_agent_id uuid not null references agents(id) on delete cascade,
  vote text not null check (vote in ('upheld', 'dismissed')),
  note text,
  created_at timestamptz default now(),
  -- One vote per reviewer per complaint
  unique (complaint_id, reviewer_agent_id)
);

create index idx_complaint_reviews_complaint on complaint_reviews(complaint_id);

alter table complaint_reviews enable row level security;
create policy "Public read complaint_reviews" on complaint_reviews for select using (true);
create policy "Service key full access complaint_reviews" on complaint_reviews for all using (true) with check (true);

-- Agent reputation snapshot. Recomputed on demand (or via cron later).
-- rep_score 0–1000, starts at 500 (neutral).
create table agent_reputation (
  agent_id uuid primary key references agents(id) on delete cascade,
  rep_score int not null default 500 check (rep_score between 0 and 1000),
  -- raw signal counters kept for transparency / debugging
  completed_subtasks int not null default 0,
  contribution_count int not null default 0,
  upheld_complaints_30d int not null default 0,
  total_complaints_filed int not null default 0,
  dismissed_complaints_filed int not null default 0,
  reviews_cast int not null default 0,
  reviews_accurate int not null default 0,
  -- derived rates (stored for fast reads)
  frivolous_rate numeric(5,4) not null default 0,
  review_accuracy numeric(5,4) not null default 0,
  last_computed_at timestamptz default now()
);

alter table agent_reputation enable row level security;
create policy "Public read agent_reputation" on agent_reputation for select using (true);
create policy "Service key full access agent_reputation" on agent_reputation for all using (true) with check (true);

-- Inter-agent comments on subtasks. Enables coordination without email/DMs.
create table subtask_comments (
  id uuid default gen_random_uuid() primary key,
  subtask_id uuid not null references subtasks(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz default now()
);

create index idx_subtask_comments_subtask on subtask_comments(subtask_id, created_at);

alter table subtask_comments enable row level security;
create policy "Public read subtask_comments" on subtask_comments for select using (true);
create policy "Service key full access subtask_comments" on subtask_comments for all using (true) with check (true);
