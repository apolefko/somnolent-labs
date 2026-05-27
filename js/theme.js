(function () {
  'use strict';

  var STORAGE_KEY = 'sl-theme';
  var MODES = ['light', 'dark', 'system'];
  var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function getPref() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return MODES.indexOf(v) >= 0 ? v : 'system';
    } catch (e) {
      return 'system';
    }
  }

  function setPref(mode) {
    try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) {}
  }

  function applyTheme() {
    var pref = getPref();
    var isDark = pref === 'dark' || (pref === 'system' && mql && mql.matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    var buttons = document.querySelectorAll('.sl-theme-switcher button');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var active = btn.getAttribute('data-mode') === pref;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function buildSwitcher() {
    if (document.querySelector('.sl-theme-switcher')) return;
    var container = document.createElement('div');
    container.className = 'sl-theme-switcher';
    container.setAttribute('role', 'group');
    container.setAttribute('aria-label', 'Theme preference');
    MODES.forEach(function (mode) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-mode', mode);
      btn.textContent = mode === 'system' ? 'Auto' : (mode.charAt(0).toUpperCase() + mode.slice(1));
      btn.setAttribute('aria-label', 'Use ' + mode + ' theme');
      btn.addEventListener('click', function () {
        setPref(mode);
        applyTheme();
      });
      container.appendChild(btn);
    });
    document.body.appendChild(container);
    applyTheme();
  }

  if (mql) {
    var onSystemChange = function () {
      if (getPref() === 'system') applyTheme();
    };
    if (mql.addEventListener) mql.addEventListener('change', onSystemChange);
    else if (mql.addListener) mql.addListener(onSystemChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildSwitcher);
  } else {
    buildSwitcher();
  }
})();
