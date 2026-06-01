# Daily Tasker

A static task-planning page for GitHub Pages with optional Supabase sync. Main tasks contain
small tasks, and any small task can be added to today's focused list. Templates let you reuse
the same default small tasks for recurring goals.

## Preview locally

Run a static server from this folder:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. The app starts in demo mode and saves preview data in the
browser's local storage.

## Connect Supabase

1. Create a Supabase project.
2. Open the Supabase SQL editor and run `supabase.sql`.
3. In Supabase, open **Authentication > URL Configuration** and add your GitHub Pages URL to
   the redirect URLs. For local testing, also add `http://localhost:8000`.
4. Open the app and click **Demo mode** in the top-right corner.
5. Paste the project URL and public anon key from **Project Settings > API**.
6. Enter your email address and use the magic link Supabase sends you.

The browser stores only the public anon key. Row-level security policies keep each signed-in
user's data private.

## Publish with GitHub Pages

Push these files to a GitHub repository, then open **Settings > Pages** in GitHub. Choose
**Deploy from a branch**, select the branch containing the site, and use the `/ (root)` folder.
