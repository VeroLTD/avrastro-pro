/* AVRASTRO Connect 1.13 — the assistant launcher and panel (ideas track 20; owner, 16 Oct 2026: «ζωντανό chat»).
   Plain script, no build step. ONE script for both personas and both sites:
     mode "citizen"  avrastro.com — answers from the site's own pages (POST /wp-json/vero/v1/assistant, same site)
     mode "pro"      AVRASTRO Pro on avrastro.com/pro/ (POST /wp-json/vero/v1/pro-assistant) and on the static site
                     pro.avrastro.com (POST <platform>/v1/pro-assistant, CORS; the page asks <platform>/…/status first)
   The configuration comes from window.VERO_ASSIST (WordPress) or from <script type="application/json" id="vero-assist-config">
   (static site, whose Content-Security-Policy allows no inline script). Nothing of the conversation is kept: no cookies,
   no storage; reloading the page starts again. Every text is set as text (never as HTML); links only to http(s) or to
   addresses of this site. Accessible: a real dialog (labelled, described by the AI notice), Escape closes, focus returns
   to the launcher; on a phone it is a bottom sheet that keeps the focus inside while open. */
(function () {
  'use strict';
  var root = document.querySelector('[data-vero-assist]');
  var C = window.VERO_ASSIST;
  if (!C) { var j = document.getElementById('vero-assist-config'); if (j) { try { C = JSON.parse(j.textContent || '{}'); } catch (e) { C = null; } } }
  if (!C || !root || !window.fetch || !document.createElement('div').classList) return;
  var pro = C.mode === 'pro';
  var I = C.i18n || {};
  function T(k, vars) {
    var v = (pro && I['assistant.pro_' + k]) || I['assistant.' + k] || '';
    if (vars) for (var n in vars) v = v.split('{' + n + '}').join(String(vars[n]));
    return v;
  }
  function el(tag, cls, text, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== '') n.textContent = text;
    if (attrs) for (var a in attrs) { if (attrs[a] === true) n.setAttribute(a, ''); else if (attrs[a] != null && attrs[a] !== false) n.setAttribute(a, attrs[a]); }
    return n;
  }
  function safeUrl(u) { u = String(u || ''); return /^https?:\/\//i.test(u) || (u.charAt(0) === '/' && u.charAt(1) !== '/') ? u : ''; }
  function link(text, href, cls) { var a = el('a', cls, text); a.href = href; return a; }
  var SVG = 'http://www.w3.org/2000/svg';
  function icon(name) {
    var s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    var d = {
      chat: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z',
      send: 'M4.4 11.1 18.8 4.6c.9-.4 1.8.5 1.4 1.4l-6.5 14.4c-.4.9-1.7.8-1.9-.2l-1.3-5.2-5.2-1.3c-1-.2-1.1-1.5-.2-1.9z',
      close: 'M6 6l12 12M18 6 6 18',
      refresh: 'M19 12a7 7 0 1 1-2.05-4.95M19 4v4h-4',
      person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8c.6-3.4 3.5-5.5 7-5.5s6.4 2.1 7 5.5',
      arrow: 'M5 12h13m-5-5 5 5-5 5',
    }[name];
    var p = document.createElementNS(SVG, 'path'); p.setAttribute('d', d);
    if (name === 'chat' || name === 'send') { p.setAttribute('fill', 'currentColor'); } else { p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); }
    s.appendChild(p);
    return s;
  }
  function badge() { return el('span', 'vero-assist__ai', T('ai_badge'), { 'aria-hidden': 'true' }); }

  // ---------------------------------------------------------------------------------------------------- the frame
  var launcher = el('button', 'vero-assist__launcher', null, { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'vero-assist-panel', 'aria-haspopup': 'dialog', 'data-assist-open': true });
  var lIcon = el('span', 'vero-assist__launcher-icon'); lIcon.appendChild(icon('chat'));
  launcher.appendChild(lIcon);
  launcher.appendChild(el('span', 'vero-assist__launcher-text', T('open')));
  launcher.appendChild(badge());
  launcher.setAttribute('aria-label', T('open') + ' (' + T('ai_badge') + ')');

  var backdrop = el('div', 'vero-assist__backdrop', null, { hidden: true });
  var panel = el('section', 'vero-assist__panel', null, { id: 'vero-assist-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'vero-assist-title', 'aria-describedby': 'vero-assist-note', hidden: true });
  var head = el('header', 'vero-assist__head');
  var mark = el('span', 'vero-assist__mark', null, { 'aria-hidden': 'true' }); mark.appendChild(icon('chat'));
  var titles = el('div', 'vero-assist__titles');
  var h2 = el('h2', null, T('title'), { id: 'vero-assist-title' }); h2.appendChild(document.createTextNode(' ')); h2.appendChild(el('span', 'vero-assist__ai', T('ai_badge')));
  titles.appendChild(h2);
  titles.appendChild(el('p', 'vero-assist__sub', T('subtitle')));
  var fresh = el('button', 'vero-assist__icon-btn', null, { type: 'button', title: T('new_chat'), 'aria-label': T('new_chat'), 'data-assist-new': true }); fresh.appendChild(icon('refresh'));
  var close = el('button', 'vero-assist__icon-btn', null, { type: 'button', title: T('close'), 'aria-label': T('close'), 'data-assist-close': true }); close.appendChild(icon('close'));
  head.appendChild(mark); head.appendChild(titles); head.appendChild(fresh); head.appendChild(close);
  var note = el('p', 'vero-assist__note', T('disclosure'), { id: 'vero-assist-note' });
  var log = el('div', 'vero-assist__log', null, { role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '-1', 'data-assist-log': true });
  var form = el('form', 'vero-assist__form', null, { novalidate: true, 'data-assist-form': true });
  var qLabel = el('label', 'vero-assist__label', T('label'), { 'for': 'vero-assist-q' });
  var row = el('div', 'vero-assist__row');
  var q = el('textarea', null, null, { id: 'vero-assist-q', name: 'question', rows: '1', maxlength: '500', required: true, placeholder: T('placeholder'), autocomplete: 'off', 'aria-describedby': 'vero-assist-privacy' });
  var hp = el('input', 'vc-hp', null, { type: 'text', name: 'vc_hp_x', value: '', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
  var send = el('button', 'vero-assist__send', null, { type: 'submit', 'aria-label': T('send'), title: T('send') }); send.appendChild(icon('send'));
  row.appendChild(q); row.appendChild(send);
  var meta = el('div', 'vero-assist__meta');
  var privacy = el('p', 'vero-assist__small', T('privacy'), { id: 'vero-assist-privacy' });
  var count = el('span', 'vero-assist__count', null, { 'aria-live': 'polite', hidden: true });
  var human = el('button', 'vero-assist__human', null, { type: 'button', 'data-assist-human': true }); human.appendChild(icon('person')); human.appendChild(el('span', null, T('human')));
  meta.appendChild(privacy); meta.appendChild(count);
  form.appendChild(qLabel); form.appendChild(row); form.appendChild(hp); form.appendChild(meta); form.appendChild(human);
  panel.appendChild(head); panel.appendChild(note); panel.appendChild(log); panel.appendChild(form);
  root.appendChild(launcher); root.appendChild(backdrop); root.appendChild(panel);

  // ----------------------------------------------------------------------------------------------- open / close
  var small = window.matchMedia ? window.matchMedia('(max-width: 600px)') : { matches: false };
  function isOpen() { return !panel.hidden; }
  function show(on) {
    panel.hidden = !on; launcher.setAttribute('aria-expanded', on ? 'true' : 'false');
    root.classList.toggle('is-open', on);
    var sheet = on && small.matches;
    backdrop.hidden = !sheet; panel.setAttribute('aria-modal', sheet ? 'true' : 'false');
    document.documentElement.classList.toggle('vero-assist-lock', sheet);
    if (on) { if (!log.childNodes.length) greet(); setTimeout(function () { q.focus(); }, 30); } else { launcher.focus(); }
  }
  launcher.addEventListener('click', function () { show(!isOpen()); });
  close.addEventListener('click', function () { show(false); });
  backdrop.addEventListener('click', function () { show(false); });
  fresh.addEventListener('click', function () { while (log.firstChild) log.removeChild(log.firstChild); last = { q: '', topic: '' }; greet(); q.focus(); });
  panel.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.preventDefault(); show(false); return; }
    if (e.key !== 'Tab' || panel.getAttribute('aria-modal') !== 'true') return;
    var f = panel.querySelectorAll('button:not([disabled]), a[href], textarea, input:not([type=hidden]):not(.vc-hp), select');
    var list = []; for (var i = 0; i < f.length; i++) if (f[i].offsetParent !== null) list.push(f[i]);
    if (!list.length) return;
    if (e.shiftKey && document.activeElement === list[0]) { e.preventDefault(); list[list.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === list[list.length - 1]) { e.preventDefault(); list[0].focus(); }
  });

  // ----------------------------------------------------------------------------------------------------- messages
  var last = { q: '', topic: '' };
  function scroll() { log.scrollTop = log.scrollHeight; }
  function bubble(who, text) {
    var m = el('div', 'vero-assist__msg vero-assist__msg--' + who);
    if (who !== 'note') m.appendChild(el('span', 'vc-visually-hidden screen-reader-text', who === 'me' ? T('you') : T('ai_said')));
    if (text) String(text).split(/\n{2,}/).forEach(function (para) { if (para.trim()) m.appendChild(el('p', null, para.trim())); });
    log.appendChild(m); scroll();
    return m;
  }
  function greet() {
    var m = bubble('ai', T('greeting'));
    var st = (C.starters || []).filter(function (s) { return s && s.indexOf('assistant.') !== 0; });
    if (st.length) {
      m.appendChild(el('p', 'vero-assist__hint', T('starters')));
      var ul = el('ul', 'vero-assist__chips');
      st.forEach(function (s) { var li = el('li'); var b = el('button', 'vero-assist__chip', s, { type: 'button' }); b.addEventListener('click', function () { ask(s); }); li.appendChild(b); ul.appendChild(li); });
      m.appendChild(ul);
    }
  }
  function sourceUrl(s) {
    if (s.url) return safeUrl(s.url);
    if (pro && C.proBase != null && typeof s.path === 'string') {
      var p = s.path.replace(/^\/+|\/+$/g, '');
      if (C.links && C.links[p]) return safeUrl(C.links[p]); // sign-up and contact stay on avrastro.com
      if (['', 'crm', 'plans', 'guides', 'partners', 'tour'].indexOf(p) < 0) p = 'guides';
      return safeUrl(C.proBase + (p ? p + '/' : ''));
    }
    return '';
  }
  function answer(j) {
    // the [1] [2] citation marks stay out of the text: the pages they point to are listed under the answer
    var m = bubble('ai', String(j.answer || T('err')).replace(/\s*\[\d\](?=[\s.,;:!?·)]|$)/g, ''));
    var seen = {}, items = [];
    (j.sources || []).forEach(function (s) { var u = sourceUrl(s); if (u && !seen[u]) { seen[u] = 1; items.push([s.title || u, u]); } });
    if (items.length) {
      var box = el('div', 'vero-assist__src'); box.appendChild(el('p', 'vero-assist__src-title', T('sources')));
      var ul = el('ul');
      items.forEach(function (x) { var li = el('li'); li.appendChild(link(x[0], x[1])); ul.appendChild(li); });
      box.appendChild(ul); m.appendChild(box);
    }
    if (j.tool && safeUrl(j.tool.url)) {
      var t = link('', safeUrl(j.tool.url), 'vero-assist__tool');
      t.appendChild(el('span', 'vero-assist__tool-label', T('tool'))); t.appendChild(el('strong', null, j.tool.title || '')); t.appendChild(icon('arrow'));
      m.appendChild(t);
    }
    if (j.booking && safeUrl(j.booking)) m.appendChild(link(T('booking'), safeUrl(j.booking), 'vero-assist__book'));
    scroll();
  }
  function ask(text) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 3) { q.setAttribute('aria-invalid', 'true'); q.focus(); return; }
    q.removeAttribute('aria-invalid');
    bubble('me', text); q.value = ''; resize(); counter(); send.disabled = true;
    var wait = bubble('ai'); wait.classList.add('is-wait'); wait.setAttribute('aria-busy', 'true');
    wait.appendChild(el('p', null, T('thinking'))); var dots = el('span', 'vero-assist__dots', null, { 'aria-hidden': 'true' }); dots.appendChild(el('i')); dots.appendChild(el('i')); dots.appendChild(el('i')); wait.appendChild(dots);
    var body = { question: text, lang: C.lang, vc_hp_x: hp.value };
    var init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vero-Lang': C.lang }, body: JSON.stringify(body) };
    if (C.platform) { init.mode = 'cors'; init.credentials = 'omit'; init.headers = { 'Content-Type': 'application/json' }; init.body = JSON.stringify({ question: text, lang: C.lang, website: hp.value }); }
    else init.credentials = 'same-origin';
    fetch(C.rest, init)
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j || {} }; }); })
      .then(function (x) {
        wait.remove();
        if (!x.ok) { bubble('ai', x.j.message || T('err')); return; }
        if (x.j.outcome !== 'sensitive' && x.j.outcome !== 'rejected') last.q = text;
        if (x.j.topic) last.topic = x.j.topic;
        answer(x.j);
      })
      .catch(function () { wait.remove(); bubble('ai', T('err')); })
      .then(function () { send.disabled = false; });
  }
  function resize() { q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 140) + 'px'; }
  function counter() { var n = q.value.length; count.hidden = n < 400; count.textContent = T('chars', { n: n }); }
  q.addEventListener('input', function () { resize(); counter(); });
  q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!send.disabled) ask(q.value); } });
  form.addEventListener('submit', function (e) { e.preventDefault(); if (!send.disabled) ask(q.value); });

  // --------------------------------------------------------------------------------- «I want to talk to a person»
  human.addEventListener('click', function () { handoff(); });
  function card(title) { var m = bubble('note'); m.classList.add('vero-assist__card'); if (title) m.appendChild(el('h3', null, title)); return m; }
  function handoff(kind) {
    var H = C.handoff || {};
    if (pro) {
      var p = card(T('contact')); p.appendChild(el('p', null, T('human_text')));
      if (safeUrl(H.contact)) p.appendChild(link(T('contact'), safeUrl(H.contact), 'vero-assist__cta'));
      return focusCard(p);
    }
    if (!kind) {
      // the answer's topic wins; before any answer, the page's own topic
      var t = last.topic || '';
      // life → the advisor; general insurance → information only; an information-only page or anything else → the visitor chooses
      if (t === 'life') kind = 'life'; else if (t === 'general') kind = 'general'; else if (t === 'info') kind = 'choose';
      else kind = ({ life: 'life', health: 'life', saving: 'life', family: 'life', claims: 'life', general: 'general' })[C.topic] || 'choose';
    }
    if (kind === 'choose') {
      var c = card(T('h_choose'));
      var ul = el('ul', 'vero-assist__chips');
      [['life', T('h_choose_life')], ['general', T('h_choose_general')]].forEach(function (x) { var li = el('li'); var b = el('button', 'vero-assist__chip', x[1], { type: 'button' }); b.addEventListener('click', function () { handoff(x[0]); }); li.appendChild(b); ul.appendChild(li); });
      c.appendChild(ul);
      return focusCard(c);
    }
    if (kind === 'general') {
      var g = card(T('h_general_title')); g.appendChild(el('p', null, T('h_general_text')));
      var gl = el('ul', 'vero-assist__links');
      (H.info || []).forEach(function (x) { if (safeUrl(x.url)) { var li = el('li'); li.appendChild(link(x.title, safeUrl(x.url))); gl.appendChild(li); } });
      g.appendChild(gl);
      return focusCard(g);
    }
    var L = H.life;
    var lc = card(T('h_life_title'));
    if (!L) { lc.appendChild(el('p', null, T('h_no_advisor'))); if (safeUrl(H.contactPage)) lc.appendChild(link(T('h_contact_page'), safeUrl(H.contactPage))); return focusCard(lc); }
    if (L.advisor && L.advisor.name) lc.appendChild(el('p', 'vero-assist__advisor', L.advisor.name + (L.advisor.title ? ' · ' + L.advisor.title : '')));
    lc.appendChild(el('p', null, T('h_life_text')));
    lc.appendChild(callback(L));
    if (safeUrl(L.booking)) lc.appendChild(link(T('book'), safeUrl(L.booking), 'vero-assist__book'));
    focusCard(lc);
  }
  function focusCard(m) {
    var h = m.querySelector('h3');
    log.scrollTop = Math.max(0, m.offsetTop - log.offsetTop - 8); // the card's top in view, not its end
    if (h) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
    return m;
  }

  var seq = 0;
  function callback(L) {
    var id = 'vacb' + (++seq) + '-';
    var f = el('form', 'vero-assist__cb', null, { novalidate: true });
    f.appendChild(el('h4', null, T('cb_title')));
    var token = '', tokenAt = 0;
    fetch(L.token, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) { token = j.token || ''; tokenAt = Date.now(); }).catch(function () {});
    function field(name, label, type, auto) {
      var w = el('div', 'vero-assist__field');
      w.appendChild(el('label', null, label, { 'for': id + name }));
      var i = el('input', null, null, { id: id + name, name: name, type: type, autocomplete: auto, required: true });
      w.appendChild(i); f.appendChild(w); return i;
    }
    var name = L.signedIn ? null : field('name', T('cb_name'), 'text', 'name');
    var email = L.signedIn ? null : field('email', T('cb_email'), 'email', 'email');
    var phone = field('phone', T('cb_phone'), 'tel', 'tel');
    var tw = el('div', 'vero-assist__field');
    tw.appendChild(el('label', null, T('cb_time'), { 'for': id + 'time' }));
    var time = el('select', null, null, { id: id + 'time', name: 'best_time' });
    [['', T('cb_time_any')], ['morning', T('cb_time_morning')], ['midday', T('cb_time_midday')], ['afternoon', T('cb_time_afternoon')]].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; time.appendChild(op); });
    tw.appendChild(time); f.appendChild(tw);
    var attach = null;
    if (last.q) {
      var aw = el('div', 'vero-assist__check');
      attach = el('input', null, null, { id: id + 'attach', type: 'checkbox', name: 'attach_question' });
      var al = el('label', null, null, { 'for': id + 'attach' }); al.appendChild(document.createTextNode(T('cb_attach') + ' ')); al.appendChild(el('q', null, last.q));
      aw.appendChild(attach); aw.appendChild(al); f.appendChild(aw);
      f.appendChild(el('p', 'vero-assist__fine', T('cb_attach_note')));
    }
    var pw = el('div', 'vero-assist__check');
    var priv = el('input', null, null, { id: id + 'privacy', type: 'checkbox', name: 'privacy', required: true });
    var pl = el('label', null, T('cb_privacy') + ' ', { 'for': id + 'privacy' });
    pw.appendChild(priv); pw.appendChild(pl);
    if (safeUrl(L.privacy)) { var pa = link(T('cb_privacy_link'), safeUrl(L.privacy)); pa.target = '_blank'; pa.rel = 'noopener'; pw.appendChild(pa); }
    f.appendChild(pw);
    var status = el('p', 'vero-assist__status', null, { role: 'status' });
    var go = el('button', 'vero-assist__cta', T('cb_send'), { type: 'submit' });
    f.appendChild(go); f.appendChild(status);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      [name, email, phone].forEach(function (i) { if (!i) return; var ok = i.value.trim() !== '' && (i.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.value.trim())); i.setAttribute('aria-invalid', ok ? 'false' : 'true'); if (!ok && !bad) bad = i; });
      priv.setAttribute('aria-invalid', priv.checked ? 'false' : 'true'); if (!priv.checked && !bad) bad = priv;
      if (bad) { status.textContent = T('cb_error'); bad.focus(); return; }
      go.disabled = true; status.textContent = '';
      var wait = Math.max(0, 2300 - (Date.now() - tokenAt)); // the form token must be at least 2 seconds old (anti-bot)
      setTimeout(function () {
        var withQ = !!(attach && attach.checked && last.q);
        var payload = { kind: 'callback', topic: C.topic === 'health' ? 'health' : 'life', phone: phone.value.trim(), best_time: time.value, privacy: true, form_token: token, vc_hp_x: '', source: location.href.split('#')[0], via: 'assistant', attach_question: withQ, message: withQ ? T('cb_message') + ' ' + last.q : '' };
        if (name) payload.name = name.value.trim();
        if (email) payload.email = email.value.trim();
        fetch(L.contact, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Vero-Lang': C.lang }, body: JSON.stringify(payload) })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j || {} }; }); })
          .then(function (x) {
            if (x.ok && x.j.ok) { while (f.firstChild) f.removeChild(f.firstChild); var done = el('p', 'vero-assist__done', T('cb_done'), { role: 'status', tabindex: '-1' }); f.appendChild(done); done.focus(); return; }
            var fields = (x.j.data && x.j.data.fields) || {};
            Object.keys(fields).forEach(function (k) { var i = f.querySelector('[name="' + k + '"]'); if (i) i.setAttribute('aria-invalid', 'true'); });
            status.textContent = x.j.message || T('cb_error'); go.disabled = false;
          })
          .catch(function () { status.textContent = T('cb_error'); go.disabled = false; });
      }, wait);
    });
    return f;
  }

  // ------------------------------------------------------------------------------------------------------ start
  function ready() { root.hidden = false; }
  if (C.status) {
    // the static Pro site: shown only when the platform says the assistant is on
    fetch(C.status, { mode: 'cors', credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.available) ready(); }).catch(function () {});
  } else ready();
})();
