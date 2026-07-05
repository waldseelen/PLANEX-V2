-- STEMA / PLAN.EX — Full Supabase schema (auth profiles + planner + tracker + learn/AI)
-- Table/column names here are the ground truth already consumed by
-- src/lib/cloud/plannerRepo.ts, src/lib/cloud/trackerRepo.ts and
-- src/modules/settings/store/settingsStore.ts (all written against this shape
-- before the client was ever wired up). Do not rename without updating those.
--
-- Every domain table is user-scoped (user_id) and RLS-protected: a row is only
-- visible/writable by its owner (auth.uid() = user_id). Server-side edge
-- functions (api/*) use the service role key and bypass RLS, but must always
-- set user_id explicitly from the verified JWT.

create extension if not exists "uuid-ossp";
create extension if not exists vector;

-- ============================================================
-- Helper: updated_at trigger
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- Profiles (auth identity, onboarding)
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  occupation text,
  student_status text check (student_status in ('student', 'working', 'both', 'other')),
  school text,
  department text,
  grade text,
  plan text not null default 'free',
  profile_completed boolean not null default false,
  onboarding_completed boolean not null default false,
  preferred_locale text not null default 'tr',
  preferred_theme text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row when a new auth user signs up (OAuth callback).
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- Planner domain (timestamptz — matches plannerRepo.ts nowISO())
-- ============================================================

create table if not exists courses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  code text,
  icon text,
  color text not null default '#6366f1',
  bg_gradient text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists units (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  title text not null,
  icon text,
  status text not null default 'todo',
  priority text,
  due_date date,
  completed_at timestamptz,
  tags jsonb not null default '[]',
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists personal_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  icon text,
  status text not null default 'todo',
  priority text,
  due_date date,
  completed_at timestamptz,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('exam', 'event')),
  course_id uuid references courses(id) on delete set null,
  title text not null,
  date date not null,
  description text,
  color text,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists habits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  emoji text not null default '✅',
  icon text,
  habit_type text not null check (habit_type in ('boolean', 'numeric')),
  target_value numeric,
  target_unit text,
  color text not null default '#6366f1',
  frequency text not null default 'weeklyTarget',
  target_days jsonb not null default '{}',
  archived boolean not null default false,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists habit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references habits(id) on delete cascade,
  date date not null,
  status text not null check (status in ('done', 'skipped')),
  value numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, date)
);

create table if not exists completion_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  completed_at timestamptz not null default now(),
  date_key date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Tracker domain (LifeFlow) — epoch millisecond bigint columns,
-- matches trackerRepo.ts nowMs()/Date.now()
-- ============================================================

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  icon text not null,
  archived boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists tags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null,
  group_id text,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists activities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  color text,
  icon text,
  tag_ids jsonb not null default '[]',
  archived boolean not null default false,
  default_goal_ids jsonb not null default '[]',
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists time_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  start_at bigint not null,
  end_at bigint not null,
  duration_sec integer not null,
  note text not null default '',
  date_key date not null,
  merged_from_ids jsonb not null default '[]',
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists running_timers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  started_at bigint not null,
  paused_at bigint,
  accumulated_sec integer not null default 0,
  mode text not null default 'normal',
  pomodoro_config_id uuid,
  created_at bigint not null
);

create table if not exists goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  scope text not null check (scope in ('daily', 'weekly', 'monthly', 'yearly')),
  metric text not null check (metric in ('time', 'count', 'streak')),
  min_target numeric,
  max_target numeric,
  target_value numeric not null,
  activity_id uuid references activities(id) on delete cascade,
  habit_id uuid references habits(id) on delete cascade,
  enabled boolean not null default true,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trigger text not null,
  conditions jsonb not null default '[]',
  actions jsonb not null default '[]',
  enabled boolean not null default true,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('habit', 'activity', 'custom')),
  habit_id uuid references habits(id) on delete cascade,
  activity_id uuid references activities(id) on delete cascade,
  title text not null,
  message text not null,
  schedule jsonb not null default '{}',
  enabled boolean not null default true,
  created_at bigint not null,
  updated_at bigint not null
);

-- Settings and pomodoro configs use timestamptz (settingsStore.ts never sets
-- created_at/updated_at explicitly, so DB defaults own them).
create table if not exists settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create table if not exists pomodoro_configs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  work_duration integer not null,
  short_break_duration integer not null,
  long_break_duration integer not null,
  sessions_before_long_break integer not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id)
);

-- ============================================================
-- Learn / STEM AI domain (timestamptz)
-- ============================================================

create table if not exists concepts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text,
  name text not null,
  description text,
  prerequisite_id uuid references concepts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- id is client-generated as `${userId}_${conceptId}` (see LearnChat.tsx), not
-- a uuid default, so this is a text key rather than uuid.
create table if not exists concept_mastery (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  score numeric not null default 0,
  evidence_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, concept_id)
);

create table if not exists learn_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists learn_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references learn_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  raw_response jsonb,
  token_cost numeric,
  prompt_tokens integer,
  completion_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists tutor_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists error_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references concepts(id) on delete set null,
  error_type text not null check (error_type in ('conceptual', 'procedural', 'calculation', 'strategic')),
  raw_user_answer text,
  model_feedback text,
  created_at timestamptz not null default now()
);

create table if not exists sr_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id uuid references concepts(id) on delete set null,
  front text not null,
  back text not null,
  due_at timestamptz not null default now(),
  difficulty numeric not null default 5.0,
  stability numeric not null default 1.0,
  retrievability numeric not null default 1.0,
  state integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  last_review timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  file_path text,
  file_type text,
  size integer,
  status text not null default 'processing',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mindmaps (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  nodes jsonb not null default '[]',
  edges jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_embedding_idx
  on document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_user_id uuid,
  match_threshold float default 0.35,
  match_count int default 3
)
returns table (id uuid, content text, metadata jsonb, similarity float)
language sql stable
as $$
  select id, content, metadata, 1 - (embedding <=> query_embedding) as similarity
  from document_chunks
  where user_id = match_user_id
    and 1 - (embedding <=> query_embedding) >= match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- RLS: apply owner-only policy to every user_id-scoped table above
-- ============================================================
do $$
declare
  t text;
  owned_tables text[] := array[
    'courses', 'units', 'tasks', 'personal_tasks', 'events',
    'habits', 'habit_logs', 'completion_records',
    'categories', 'tags', 'activities', 'time_sessions', 'running_timers',
    'goals', 'rules', 'reminders', 'settings', 'pomodoro_configs',
    'concepts', 'concept_mastery', 'learn_sessions', 'learn_messages',
    'tutor_events', 'error_logs', 'sr_cards', 'documents', 'document_chunks',
    'mindmaps'
  ];
begin
  foreach t in array owned_tables loop
    execute format('alter table %I enable row level security;', t);
    execute format('create policy %I on %I for select using (auth.uid() = user_id);', t || '_select_own', t);
    execute format('create policy %I on %I for insert with check (auth.uid() = user_id);', t || '_insert_own', t);
    execute format('create policy %I on %I for update using (auth.uid() = user_id);', t || '_update_own', t);
    execute format('create policy %I on %I for delete using (auth.uid() = user_id);', t || '_delete_own', t);
  end loop;
end $$;

-- ============================================================
-- updated_at triggers for timestamptz tables only (epoch/bigint tracker
-- tables set updated_at explicitly from the client via nowMs())
-- ============================================================
do $$
declare
  t text;
  tables_with_updated_at text[] := array[
    'courses', 'units', 'tasks', 'personal_tasks', 'events',
    'habits', 'habit_logs', 'completion_records',
    'settings', 'pomodoro_configs', 'sr_cards', 'concepts', 'documents', 'mindmaps'
  ];
begin
  foreach t in array tables_with_updated_at loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at();', t || '_set_updated_at', t);
  end loop;
end $$;
