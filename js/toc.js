/*
 * Photoczaro table of contents for long guides.
 * Opt-in: add data-toc="sidebar" or data-toc="full" to .post-body.
 *   sidebar: sticky list beside the article on wide screens only.
 *   full:    the same sidebar, plus a collapsible "on this page" list on smaller screens.
 * Optional data-toc-h3: also list numbered h3 headings (for example "1. MMG") under their section.
 * Works without cookies or storage, and the article is fully readable if this script never runs.
 */
(function () {
  'use strict';

  var body = document.querySelector('.post-body[data-toc]');
  if (!body) return;

  var mode = body.getAttribute('data-toc') === 'full' ? 'full' : 'sidebar';
  var withH3 = body.hasAttribute('data-toc-h3');
  var lang = ((document.documentElement.getAttribute('lang') || 'en') + '').slice(0, 2).toLowerCase();
  var labels = {
    en: 'On this page',
    fr: 'Sur cette page',
    ru: 'На этой странице',
    es: 'En esta página',
    cs: 'Na této stránce'
  };
  var label = labels[lang] || labels.en;

  var used = {};
  Array.prototype.forEach.call(document.querySelectorAll('[id]'), function (el) { used[el.id] = true; });

  var items = [];
  var heads = body.querySelectorAll('h2, h3');
  var n = 0;
  Array.prototype.forEach.call(heads, function (h) {
    var isH3 = h.tagName === 'H3';
    var text = (h.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (isH3 && !(withH3 && /^\d+\.\s/.test(text))) return;
    if (!h.id) {
      do { n += 1; } while (used['sec-' + n]);
      h.id = 'sec-' + n;
      used[h.id] = true;
    }
    items.push({ id: h.id, text: text, level: isH3 ? 3 : 2, el: h });
  });
  if (items.length < 4) return;

  function list(only2) {
    var ol = document.createElement('ol');
    items.forEach(function (it) {
      if (only2 && it.level !== 2) return;
      var li = document.createElement('li');
      if (it.level === 3) li.className = 'toc-sub';
      var a = document.createElement('a');
      a.href = '#' + it.id;
      a.textContent = it.text;
      a.setAttribute('data-toc-id', it.id);
      li.appendChild(a);
      ol.appendChild(li);
    });
    return ol;
  }

  var css = document.createElement('style');
  css.textContent =
    '.post-body{position:relative}' +
    '.post-body h2,.post-body h3{scroll-margin-top:100px}' +
    '.toc-side{display:none}' +
    '.toc-inline{display:block;margin:32px 0;padding:16px 22px;background:var(--dark-3);border:0.5px solid rgba(201,169,110,0.2)}' +
    '.toc-inline summary{cursor:pointer;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);list-style:none}' +
    '.toc-inline summary::-webkit-details-marker{display:none}' +
    '.toc-inline summary::after{content:" +";}' +
    '.toc-inline[open] summary::after{content:" \\2212";}' +
    '.toc-inline ol{list-style:none;margin:14px 0 4px;padding:0;counter-reset:none}' +
    '.toc-inline li{padding:6px 0;border-bottom:0.5px solid rgba(255,255,255,0.05);font-size:14px;line-height:1.5}' +
    '.toc-inline li::before,.toc-side li::before{content:none!important}' +
    '.toc-inline a,.toc-side a{color:rgba(245,240,235,0.78);text-decoration:none}' +
    '.toc-inline a:hover,.toc-side a:hover{color:var(--gold-light,#e8d5a3)}' +
    '@media (min-width:1360px){' +
    '.toc-inline{display:none}' +
    '.toc-side{display:block;position:absolute;top:0;bottom:0;left:100%;width:230px;margin-left:-16px}' +
    '.toc-side-inner{position:sticky;top:110px;max-height:calc(100vh - 150px);overflow-y:auto;padding-right:8px}' +
    '.toc-side .toc-label{font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:var(--gold);margin:0 0 14px}' +
    '.toc-side ol{list-style:none;margin:0;padding:0;border-left:0.5px solid rgba(255,255,255,0.1)}' +
    '.toc-side li{padding:5px 0 5px 14px;font-size:12.5px;line-height:1.45;margin:0;border:0}' +
    '.toc-side li.toc-sub{padding-left:26px;font-size:12px}' +
    '.toc-side a[aria-current="true"]{color:var(--gold-light,#e8d5a3)}' +
    '.toc-side li:has(a[aria-current="true"]){border-left:1px solid var(--gold);margin-left:-0.5px}' +
    '}';
  document.head.appendChild(css);

  var side = document.createElement('aside');
  side.className = 'toc-side';
  side.setAttribute('aria-label', label);
  var inner = document.createElement('div');
  inner.className = 'toc-side-inner';
  var lab = document.createElement('p');
  lab.className = 'toc-label';
  lab.textContent = label;
  inner.appendChild(lab);
  inner.appendChild(list(false));
  side.appendChild(inner);
  body.insertBefore(side, body.firstChild);

  if (mode === 'full') {
    var det = document.createElement('details');
    det.className = 'toc-inline';
    var sum = document.createElement('summary');
    sum.textContent = label;
    det.appendChild(sum);
    var nav = document.createElement('nav');
    nav.setAttribute('aria-label', label);
    nav.appendChild(list(true));
    det.appendChild(nav);
    var lead = body.querySelector('p.lead');
    if (lead && lead.parentNode === body) body.insertBefore(det, lead.nextSibling);
    else body.insertBefore(det, side.nextSibling);
  }

  // Highlight the section being read.
  var links = Array.prototype.slice.call(side.querySelectorAll('a'));
  var ticking = false;
  function update() {
    ticking = false;
    var current = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].el.getBoundingClientRect().top <= 140) current = items[i].id; else break;
    }
    links.forEach(function (a) {
      if (a.getAttribute('data-toc-id') === current) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  function onScroll() {
    if (!ticking) { ticking = true; window.setTimeout(update, 60); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
