(function () {
  var bar = document.querySelector('.sticky-mobile-cta');
  if (!bar) return;

  var sentinel =
    document.querySelector('.hero-ctas .cta-btn-primary') ||
    document.querySelector('.hero-ctas') ||
    document.querySelector('.cta-btn-primary');
  var footer = document.querySelector('#contact') || document.querySelector('footer');

  var heroPast = !sentinel;
  var nearFooter = false;

  function update() {
    var visible = heroPast && !nearFooter;
    bar.classList.toggle('is-visible', visible);
    if (visible) {
      bar.removeAttribute('inert');
    } else {
      bar.setAttribute('inert', '');
    }
  }

  if (!('IntersectionObserver' in window)) {
    heroPast = true;
    update();
    return;
  }

  if (sentinel) {
    new IntersectionObserver(
      function (entries) {
        heroPast = !entries[0].isIntersecting;
        update();
      },
      { threshold: 0 }
    ).observe(sentinel);
  }

  if (footer) {
    new IntersectionObserver(
      function (entries) {
        nearFooter = entries[0].isIntersecting;
        update();
      },
      { rootMargin: '0px 0px -15% 0px', threshold: 0 }
    ).observe(footer);
  }

  update();
})();
