# Things I'm Tryin — final hobby journal

A quiet hobby journal hosted on GitHub Pages and backed by Supabase.

## What is included

### Public view
Visitors do not need an account. They can see:

- the hobbies listed in `hobbies.js`
- items marked Public
- resources attached to public items
- public hobby-level resources
- public milestones and the trophy case
- the public activity heatmap (date + minutes only)
- public history generated from shared completions and milestones

### Owner view
After signing in, you also get:

- add/edit/archive/delete controls
- private items and resources
- Current Focus
- private hobby notes
- detailed/editable activity
- Curiosity Inbox on the homepage
- Recently Touched
- global search
- JSON snapshot download + restore
- Quick Add from the header
- stable copyable links to items, resources, and milestones
- Rediscover, which quietly resurfaces one older entry each day

## Quick Add

When signed in, use `+ Add` in the header.

From the homepage you can choose Curiosity, Item, Activity, or Resource. For hobby-specific entries, choose the hobby and the normal form opens there.

From a hobby page, Item/Activity/Resource opens locally. Curiosity sends you to the homepage Curiosity form.

## Backups

On the homepage, the Saved panel has:

- **Download snapshot** — downloads your database content as JSON.
- **Restore snapshot** — replaces the current journal data for your account with a previously downloaded snapshot.

Trophy image *files* are stored separately in Supabase Storage and are not embedded in the JSON. The snapshot keeps their stored paths, so restoring within the same Supabase project can reconnect them if the files are still present.

## Shareable links

When signed in, Items, Resources, and Milestones have a small **Link** action. It copies a direct URL using a stable page anchor. Public visitors can open the link if that entry is public.

## Supabase

`supabase-setup.sql` contains the complete current schema, RLS policies, and milestone-image Storage configuration.

If your Supabase project is already configured and working, **do not rerun it** just to deploy this frontend revision. v9 does not require a schema migration.

The setup file begins by dropping this hobby journal's app tables so it can also be used to deliberately reset a test/empty project. Running it on a populated journal will erase those journal rows.

Never put a Supabase secret/service-role key or database password into `config.js`. The Project URL and browser publishable key are expected to be in a public GitHub Pages frontend.

## Adding a hobby

1. Add the hobby to `hobbies.js`.
2. Copy `hobbies/_template.html`.
3. Rename it, for example `hobbies/woodworking.html`.
4. Change `window.HOBBY_PAGE_ID` in that file to the matching hobby ID.
5. Update its `<title>`.

Everything entered through the hobby page is stored in Supabase.

## Main files

- `index.html` — homepage shell
- `styles.css` — shared styling
- `app.js` — UI, auth, database reads/writes, backup/restore
- `config.js` — Supabase browser configuration
- `hobbies.js` — hobby registry
- `hobbies/*.html` — one lightweight page per hobby
- `supabase-setup.sql` — complete database/security setup
