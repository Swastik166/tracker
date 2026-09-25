# Supabase setup — full instructions

This version starts clean. It does **not** migrate or read hobby data from localStorage. The database is the source of truth from day one.

The site remains a normal static GitHub Pages site. Supabase provides:

- PostgreSQL database storage
- email/password sign-in
- Row Level Security (RLS)
- private file storage for milestone/trophy images

## 1. Create a Supabase account and project

1. Go to https://supabase.com and create an account.
2. Create a **New project** on the Free plan.
3. Give it any name, for example `my-hobbies`.
4. Choose a strong database password and keep it somewhere safe.
5. Choose the nearest available region that makes sense for you.
6. Wait for the project to finish provisioning.

The database password is for project administration. It is **not** placed in this website.

## 2. Create the database tables and security rules

1. In the Supabase Dashboard, open your project.
2. Open **SQL Editor**.
3. Create a new query.
4. Open the file `supabase-setup.sql` from this website folder.
5. Copy the whole file into the SQL Editor.
6. Click **Run**.

That one script creates:

- `items`
- `resources`
- `milestones`
- `curiosities`
- `activity`
- `hobby_notes`
- indexes
- Row Level Security policies
- a private `milestone-images` Storage bucket
- Storage policies so each signed-in user can only access their own image folder

You do not need to manually create any of those tables in the Dashboard.

## 3. Copy the two browser-safe connection values

In the Supabase Dashboard, use the project's **Connect** dialog or open **Settings → API Keys**.

You need only:

1. **Project URL**, which looks like:

   `https://abcdefghijk.supabase.co`

2. **Publishable key**, which looks like:

   `sb_publishable_...`

Do **not** use a Secret key and do **not** use a `service_role` key.

Open `config.js` and replace:

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR-PROJECT-REF.supabase.co",
  publishableKey: "sb_publishable_REPLACE_ME",
  showCreateAccount: true
};
```

with your real Project URL and publishable key.

The Project URL and publishable key are intentionally allowed to exist in browser code and therefore can be committed to a public GitHub repository. The protection comes from Supabase Auth + Row Level Security. A secret/service-role key must never be committed to GitHub or placed in frontend JavaScript.

## 4. Set the GitHub Pages URL in Supabase Auth

You should do this before creating your account so the email-confirmation link returns to the correct site.

Suppose your GitHub Pages site will be:

`https://YOUR-USERNAME.github.io/hobby-journal/`

In Supabase:

1. Open **Authentication**.
2. Open **URL Configuration**.
3. Set **Site URL** to your final GitHub Pages URL.
4. Add the same GitHub Pages URL as an allowed **Redirect URL**.

If your repository is your special `YOUR-USERNAME.github.io` repository, the URL may simply be:

`https://YOUR-USERNAME.github.io/`

Use the exact URL GitHub Pages gives you.

## 5. Publish the site to GitHub Pages

1. Create/open your GitHub repository.
2. Put all files from this folder in the repository root.
3. Commit and push them.
4. On GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Choose your main branch and `/ (root)`.
7. Save.
8. Open the GitHub Pages URL after deployment completes.

## 6. Create your one account

The first time you open the connected site, it shows a sign-in screen.

1. Enter the email address and password you want to use.
2. Click **Create account** once.
3. Supabase normally asks you to confirm your email on hosted projects.
4. Open the confirmation email.
5. Follow its link back to your GitHub Pages site.
6. Sign in.

Once you can sign in successfully, you have your owner account.

## 7. Lock new signups after your account exists

Because this is a personal website, there is no reason to leave public account creation enabled.

In Supabase:

1. Open **Authentication** settings / general configuration.
2. Turn off **Allow new users to sign up**.

Existing users can still sign in.

Then open `config.js` and change:

```js
showCreateAccount: true
```

to:

```js
showCreateAccount: false
```

Commit that tiny change. The public site will then show only **Sign in**.

Even before you disable signup, Row Level Security isolates each user's database rows. A second account would not be able to read your rows. Disabling signup is still cleaner for a personal site.

## 8. Use the site normally

After that, you do not need the Supabase Dashboard for day-to-day use.

From the website you can:

- create/edit/archive items
- pin up to two Current focus items
- log activity
- save resources to project items
- create milestones
- mark milestones achieved
- upload trophy images
- save curiosity items
- write hobby notes

Those changes go directly to Supabase.

## How login persistence works

The hobby data is **not** saved in localStorage.

For authentication only, this version gives Supabase `sessionStorage`. That means your signed-in session survives normal navigation/reloads within the browser tab, but closing the browser/tab may require you to sign in again later.

This is intentionally conservative for a personal site. If you later prefer “keep me signed in across browser restarts,” the auth session can be switched to persistent browser storage without moving any hobby data out of Supabase.

## Trophy images

Milestone images are uploaded to the private `milestone-images` Supabase Storage bucket. The browser receives a temporary signed URL to display an image after you sign in.

The setup script limits each image to 5 MB and accepts:

- JPEG
- PNG
- WebP
- GIF

Images are optional. A milestone works perfectly well without one.

## Free-plan note

This site is tiny compared with normal Supabase quotas, so ordinary personal use should remain comfortably inside the Free plan. Supabase can pause low-activity Free projects after an inactive period. If that happens, open the Supabase Dashboard and resume the project; the data remains associated with the project during the restore window.

## If the site says “Connect Supabase”

Check `config.js`. The placeholders have not been replaced, or the Supabase CDN did not load.

## If the site says the tables could not be loaded

Your URL/key are probably correct, but `supabase-setup.sql` has not been run successfully. Open SQL Editor and run the whole script again.

## If sign-in works but saves fail

Open Supabase **SQL Editor** and rerun `supabase-setup.sql`. Also check the project's Security Advisor and make sure the RLS policies exist.

## If confirmation links open the wrong URL

Open **Authentication → URL Configuration** and correct the Site URL / allowed Redirect URL to your exact GitHub Pages address.

## Important security rule

Only these may appear in the public repo:

- Supabase Project URL
- Supabase **publishable** key

Never commit:

- Supabase Secret key (`sb_secret_...`)
- legacy `service_role` key
- database password