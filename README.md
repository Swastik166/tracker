# Tracking hobbies — v8

A quiet personal hobby journal hosted on GitHub Pages and backed by Supabase.

## Public view

Visitors do not need an account. They can see content you have chosen to make public:

- hobby pages from `hobbies.js`
- public learning/project items
- public project and hobby resources
- public/achieved milestones and the trophy case
- the activity heatmap (date + minutes only)
- public history
- homepage search across content that is public to them

Visitors cannot edit anything.

## Owner view

After signing in you can also use:

- add/edit/archive/delete controls
- private items and resources
- Current Focus
- private hobby notes
- editable/deletable activity entries
- the global Curiosity Inbox on the homepage
- Recently Touched on the homepage
- search across both public and private loaded content
- archive and backups

## v8 changes

### Curiosity is global

Curiosity no longer belongs to a hobby when it is captured. The private Curiosity Inbox now lives on the homepage. A curiosity contains only a title, optional link, and optional note.

Use **Move to hobby** to choose a hobby and whether it should become a Learning or Project item. It becomes a Planned item. If it has a saved link, that link is preserved as a hobby-level resource.

### Global search

The homepage search finds learning/project items, resources, and milestones across all hobbies. Signed-out visitors only search content Supabase permits them to read; the owner searches the full loaded owner state.

### Recently touched

The owner homepage shows the five most recently touched non-archived items. This is generated from existing `touched_at` data and requires no extra logging.

### Resources

Resource URLs are optional. A resource can now be a book, person, place, app, reference, or anything else even when there is no web link. The Type field stays free-form but offers common suggestions.

### Completed items

`Done` items remain in the normal Learning & Projects list. Archive remains a separate deliberate action.

## Database upgrades

For an existing v7 database, run `supabase-v8-migration.sql` once.

If your database is still on v6, run these in order:

1. `supabase-v7-migration.sql`
2. `supabase-v8-migration.sql`

For a brand-new Supabase project, use only the current `supabase-setup.sql`.

## Files

- `index.html` — homepage shell
- `styles.css` — shared design
- `app.js` — UI and Supabase operations
- `config.js` — Supabase browser configuration
- `hobbies.js` — hobby registry
- `hobbies/*.html` — one small page per hobby
- `supabase-setup.sql` — complete schema for a fresh database
- `supabase-v7-migration.sql` — adds hobby-level resources to a v6 database
- `supabase-v8-migration.sql` — makes Curiosity global for a v7 database

## v8.1 fixes

- Curiosity Inbox entries can be saved without assigning a hobby. Existing databases must run `supabase-v8.1-migration.sql` once so `curiosities.hobby_id` is nullable.
- Links no longer require a scheme. `youtube.com`, `www.example.com/page`, and full `https://...` URLs are accepted. The site stores shorthand links as normalized HTTPS URLs.
- Empty links remain valid for both curiosities and resources.
