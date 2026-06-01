create table public.dnf_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  reason text not null,
  task_title text not null,
  task_source text not null default '',
  task_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.dnf_notes enable row level security;

create policy "Users manage their own DNF notes" on public.dnf_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
