/* AVRASTRO Pro — static site (pro.avrastro.com). Gives the theme script (site.js: menu drawer, film play button) its
   texts from the page's own <html data-*> attributes, and switches the plans between monthly and yearly prices exactly
   as the website's plugin does. No cookies, no storage, no tracking, no requests. Loaded before site.js (both defer). */
(function () {
  'use strict';
  var root = document.documentElement;
  var d = root.dataset || {};
  window.VERO_SITE = { lang: root.lang, strings: { menu: d.menu, close: d.close, submenu: d.submenu } };

  Array.prototype.forEach.call(document.querySelectorAll('[data-vc-pricing]'), function (box) {
    var radios = box.querySelectorAll('input[name="vc-interval"]');
    var apply = function () {
      var year = Array.prototype.some.call(radios, function (r) { return r.checked && r.value === 'year'; });
      Array.prototype.forEach.call(box.querySelectorAll('[data-vc-price-month]'), function (e) { e.hidden = year; });
      Array.prototype.forEach.call(box.querySelectorAll('[data-vc-price-year]'), function (e) { e.hidden = !year; });
      Array.prototype.forEach.call(box.querySelectorAll('[data-vc-plan-link]'), function (a) {
        var h = year ? a.getAttribute('data-href-year') : a.getAttribute('data-href-month');
        if (h) a.href = h;
      });
    };
    Array.prototype.forEach.call(radios, function (r) { r.addEventListener('change', apply); });
    apply();
  });
})();
