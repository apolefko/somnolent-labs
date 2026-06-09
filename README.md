# Somnolent Labs

Source for [somnolentlabs.com](https://somnolentlabs.com) — a static site served by
GitHub Pages from the repo root. There is no build framework: pages are plain HTML,
and content is markdown rendered in the browser.

## Publishing (from anywhere)

Drop a markdown file in the right folder, commit to `main`, done:

| Folder | Shows up on |
| --- | --- |
| `md/` | `/posts` (each file gets its own page at `/posts/post.html?slug=<filename>`) |
| `development/md/` | `/development` (rendered inline on the page) |
| `research/md/` | `/research` (rendered inline on the page) |

Files use optional YAML frontmatter:

```markdown
---
title: My Post Title
date: 2026-06-09
---

Post body in **markdown**.
```

If `title` or `date` are missing they're derived from the filename
(`2026-06-09-my-post.md` → date + "my post") or from git history.

### Drafts

Two ways to keep a file unpublished while it lives in the repo:

- add `draft: true` to the frontmatter, or
- prefix the filename with an underscore (e.g. `_wip-idea.md`).

## How it works

- On every push to `main` that touches content, the
  [`content.yml`](.github/workflows/content.yml) workflow runs
  [`scripts/build-manifest.mjs`](scripts/build-manifest.mjs), which regenerates:
  - `data/manifest.json` — the single listing the pages fetch (no GitHub API
    calls from the browser, so no rate limits),
  - `index.xml`, `development/index.xml`, `research/index.xml` — RSS feeds,
  - `sitemap.xml`.
  The workflow commits those files back automatically. You can also run the
  script locally: `node scripts/build-manifest.mjs`.
- [`js/site.js`](js/site.js) holds the shared page logic: manifest loading,
  markdown rendering (via marked.js), and deferred loading of the background
  video (phones never download it).
- [`js/theme.js`](js/theme.js) + [`css/theme.css`](css/theme.css) implement the
  light/dark/system theme switcher.
- `.nojekyll` disables Jekyll so GitHub Pages serves `md/*.md` and
  `data/manifest.json` verbatim.

## Everything else

- `dashboards/` — self-contained retro terminal dashboards, linked from the nav.
- `posts/first-post/`, `posts/let-us-cook/`, `posts/dblcheckrelaunch/` — legacy
  posts from the old Hugo build, kept as static pages (listed via the manifest).
- `privacy-policy-dbl-check.html`, `success.html` — pages for the
  [Dbl Check](https://chromewebstore.google.com/detail/dbl-check/labkdeadaiekmeajaiknljnjpockolfj)
  Chrome extension (privacy policy and Stripe checkout success).
- `video/` — background video (compressed; keep it small, it loads on every page)
  and its poster frame.
- `css/main.min.*.css`, `js/main.*.js` — leftover hashed assets from the Hugo
  era; legacy pages still reference them.
