# Daily Tasker

A static task-planning page for GitHub Pages with Supabase sync. Main tasks contain
small tasks, and any small task can be added to today's focused list. Templates let you reuse
the same default small tasks for recurring goals. Each small step can also contain a finer
checklist of subtasks.

The Today page also includes a browser-local Pomodoro timer. Focus sessions, short breaks, and
long breaks can be customized without an additional Supabase migration.

Daily items can be marked DNF with a topic and a reason. The Today page keeps a topic-filtered
history so recurring blockers are easy to remember.

Steps and nested subtasks can have a priority and deadline. The Today page sorts unfinished
deadline items by due date and lets you add them to today's list in one click.

## Preview locally

Run a static server from this folder:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. The app connects to the configured Supabase project and
shows the email login screen when you are signed out.

## Supabase

The published GitHub Pages app uses the configured Supabase project by default. The repository
contains its public publishable key only; data access remains protected by row-level security.

## Connect another Supabase project

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase.sql`.
3. In Supabase, open **Authentication > URL Configuration**.
4. Set **Site URL** to `https://evelyneweibel.github.io/DailyTasker/`.
5. Add `https://evelyneweibel.github.io/DailyTasker/` to **Redirect URLs**. For local testing,
   also add `http://localhost:8000/`.
6. Open the app and click **Cloud sync** in the top-right corner.
7. Paste the project URL and public anon key from **Project Settings > API**. The project URL
   should look like `https://your-project-ref.supabase.co` without an extra path.
8. Enter your email address and use the magic link Supabase sends you.

The browser stores only the public anon key. Row-level security policies keep each signed-in
user's data private.

## Update an existing Supabase project

If you set up Supabase before nested subtasks were added, run
`migrations/20260601_add_step_items.sql` once in the Supabase SQL editor.

Then run `migrations/20260601_add_duration_and_daily_subtasks.sql` once to add estimated
durations, allow nested subtasks on today's list, and save your preferred daily ordering.

Run `migrations/20260601_add_dnf_notes.sql` once to add the topic-filtered DNF journal.

Run `migrations/20260601_add_priority_and_deadlines.sql` once to add priority and deadline
metadata for steps and nested subtasks.

## Publish with GitHub Pages

Push these files to a GitHub repository, then open **Settings > Pages** in GitHub. Choose
**Deploy from a branch**, select the branch containing the site, and use the `/ (root)` folder.
