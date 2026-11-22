/* Sitemap page: small vanilla ports of ideas from React Bits (dot grid, blur text, count up, spotlight card, animated list). No dependencies. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var root = document.querySelector('.sm-root');
  if (!root) return;
  document.documentElement.classList.add('sm-js');

  /* 1. Blur-in title words */
  var title = document.querySelector('.pp-title');
  if (title && !reduce) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            var s = document.createElement('span');
            s.className = 'sm-word'; s.textContent = w; s.style.animationDelay = (i++ * 140 + 120) + 'ms';
            frag.appendChild(s);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(title);
  }

  /* 2. Odometer roll for the hero numbers (shared with the footer counter and homepage stats) */
  document.querySelectorAll('[data-count]').forEach(function (c) {
    var end = c.getAttribute('data-count');
    if (window.PCOdometer) window.PCOdometer.mount(c, end, { threshold: 0.6 }); else c.textContent = end;
  });

  /* 3. Spotlight cards */
  if (fine) {
    document.querySelectorAll('.sm-card').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });
  }

  /* 4. Dot grid that reacts to the pointer */
  var hero = document.querySelector('.pp-hero'), cv = document.querySelector('.sm-dots');
  if (hero && cv && fine && !reduce) {
    var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var gap = 30, R = 150, mx = -999, my = -999, raf = 0, vis = true, dots = [];
    function size() {
      var r = hero.getBoundingClientRect(); W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (var y = gap / 2; y < H; y += gap) for (var x = gap / 2; x < W; x += gap) dots.push({ x: x, y: y, ox: 0, oy: 0 });
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var moving = false;
      for (var k = 0; k < dots.length; k++) {
        var d = dots[k], dx = d.x - mx, dy = d.y - my, dist = Math.sqrt(dx * dx + dy * dy), near = dist < R;
        var tx = 0, ty = 0, f = 0;
        if (near) { f = 1 - dist / R; tx = (dx / (dist || 1)) * f * 14; ty = (dy / (dist || 1)) * f * 14; }
        d.ox += (tx - d.ox) * 0.14; d.oy += (ty - d.oy) * 0.14;
        if (Math.abs(tx - d.ox) > 0.05 || Math.abs(ty - d.oy) > 0.05) moving = true;
        var a = 0.13 + f * 0.75, s = 1.2 + f * 1.6;
        ctx.fillStyle = f > 0.02 ? 'rgba(201,169,110,' + a + ')' : 'rgba(255,255,255,0.13)';
        ctx.beginPath(); ctx.arc(d.x + d.ox, d.y + d.oy, s, 0, 6.2832); ctx.fill();
      }
      raf = (moving && vis) ? requestAnimationFrame(draw) : 0;
    }
    function kick() { if (!raf && vis) raf = requestAnimationFrame(draw); }
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; kick();
    });
    hero.addEventListener('pointerleave', function () { mx = my = -999; kick(); });
    window.addEventListener('resize', size);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { vis = es[0].isIntersecting; if (vis) kick(); }).observe(hero);
    size();
  }

  /* 5. Journal: staggered reveal, live search and topic filter */
  var items = Array.prototype.slice.call(document.querySelectorAll('.sm-post'));
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (it, n) { it.style.transitionDelay = (n % 6) * 45 + 'ms'; io.observe(it); });
  } else { items.forEach(function (it) { it.classList.add('in'); }); }

  var input = document.querySelector('.sm-search input'), chips = Array.prototype.slice.call(document.querySelectorAll('.sm-chip'));
  var status = document.querySelector('.sm-status'), empty = document.querySelector('.sm-empty');
  var cat = 'all';
  function norm(s) { return (s || '').toLowerCase(); }
  function apply() {
    var q = norm(input ? input.value : '').trim(), shown = 0;
    items.forEach(function (it) {
      var ok = (cat === 'all' || it.getAttribute('data-cat') === cat) && (!q || norm(it.textContent).indexOf(q) > -1);
      it.hidden = !ok; if (ok) { shown++; it.classList.add('in'); }
    });
    if (empty) empty.hidden = shown !== 0;
    if (status) status.textContent = shown + ' / ' + items.length;
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      cat = c.getAttribute('data-cat');
      chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
      apply();
    });
  });
  if (input) input.addEventListener('input', apply);
  apply();
})();
