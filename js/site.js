/*
 * Shared logic for the markdown-driven pages (posts, development, research).
 * Listings come from /data/manifest.json — a single same-origin fetch built by
 * scripts/build-manifest.mjs — and post bodies are fetched same-origin from
 * the markdown folders, so nothing here touches the GitHub API.
 */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(str) {
    var d = new Date(str.indexOf('T') > -1 ? str : str + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function parseFrontmatter(text) {
    var m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { meta: {}, content: text };
    var meta = {};
    m[1].split('\n').forEach(function (line) {
      var idx = line.indexOf(':');
      if (idx > -1) meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    });
    return { meta: meta, content: m[2] };
  }

  function loadManifest() {
    return fetch('/data/manifest.json').then(function (r) {
      if (!r.ok) throw new Error('manifest unavailable');
      return r.json();
    });
  }

  function showError(el, message) {
    el.innerHTML = '<p class="text-muted">' + escapeHtml(message) + '</p>';
  }

  /* Posts page: linked list of titles + dates. */
  function renderPostList(elId) {
    var el = document.getElementById(elId);
    loadManifest()
      .then(function (manifest) {
        el.innerHTML = manifest.posts
          .map(function (p) {
            return (
              '<div class="row mb-3">' +
              '<time datetime="' + escapeHtml(p.date) + '">' + formatDate(p.date) + '</time>' +
              '<h2 class="h5"><a href="' + escapeHtml(p.url) + '">' + escapeHtml(p.title) + '</a></h2>' +
              '</div>'
            );
          })
          .join('');
      })
      .catch(function () {
        showError(el, 'Could not load posts — please try refreshing.');
      });
  }

  /* Development / research pages: full markdown content rendered inline. */
  function renderSectionInline(sectionName, elId) {
    var el = document.getElementById(elId);
    loadManifest()
      .then(function (manifest) {
        var items = manifest[sectionName] || [];
        if (!items.length) {
          showError(el, 'Coming soon.');
          return;
        }
        return Promise.all(
          items.map(function (item) {
            return fetch(item.file)
              .then(function (r) { return r.text(); })
              .then(function (text) {
                var content = parseFrontmatter(text).content;
                return (
                  '<div class="mb-5">' +
                  (item.date
                    ? '<time datetime="' + escapeHtml(item.date) + '" class="text-muted small">' + formatDate(item.date) + '</time>'
                    : '') +
                  '<h4 class="text-uppercase">' + escapeHtml(item.title) + '</h4>' +
                  '<div>' + marked.parse(content) + '</div>' +
                  '</div>'
                );
              });
          })
        ).then(function (blocks) {
          el.innerHTML = blocks.join('');
        });
      })
      .catch(function () {
        showError(el, 'Could not load this section — please try refreshing.');
      });
  }

  /* Single post page (post.html?slug=...). */
  function renderPost() {
    var slug = new URLSearchParams(location.search).get('slug');
    if (!slug || !/^[\w-]+$/.test(slug)) {
      location.href = '/posts';
      return;
    }
    fetch('/md/' + slug + '.md')
      .then(function (r) {
        if (!r.ok) throw new Error('not found');
        return r.text();
      })
      .then(function (text) {
        var parsed = parseFrontmatter(text);
        var title =
          parsed.meta.title ||
          slug.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-/g, ' ');
        document.title = 'Somnolent Labs | ' + title;
        document.getElementById('post-title').textContent = title;
        if (parsed.meta.date) {
          var dateEl = document.getElementById('post-date');
          dateEl.textContent = formatDate(parsed.meta.date);
          dateEl.setAttribute('datetime', parsed.meta.date);
        }
        document.getElementById('post-content').innerHTML = marked.parse(parsed.content);
      })
      .catch(function () {
        document.getElementById('post-title').textContent = 'Post not found';
        document.getElementById('post-content').innerHTML =
          '<p><a href="/posts">&larr; back to posts</a></p>';
      });
  }

  /*
   * Deferred video loading. Videos declare data-src (and optionally
   * data-media); the source is only attached when the media query matches,
   * so phones never download the desktop background video.
   */
  function initVideos() {
    var videos = document.querySelectorAll('video[data-src]');
    Array.prototype.forEach.call(videos, function (video) {
      var media = video.getAttribute('data-media');
      var attach = function () {
        if (video.src) return;
        video.src = video.getAttribute('data-src');
        video.play && video.play().catch(function () {});
      };
      if (!media || !window.matchMedia) {
        attach();
        return;
      }
      var mql = window.matchMedia(media);
      if (mql.matches) {
        attach();
      } else if (mql.addEventListener) {
        mql.addEventListener('change', function (e) {
          if (e.matches) attach();
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideos);
  } else {
    initVideos();
  }

  window.SL = {
    renderPostList: renderPostList,
    renderSectionInline: renderSectionInline,
    renderPost: renderPost,
  };
})();
