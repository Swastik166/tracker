# My Hobbies — Supabase version

A personal hobby journal for GitHub Pages. The site stays static and simple; personal content is saved in Supabase so it can be used from multiple devices.

## What is included

- One real HTML page per hobby
- Combined Learning / Project items with a lightweight type tag
- Planned / Active / Paused / Done states
- Up to two pinned **Current focus** items per hobby
- Automatic **Last touched** dates
- Activity heatmap and practice logging
- Project-specific resource shelves
- Working milestones + trophy case
- Optional private trophy images stored in Supabase Storage
- Curiosity inbox
- Automatic year/month history generated from existing data
- Manual archived-items area
- Autosaving hobby notes
- Supabase email/password login
- Row Level Security so signed-in users only see their own rows
- No hobby data in localStorage

## First setup

Read `SUPABASE_SETUP.md` and run `supabase-setup.sql` in a new Supabase project.

Then edit `config.js` with your Supabase Project URL and **publishable** key.

## Files

```text
index.html              Home / hobby index
styles.css              Shared visual design
app.js                   Shared UI + Supabase database logic
config.js                Supabase URL + publishable browser key
hobbies.js               Hobbies shown on the home page
supabase-setup.sql        Database, security policies, Storage bucket
SUPABASE_SETUP.md         Full setup instructions
ADDING_A_HOBBY.md         How to add another hobby page
hobbies/
  _template.html
  coding.html
  photography.html
  guitar.html
  cooking.html
```

## Storage note

The journal data itself is stored only in Supabase. Supabase Auth uses browser `sessionStorage` for the login session so navigating between hobby pages does not require signing in again. Closing that browser tab/session can require signing in again. The app does not use `localStorage` for hobby data or migration.


## Working

Github = application; Supabase = database; browser = messenger.
When site is accessed, the browser loads the static HTML/CSS/JS from GitHub Pages. These files describe the site and its behaviour. The JS code then connects to Supabase to read/write hobby data. Sign in with email/password is required to access the data.

The contents(items, resources, milestones, activity, curiosities and hobby notes) are stored in Supabase's PostgreSQL database.

The flow of data is:
save -> app.js in browser -> Supabase data API (via HTTPS request) -> PostgreSQL database (inserts row into "items")3

Database:
items

id
user_id
hobby_id
title
kind
status
progress
tags
notes
next_action
archived
is_focus
created_at
updated_at
touched_at
completed_at