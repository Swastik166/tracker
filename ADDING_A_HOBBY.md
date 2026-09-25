# Adding a new hobby

A hobby is still repository-defined. Adding one needs only two small edits; no Supabase table or SQL change is required.

## 1. Copy the template

Duplicate:

`hobbies/_template.html`

Rename it, for example:

`hobbies/woodworking.html`

Near the bottom, change only:

```js
window.HOBBY_PAGE = {
  id: "woodworking",
  name: "Woodworking",
  description: "Projects, techniques, tools, and ideas I want to remember."
};
```

Keep the `id` lowercase and use hyphens instead of spaces.

## 2. Add the hobby to the home-page list

Open `hobbies.js` and add:

```js
{
  id: "woodworking",
  name: "Woodworking",
  page: "hobbies/woodworking.html",
  description: "Projects, techniques, tools, and ideas I want to remember."
}
```

Commit and push. GitHub Pages publishes the new page. Once the page exists, entries made on it are automatically stored in the same Supabase database under `hobby_id = woodworking`.

## Removing a hobby

Delete its HTML file and remove its entry from `hobbies.js`.

Database records for that hobby are intentionally not automatically deleted. This prevents accidental data loss. If you later recreate a hobby with the same ID, its old records become visible again.
