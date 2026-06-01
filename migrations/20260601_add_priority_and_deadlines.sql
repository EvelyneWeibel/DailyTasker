alter table public.subtasks
  add column priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  add column deadline date;

alter table public.step_items
  add column priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  add column deadline date;
