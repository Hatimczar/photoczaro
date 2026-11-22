/* Odometer roll: a plain-JS take on the React Bits Count Up "roll" mode with a spring ease.
   Every digit is a column that spins one full turn plus its digit, staggered from the right.
   PCOdometer.build(text) -> { node, roll }   (non-digit characters stay static)
   PCOdometer.mount(el, text, opts) swaps el's content for the odometer and rolls it when el scrolls into view. */
(function () {
  if (window.PCOdometer) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function addStyle() {
    if (document.getElementById('vc-odo-css')) return;
    var st = document.createElement('style');
    st.id = 'vc-odo-css';
    st.textContent =
      '.vc-num{--vc-lh:1.25em;display:inline-flex;vertical-align:bottom;font-variant-numeric:tabular-nums;direction:ltr;unicode-bidi:isolate}' +
      '.vc-col{display:inline-block;height:var(--vc-lh);line-height:var(--vc-lh);overflow:hidden;position:relative}' +
      '.vc-strip{display:flex;flex-direction:column;will-change:transform}' +
      '.vc-strip span{display:block;overflow:hidden;height:var(--vc-lh);line-height:var(--vc-lh);text-align:center}' +
      '.vc-sep{display:inline-block;line-height:var(--vc-lh);height:var(--vc-lh);white-space:pre}' +
      '.vc-strip.vc-moving{filter:blur(0.6px)}';
    document.head.appendChild(st);
  }
  function build(text, lh) {
    lh = lh || 1.25;
    addStyle();
    var wrap = document.createElement('span');
    wrap.className = 'vc-num';
    wrap.setAttribute('aria-label', text);
    wrap.style.setProperty('--vc-lh', lh + 'em');
    var strips = [], chars = String(text).split(''), idx = 0;
    var total = chars.filter(function (c) { return /\d/.test(c); }).length;
    chars.forEach(function (c) {
      if (!/\d/.test(c)) {
        var sep = document.createElement('span');
        sep.className = 'vc-sep'; sep.setAttribute('aria-hidden', 'true'); sep.textContent = c;
        wrap.appendChild(sep); return;
      }
      var col = document.createElement('span');
      col.className = 'vc-col'; col.setAttribute('aria-hidden', 'true');
      var strip = document.createElement('span');
      strip.className = 'vc-strip';
      for (var i = 0; i < 20; i++) { var d = document.createElement('span'); d.textContent = String(i % 10); strip.appendChild(d); }
      col.appendChild(strip); wrap.appendChild(col);
      strips.push({ strip: strip, digit: parseInt(c, 10), order: total - 1 - idx });
      idx++;
    });
    function roll() {
      strips.forEach(function (s) {
        var delay = s.order * 110, dur = 1500 + s.order * 120;
        s.strip.classList.add('vc-moving');
        s.strip.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.34,1.45,0.64,1) ' + delay + 'ms';
        s.strip.style.transform = 'translateY(-' + ((10 + s.digit) * lh) + 'em)';
        setTimeout(function () { s.strip.classList.remove('vc-moving'); }, delay + dur - 250);
      });
    }
    return { node: wrap, roll: roll };
  }
  function mount(el, text, opts) {
    text = text == null ? el.textContent.trim() : text;
    if (reduce || !/\d/.test(text) || !('IntersectionObserver' in window)) { el.textContent = text; return; }
    var cs = getComputedStyle(el), px = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize);
    var odo = build(text, (px && fs) ? Math.round(px / fs * 1000) / 1000 : 1.25);
    el.textContent = '';
    el.appendChild(odo.node);
    var io = new IntersectionObserver(function (es) {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      requestAnimationFrame(function () { requestAnimationFrame(odo.roll); });
    }, { threshold: (opts && opts.threshold) || 0.5 });
    io.observe(el);
  }
  window.PCOdometer = { build: build, mount: mount, reduced: reduce };
})();
