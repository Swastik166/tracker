# My Learning Atlas

A static personal hobby and learning dashboard for GitHub Pages.

## What it tracks

- Learning topics: planned, learning, and learned
- Next actions and progress
- Practice/activity sessions with a heatmap and streak
- Projects with a separate resource shelf for each project
- Milestones: firsts, completions, personal bests, consistency goals, project markers, or custom milestones
- Curiosity Inbox for interesting ideas that are not commitments yet
- Archive for retired or paused learning entries
- JSON backup/import
- Dark mode

## Data storage in this version

This version still uses browser `localStorage`. The full application state is stored under one key (`learning-atlas-state-v2`) so it will be easier to replace the storage layer with a remote database/API later.

Entries remain on the same browser/device between visits, but they do not automatically sync between devices and are not written back to the GitHub repository.

Use **Export data** periodically for a portable JSON backup.

## Publish on GitHub Pages

1. Create a GitHub repository.
2. Put `index.html`, `style.css`, and `app.js` at the repository root.
3. Push to GitHub.
4. Open **Settings → Pages**.
5. Choose **Deploy from a branch**.
6. Select `main` and `/ (root)`.
7. Save.

No build step is required.

## Good future storage upgrades

When persistent cross-device editing is wanted, the front-end can keep almost the same data model and replace `loadState()` / `saveState()` with calls to a remote storage layer.

Good options include:

- **Supabase** — best balance for login + database + simple JavaScript API.
- **Firebase** — also suitable for authentication and synced data.
- **GitHub API** — can write JSON/Markdown back into the repository, but requires authentication and is less pleasant for frequent edits.
- **A tiny serverless API** — maximum control, more setup.

For a private personal dashboard, Supabase or Firebase is the straightforward next step if automatic syncing becomes important.
