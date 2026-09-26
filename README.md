# Tracking hobbies— v6

Tracking stuff via GitHub Pages, backed by Supabase.

## Two modes

### Public view
No account is required. Visitors can see:

- hobby pages listed in `hobbies.js`
- learning/project items marked **Public**
- resources attached to public projects
- hobby-level resources marked **Public**
- public milestones and the trophy case
- the activity heatmap (date + minutes only)
- public history generated from shared completions and milestones

Cannot be edited.

### Owner view
After signing in will get:

- add/edit/archive/delete controls
- private items
- Current Focus
- private hobby notes
- Curiosity Inbox
- detailed activity notes, with edit/delete controls for logged sessions
- hobby-level resource library, with public/private visibility
- archive
- visibility controls
- backups

## Visibility defaults

The defaults are:

- new learning/project items: **Public**
- milestone visibility: **Auto** — private while working toward it, public after achievement
- activity: included in the public heatmap by default, but only date + minutes are exposed
- hobby scratchpad / curiosity / Current Focus / archive: always private
- project resources inherit the visibility of their parent project

Change an item's visibility directly from its row. Milestones have an `Auto / Public / Private` selector.

## Database

Supabase stores all changing content. GitHub stores only the static website code and the Supabase publishable browser configuration.

## Files

- `index.html` — home page shell
- `styles.css` — shared design
- `app.js` — public/owner UI and Supabase data operations
- `config.js` — Supabase browser configuration and a couple of defaults
- `hobbies.js` — central hobby registry
- `hobbies/*.html` — one tiny page per hobby
- `supabase-setup.sql` — database, security policies, and Storage setup


## v7 additions

- Logged activity can be edited or deleted from the hobby Activity section.
- Each hobby has a standalone **Resources** section for links/references that do not belong to a specific project.
- Hobby-level resources can be **Public** or **Private**.
- Project resources still stay attached to their project and inherit that project's visibility.
- Existing project resources are preserved by `supabase-v7-migration.sql`.

If the v6 database is already running, execute `supabase-v7-migration.sql` once in the Supabase SQL Editor before deploying the v7 JavaScript. The full `supabase-setup.sql` is also updated for fresh installs.
