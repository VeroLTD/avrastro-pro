/* AVRASTRO theme — navigation (menu drawer, sub-menus), the article library's "more" link and the explainer films' play button. No storage, no demo logic. */
(function () {
  'use strict';
  var S = (window.VERO_SITE && window.VERO_SITE.strings) || {};
  var toggle = document.querySelector('[data-menu-toggle]');
  var nav = document.querySelector('[data-nav]');
  var label = toggle && toggle.querySelector('.menu-toggle__label');

  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    if (label) label.textContent = open ? (S.close || 'Κλείσιμο') : (S.menu || 'Μενού');
    if (open) {
      var first = nav.querySelector('a, button');
      if (first) first.focus();
    }
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
    });
    var mq = window.matchMedia('(min-width: 1181px)');
    var onChange = function () { if (mq.matches) setMenu(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }

  // disclosure sub-menus
  var subs = Array.prototype.slice.call(document.querySelectorAll('.nav-link--toggle'));
  function closeAll(except) {
    subs.forEach(function (b) {
      if (b === except) return;
      b.setAttribute('aria-expanded', 'false');
      var l = document.getElementById(b.getAttribute('aria-controls'));
      if (l) l.hidden = true;
    });
  }
  subs.forEach(function (b) {
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') !== 'true';
      closeAll(b);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      var l = document.getElementById(b.getAttribute('aria-controls'));
      if (l) l.hidden = !open;
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('.has-sub')) closeAll(null);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = subs.filter(function (b) { return b.getAttribute('aria-expanded') === 'true'; })[0];
    if (open) { closeAll(null); open.focus(); }
  });

  // article library: "More articles" adds the next page under the cards already shown. Without script (or if the
  // request fails) it is an ordinary link to the next page, and the numbered pages below it always work.
  var more = document.querySelector('[data-vero-more]');
  var list = document.querySelector('[data-vero-list]');
  if (more && list && window.fetch && window.DOMParser) {
    var status = document.querySelector('[data-vero-more-status]');
    more.addEventListener('click', function (e) {
      if (more.getAttribute('aria-busy') === 'true') { e.preventDefault(); return; }
      e.preventDefault();
      more.setAttribute('aria-busy', 'true');
      fetch(more.href, { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var cards = doc.querySelectorAll('[data-vero-list] > .post-card');
          if (!cards.length) throw new Error('empty');
          var first = null;
          Array.prototype.forEach.call(cards, function (c) { var n = document.importNode(c, true); list.appendChild(n); first = first || n; });
          var next = doc.querySelector('[data-vero-more]');
          var st = doc.querySelector('[data-vero-more-status]');
          if (status && st) status.textContent = st.textContent;
          if (next) { more.href = next.href; } else { more.hidden = true; }
          var link = first && first.querySelector('a');
          if (link) link.focus({ preventScroll: true });
        })
        .catch(function () { window.location.href = more.href; })
        .then(function () { more.removeAttribute('aria-busy'); });
    });
  }

  // «Τι κάνω αν…» guides: a "Print this page" link (href="#print") opens the browser's print dialog; without script it
  // does nothing harmful (an in-page anchor) and the browser's own Print still works
  Array.prototype.forEach.call(document.querySelectorAll('a[href$="#print"]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); window.print(); });
  });

  // 8.6.0 — the printed page's date (inc/print.php .print-head) is the day it is printed, also when the page itself was
  // served from a cache made on an earlier day
  // …and folded answers (questions and answers, details) print open, then fold back; the account area's «print this
  // document» (connect.js, body.printing-portal) chooses its own
  var unfolded = [];
  window.addEventListener('beforeprint', function () {
    if (document.body.classList.contains('printing-portal')) return;
    Array.prototype.forEach.call(document.querySelectorAll('main details:not([open])'), function (d) { d.open = true; unfolded.push(d); });
  });
  window.addEventListener('afterprint', function () { unfolded.forEach(function (d) { d.open = false; }); unfolded = []; });

  var printDate = document.querySelector('[data-print-date]');
  if (printDate && window.Intl) {
    window.addEventListener('beforeprint', function () {
      var l = printDate.getAttribute('data-lang');
      try { printDate.textContent = new Date().toLocaleDateString(l === 'ru' ? 'ru-RU' : l === 'en' ? 'en-GB' : 'el-GR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { /* keep the server's date */ }
    });
  }

  // 8.4.0 — lists the visitor narrows to their own situation (guides/documents, guides/life-events): the group headings
  // become checkboxes under the lead line; unticked groups are hidden on screen and in print. Without script every group
  // shows, which is still a complete list. Nothing is stored or sent.
  Array.prototype.forEach.call(document.querySelectorAll('.vero-picker'), function (root, n) {
    var lead = root.querySelector('.vero-picker__lead');
    var groups = root.querySelectorAll('.vero-picker__group:not(.is-always)');
    if (!lead || !groups.length) return;
    var set = document.createElement('fieldset');
    set.className = 'vero-picker__controls';
    var legend = document.createElement('legend');
    legend.textContent = lead.textContent;
    set.appendChild(legend);
    Array.prototype.forEach.call(groups, function (g, i) {
      var h = g.querySelector('h3');
      if (!h) return;
      var id = 'vero-pick-' + n + '-' + i;
      g.id = g.id || id + '-group';
      g.hidden = true;
      var label = document.createElement('label');
      label.className = 'vero-picker__chip';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.id = id;
      box.setAttribute('aria-controls', g.id);
      box.addEventListener('change', function () {
        g.hidden = !box.checked;
        label.classList.toggle('is-on', box.checked);
        root.classList.toggle('has-choice', !!root.querySelector('.vero-picker__controls input:checked'));
      });
      label.appendChild(box);
      label.appendChild(document.createTextNode(h.textContent));
      set.appendChild(label);
    });
    lead.replaceWith(set);
    root.classList.add('is-enhanced');
  });

  // 8.4.0 — glossary search (guides/glossary): the paragraph with the label text becomes a search box; it matches the
  // term in all three languages and the meaning, ignoring accents and case
  Array.prototype.forEach.call(document.querySelectorAll('.vero-glossary'), function (root, n) {
    var p = root.querySelector('.vero-glossary__search');
    var empty = root.querySelector('.vero-glossary__empty');
    var terms = root.querySelectorAll('.vero-term');
    if (!p || !terms.length) return;
    var fold = function (s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ'); };
    var label = document.createElement('label');
    label.className = 'vero-glossary__label';
    label.setAttribute('for', 'vero-glossary-q-' + n);
    label.textContent = p.textContent;
    var input = document.createElement('input');
    input.type = 'search';
    input.id = 'vero-glossary-q-' + n;
    input.className = 'vero-glossary__input';
    input.setAttribute('autocomplete', 'off');
    if (empty) { empty.id = 'vero-glossary-empty-' + n; empty.setAttribute('role', 'status'); empty.hidden = true; }
    var wrap = document.createElement('div');
    wrap.className = 'vero-glossary__search';
    wrap.appendChild(label);
    wrap.appendChild(input);
    p.replaceWith(wrap);
    root.classList.add('is-enhanced');
    var index = Array.prototype.map.call(terms, function (t) { return fold(t.textContent); });
    input.addEventListener('input', function () {
      var q = fold(input.value.trim());
      var shown = 0;
      Array.prototype.forEach.call(terms, function (t, i) { var on = !q || index[i].indexOf(q) !== -1; t.hidden = !on; if (on) shown++; });
      if (empty) empty.hidden = shown > 0;
    });
  });

  // explainer films ([vero_video]): a large play button for the first start, one film playing at a time
  var films = document.querySelectorAll('.vero-film');
  Array.prototype.forEach.call(films, function (f) {
    var v = f.querySelector('video');
    var b = f.querySelector('.vero-film__play');
    if (!v) return;
    v.addEventListener('play', function () {
      f.classList.add('is-started');
      if (b) b.hidden = true;
      Array.prototype.forEach.call(document.querySelectorAll('.vero-film video'), function (o) { if (o !== v && !o.paused) o.pause(); });
    });
    if (!b) return;
    // until the first start: just the poster and the big button (the player's own controls come with playback)
    b.hidden = false;
    v.controls = false;
    function start() {
      v.controls = true;
      var p = v.play();
      if (p && p.catch) p.catch(function () { b.hidden = false; });
      v.focus({ preventScroll: true });
    }
    b.addEventListener('click', start);
    v.addEventListener('click', function () { if (!f.classList.contains('is-started')) start(); });
    v.addEventListener('ended', function () { b.hidden = false; f.classList.remove('is-started'); });
  });
})();
