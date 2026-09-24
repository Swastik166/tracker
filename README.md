# My Hobbies

A quiet personal website for documenting hobbies, learning, projects, resources, milestones, activity, and ideas.

## Structure

```text
index.html              Home / hobby index
styles.css              Shared visual design
app.js                   Shared behavior and local data storage
hobbies.js               List of hobbies shown on the home page
hobbies/
  _template.html         Copy this when adding a hobby
  coding.html
  photography.html
  guitar.html
  cooking.html
ADDING_A_HOBBY.md        Short instructions for adding another hobby
```

Each hobby is a real separate HTML page, but all hobby pages use the same layout and JavaScript. That means the page files themselves stay very small.

## What each hobby page contains

- Activity heatmap and recent practice log
- Simple autosaving hobby notes
- Planned / learning / learned list
- Next action and progress for learning items
- Projects
- A separate resource shelf inside each project
- Milestones
- Curiosity inbox
- Archive

## Adding a hobby

See `ADDING_A_HOBBY.md`. In short: copy `hobbies/_template.html`, edit three values, then add one entry to `hobbies.js`.

## Publish with GitHub Pages

1. Put these files in the repository root.
2. Open the repository on GitHub.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the main branch and `/ (root)`.
6. Save.

## Data storage

The current version stores personal entries in browser `localStorage`. The data model is shared across all hobby pages and is stored under one key, so the home page can summarize activity from every hobby.

The site also imports the previous `learning-atlas-state-v2` data automatically the first time this version is opened in the same browser.

Use **Export data** on the home page for backups.

A future database version can replace the storage functions without changing the page structure.
