# Adding a new hobby

The site is intentionally set up so a new hobby needs only two small repository changes.

## 1. Copy the template

Duplicate:

`hobbies/_template.html`

Rename the copy, for example:

`hobbies/woodworking.html`

Near the bottom of that file, change only this block:

```js
window.HOBBY_PAGE = {
  id: "woodworking",
  name: "Woodworking",
  description: "Projects, techniques, tools, and ideas I want to remember."
};
```

The `id` should be lowercase and use hyphens instead of spaces.

## 2. Add it to the home page list

Open `hobbies.js` and add one object:

```js
{
  id: "woodworking",
  name: "Woodworking",
  page: "hobbies/woodworking.html",
  description: "Projects, techniques, tools, and ideas I want to remember."
}
```

Commit and push those two changes. GitHub Pages will publish the new hobby page automatically.

## Removing a starter hobby

Delete its HTML file from `hobbies/` and remove its object from `hobbies.js`.

Deleting a page does not automatically erase data that was previously saved in the browser for that hobby ID.
