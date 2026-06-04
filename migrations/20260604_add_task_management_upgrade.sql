alter table public.main_tasks
  add column completed boolean not null default false,
  add column sort_order integer not null default 0;

alter table public.subtasks
  add column recurrence text not null default 'none' check (recurrence in ('none', 'daily'));

alter table public.step_items
  add column recurrence text not null default 'none' check (recurrence in ('none', 'daily'));

with ordered as (
  select id, row_number() over (partition by user_id order by created_at) - 1 as position
  from public.main_tasks
)
update public.main_tasks
set sort_order = ordered.position
from ordered
where public.main_tasks.id = ordered.id;
