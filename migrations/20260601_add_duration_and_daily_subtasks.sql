alter table public.subtasks
  add column estimated_minutes integer not null default 0 check (estimated_minutes >= 0);

alter table public.step_items
  add column estimated_minutes integer not null default 0 check (estimated_minutes >= 0);

alter table public.daily_tasks
  alter column subtask_id drop not null,
  add column step_item_id uuid references public.step_items(id) on delete cascade,
  add column sort_order integer not null default 0,
  add constraint daily_tasks_one_target
    check ((subtask_id is not null)::integer + (step_item_id is not null)::integer = 1);

alter table public.daily_tasks
  drop constraint daily_tasks_user_id_subtask_id_task_date_key;

create unique index daily_tasks_unique_subtask
  on public.daily_tasks (user_id, subtask_id, task_date)
  where subtask_id is not null;

create unique index daily_tasks_unique_step_item
  on public.daily_tasks (user_id, step_item_id, task_date)
  where step_item_id is not null;
