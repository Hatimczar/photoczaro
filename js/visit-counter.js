(function () {
  var footer = document.querySelector('footer');
  if (!footer || navigator.webdriver) return;
  var L = {
    en: 'Page views', fr: 'Pages vues', ru: 'Просмотры страниц',
    es: 'Páginas vistas', cs: 'Zobrazení stránek', ar: 'مشاهدات الموقع'
  };
  var lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  if (!L[lang]) lang = 'en';
  var el = document.createElement('span');
  el.className = 'footer-copy visit-counter';
  el.hidden = true;
  el.setAttribute('aria-live', 'off');
  var bottom = footer.querySelector('.footer-bottom');
  (bottom || footer).appendChild(el);

  /* Low-specificity default look, so footers that style .footer-copy themselves keep winning. */
  var st = document.createElement('style');
  st.textContent = ':where(.visit-counter){font-size:11px;letter-spacing:0.1em;color:rgba(138,134,128,0.95)}';
  document.head.appendChild(st);

  /* The odometer roll lives in /js/odometer.js (shared with the homepage stats); load it on demand. */
  function withOdometer(cb) {
    if (window.PCOdometer) return cb(true);
    var s = document.createElement('script');
    s.src = '/js/odometer.js?v=3';
    s.onload = function () { cb(!!window.PCOdometer); };
    s.onerror = function () { cb(false); };
    document.head.appendChild(s);
  }

  fetch('/api/visit', { method: 'POST', keepalive: true })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || typeof d.count !== 'number') return;
      var n = d.count.toLocaleString(lang === 'ar' ? 'en-US' : lang);
      el.textContent = L[lang] + ' · ';
      var b = document.createElement('span');
      b.dir = 'ltr'; b.style.unicodeBidi = 'isolate'; b.textContent = n;
      el.appendChild(b);
      el.hidden = false;
      withOdometer(function (ok) { if (ok) window.PCOdometer.mount(b, n, { threshold: 0.6 }); });
    })
    .catch(function () {});
})();
