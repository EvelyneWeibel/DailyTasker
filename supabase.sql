create extension if not exists "uuid-ossp";

create table public.main_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  created_at timestamptz not null default now()
);

create table public.subtasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  main_task_id uuid not null references public.main_tasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.step_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subtask_id uuid not null references public.subtasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.task_templates (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text default '',
  created_at timestamptz not null default now()
);

create table public.template_subtasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.task_templates(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.daily_tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subtask_id uuid not null references public.subtasks(id) on delete cascade,
  task_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, subtask_id, task_date)
);

alter table public.main_tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.step_items enable row level security;
alter table public.task_templates enable row level security;
alter table public.template_subtasks enable row level security;
alter table public.daily_tasks enable row level security;

create policy "Users manage their own main tasks" on public.main_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own subtasks" on public.subtasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own step items" on public.step_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own templates" on public.task_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own template subtasks" on public.template_subtasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage their own daily tasks" on public.daily_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
