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
  fetch('/api/visit', { method: 'POST', keepalive: true })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || typeof d.count !== 'number') return;
      var n = d.count.toLocaleString(lang === 'ar' ? 'en-US' : lang);
      el.textContent = L[lang] + ' · ';
      var b = document.createElement('span');
      b.textContent = n;
      b.dir = 'ltr';
      b.style.unicodeBidi = 'isolate';
      el.appendChild(b);
      el.hidden = false;
    })
    .catch(function () {});
})();
