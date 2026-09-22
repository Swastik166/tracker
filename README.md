# My Hobby Atlas

A small static personal website for tracking hobbies, learning goals, active topics and completed learning.

## Features

- Track items as **Planned**, **Learning**, or **Learned**
- Group entries by hobby
- Add notes, tags, progress and resource links
- Search and filter
- Dark mode
- Browser-local persistence with `localStorage`
- Import/export your data as JSON
- Responsive layout
- No framework or build step required

## Run locally

Just open `index.html` in your browser, or serve the folder with a simple local server.

For example:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a new GitHub repository, for example `hobby-atlas`.
2. Upload these files to the repository root.
3. Commit and push.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select your main branch and `/ (root)`.
7. Save.

GitHub will provide the public Pages URL.

## Important data note

Entries added through the website are stored in your browser's `localStorage`. That means:

- they are not automatically synced across devices;
- clearing browser data can remove them;
- use **Export JSON** regularly to back them up.

A future version can store content directly in the GitHub repository, use Supabase/Firebase, or use a GitHub-backed CMS.

## Good next upgrades

- Practice streak calendar / heatmap
- Monthly learning retrospectives
- Reading / course / video resource queue
- Projects linked to each hobby
- Skill trees with prerequisites
- Time spent per hobby
- "Pick something for me" random practice button
- Milestones and badges
- Public/private toggle for individual entries
- Photo gallery for physical/creative hobbies
- Markdown notes
- GitHub contribution-style activity calendar
