#!/usr/bin/env node
/*
 * Builds data/manifest.json plus the sitemap and RSS feeds from the markdown
 * content folders (md/, development/md/, research/md/).
 *
 * The site's pages fetch /data/manifest.json (one same-origin request) instead
 * of calling the GitHub API from the browser, so listings keep working no
 * matter how many posts exist and never hit API rate limits.
 *
 * Drafts are excluded: set `draft: true` in frontmatter, or prefix the
 * filename with an underscore (e.g. _wip-idea.md).
 *
 * Run automatically by .github/workflows/content.yml on pushes to main, or
 * manually with: node scripts/build-manifest.mjs
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://somnolentlabs.com';

const SECTIONS = [
  { name: 'posts', dir: 'md', urlFor: (slug) => `/posts/post.html?slug=${slug}` },
  { name: 'development', dir: 'development/md', urlFor: () => '/development/' },
  { name: 'research', dir: 'research/md', urlFor: () => '/research/' },
];

// Pre-markdown-era posts that exist as static Hugo pages.
const LEGACY_POSTS = [
  { title: 'Dbl Check - Relaunch', date: '2025-06-02', url: '/posts/dblcheckrelaunch/' },
  { title: 'Currently working a lot with my buddy Claude', date: '2025-03-19', url: '/posts/let-us-cook/' },
  { title: 'Welcome To Somnolent Labs', date: '2025-03-08', url: '/posts/first-post/' },
];

// /dashboards/ is deliberately unlisted: reachable by direct link only.
const STATIC_PAGES = ['/', '/development/', '/research/', '/posts/'];

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, content: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > -1) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { meta, content: m[2] };
}

function gitAddedDate(relPath) {
  try {
    const out = execFileSync(
      'git',
      ['log', '--follow', '--diff-filter=A', '--format=%cI', '--', relPath],
      { cwd: ROOT, encoding: 'utf8' }
    ).trim();
    const lines = out.split('\n').filter(Boolean);
    return lines.length ? lines[lines.length - 1].slice(0, 10) : null;
  } catch {
    return null;
  }
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rfc822(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).toUTCString();
}

async function collectSection(section) {
  let files;
  try {
    files = await readdir(path.join(ROOT, section.dir));
  } catch {
    return [];
  }
  const items = [];
  for (const name of files.sort()) {
    if (!name.endsWith('.md') || name.startsWith('_')) continue;
    const relPath = `${section.dir}/${name}`;
    const text = await readFile(path.join(ROOT, relPath), 'utf8');
    const { meta, content } = parseFrontmatter(text);
    if ((meta.draft || '').toLowerCase() === 'true') continue;
    const slug = name.replace(/\.md$/, '');
    const fileDate = (slug.match(/^(\d{4}-\d{2}-\d{2})/) || [])[1];
    items.push({
      slug,
      title: meta.title || slug.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' '),
      date: meta.date || fileDate || gitAddedDate(relPath) || new Date().toISOString().slice(0, 10),
      file: `/${relPath}`,
      url: section.urlFor(slug),
      summary: content.trim().replace(/\s+/g, ' ').slice(0, 280),
    });
  }
  items.sort((a, b) => b.date.localeCompare(a.date));
  return items;
}

function buildRss({ title, link, description, items }) {
  const rssItems = items
    .map(
      (it) => `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${escapeXml(SITE + it.url)}</link>
      <guid isPermaLink="false">${escapeXml(SITE + it.url)}</guid>
      <pubDate>${rfc822(it.date)}</pubDate>${it.summary ? `
      <description>${escapeXml(it.summary)}</description>` : ''}
    </item>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(link)}index.xml" rel="self" type="application/rss+xml" />
${rssItems}
  </channel>
</rss>
`;
}

function buildSitemap(urls) {
  const entries = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(SITE + u.path)}</loc>${u.lastmod ? `
    <lastmod>${u.lastmod}</lastmod>` : ''}
  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

const sections = {};
for (const section of SECTIONS) {
  sections[section.name] = await collectSection(section);
}

const allPosts = [...sections.posts, ...LEGACY_POSTS].sort((a, b) =>
  b.date.localeCompare(a.date)
);

const manifest = {
  generated: new Date().toISOString(),
  posts: allPosts,
  development: sections.development,
  research: sections.research,
};

await mkdir(path.join(ROOT, 'data'), { recursive: true });
await writeFile(
  path.join(ROOT, 'data/manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n'
);

await writeFile(
  path.join(ROOT, 'index.xml'),
  buildRss({
    title: 'Somnolent Labs',
    link: `${SITE}/`,
    description: 'Recent posts from Somnolent Labs',
    items: allPosts,
  })
);
await writeFile(
  path.join(ROOT, 'development/index.xml'),
  buildRss({
    title: 'Somnolent Labs | Development',
    link: `${SITE}/development/`,
    description: 'Development updates from Somnolent Labs',
    items: sections.development,
  })
);
await writeFile(
  path.join(ROOT, 'research/index.xml'),
  buildRss({
    title: 'Somnolent Labs | Research',
    link: `${SITE}/research/`,
    description: 'Research updates from Somnolent Labs',
    items: sections.research,
  })
);

await writeFile(
  path.join(ROOT, 'sitemap.xml'),
  buildSitemap([
    ...STATIC_PAGES.map((p) => ({ path: p })),
    ...allPosts.map((p) => ({ path: p.url, lastmod: p.date })),
  ])
);

console.log(
  `manifest: ${allPosts.length} posts, ${sections.development.length} development, ${sections.research.length} research`
);
