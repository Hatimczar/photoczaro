/* Magnetic hover for CTA buttons (ReactBits "Magnet"-style), vanilla JS.
   Desktop/mouse only: bails out entirely on touch devices, so there is
   zero listener/JS cost on mobile. Respects prefers-reduced-motion by
   keeping the existing static hover state (no pull). */
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var btns = document.querySelectorAll('.cta-btn');
  if (!btns.length) return;

  var STRENGTH = 0.3;
  var MAX_OFFSET = 12;
  var TRACK_TRANSITION = 'transform 0.12s ease-out, background 0.35s, border-color 0.35s, box-shadow 0.35s';
  var SETTLE_TRANSITION = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), background 0.35s, border-color 0.35s, box-shadow 0.35s';

  btns.forEach(function (btn) {
    var raf = null;

    btn.addEventListener('mouseenter', function () {
      btn.style.willChange = 'transform';
    });

    btn.addEventListener('mousemove', function (e) {
      var rect = btn.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = e.clientX - cx;
      var dy = e.clientY - cy;
      var mx = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dx * STRENGTH));
      var my = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, dy * STRENGTH)) - 2; // -2px keeps the existing hover lift

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        btn.style.transition = TRACK_TRANSITION;
        btn.style.transform = 'translate(' + mx.toFixed(1) + 'px,' + my.toFixed(1) + 'px)';
      });
    });

    btn.addEventListener('mouseleave', function () {
      if (raf) cancelAnimationFrame(raf);
      btn.style.transition = SETTLE_TRANSITION;
      btn.style.transform = '';
      setTimeout(function () {
        btn.style.willChange = '';
      }, 520);
    });
  });
})();
