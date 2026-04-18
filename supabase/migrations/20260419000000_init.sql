-- ============================================================
-- TABLES
-- ============================================================

create table public.courses (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  name        text        not null,
  emoji       text        not null default '📚',
  color       text        not null default '#E63946',
  status      text        not null default 'active'
                check (status in ('active', 'backlog', 'completed')),
  priority    text
                check (priority in ('high', 'medium', 'low')),
  exam_date   date,
  created_at  timestamptz not null default now()
);

create table public.resources (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  course_id    uuid        not null references public.courses (id) on delete cascade,
  name         text        not null,
  type         text
                 check (type in ('pdf', 'video', 'online_course', 'textbook', 'exercises', 'other')),
  total_pages  integer,
  link         text,
  status       text        not null default 'not_started'
                 check (status in ('not_started', 'in_progress', 'completed')),
  created_at   timestamptz not null default now()
);

create table public.sessions (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users (id) on delete cascade,
  course_id         uuid        not null references public.courses (id) on delete cascade,
  resource_id       uuid        references public.resources (id) on delete set null,
  duration_minutes  integer     not null,
  pages_covered     text,
  focus_type        text
                      check (focus_type in ('deep_focus', 'light_review', 'practice', 'video', 'project')),
  energy_level      text
                      check (energy_level in ('high', 'medium', 'low', 'post_night_shift')),
  notes             text,
  date              date        not null default current_date,
  created_at        timestamptz not null default now()
);

create table public.quiz_results (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  course_id        uuid        not null references public.courses (id) on delete cascade,
  resource_id      uuid        references public.resources (id) on delete set null,
  total_questions  integer     not null,
  correct_answers  integer     not null,
  score_percent    numeric     generated always as (
                     round(correct_answers::numeric / nullif(total_questions, 0) * 100, 1)
                   ) stored,
  topic            text,
  date             date        not null default current_date,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index on public.courses    (user_id);
create index on public.resources  (user_id);
create index on public.resources  (course_id);
create index on public.sessions   (user_id);
create index on public.sessions   (course_id);
create index on public.sessions   (date desc);
create index on public.quiz_results (user_id);
create index on public.quiz_results (course_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.courses      enable row level security;
alter table public.resources    enable row level security;
alter table public.sessions     enable row level security;
alter table public.quiz_results enable row level security;

-- courses
create policy "users can select own courses"
  on public.courses for select
  using (auth.uid() = user_id);

create policy "users can insert own courses"
  on public.courses for insert
  with check (auth.uid() = user_id);

create policy "users can update own courses"
  on public.courses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own courses"
  on public.courses for delete
  using (auth.uid() = user_id);

-- resources
create policy "users can select own resources"
  on public.resources for select
  using (auth.uid() = user_id);

create policy "users can insert own resources"
  on public.resources for insert
  with check (auth.uid() = user_id);

create policy "users can update own resources"
  on public.resources for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own resources"
  on public.resources for delete
  using (auth.uid() = user_id);

-- sessions
create policy "users can select own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- quiz_results
create policy "users can select own quiz results"
  on public.quiz_results for select
  using (auth.uid() = user_id);

create policy "users can insert own quiz results"
  on public.quiz_results for insert
  with check (auth.uid() = user_id);

create policy "users can update own quiz results"
  on public.quiz_results for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete own quiz results"
  on public.quiz_results for delete
  using (auth.uid() = user_id);
