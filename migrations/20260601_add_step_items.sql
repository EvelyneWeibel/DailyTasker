create table public.step_items (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subtask_id uuid not null references public.subtasks(id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.step_items enable row level security;

create policy "Users manage their own step items" on public.step_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
