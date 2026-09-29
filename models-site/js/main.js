/* Shared chrome, matches photoczaro.com's cursor/nav/page-transition/reveal system. */
(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Custom cursor */
  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursor-ring');
  if (cursor && ring && !prefersReducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', (e) => { mx = e.clientX; my = e.clientY; });
    (function animateCursor() {
      cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
      rx += (mx - rx) * 0.1; ry += (my - ry) * 0.1;
      ring.style.left = rx + 'px'; ring.style.top = ry + 'px';
      requestAnimationFrame(animateCursor);
    })();
    document.querySelectorAll('a, button').forEach((el) => {
      el.addEventListener('mouseenter', () => ring.classList.add('hovered'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hovered'));
    });
    document.querySelectorAll('.model-card-media, .profile-media').forEach((el) => {
      el.addEventListener('mouseenter', () => { ring.classList.remove('hovered'); ring.classList.add('on-media'); });
      el.addEventListener('mouseleave', () => ring.classList.remove('on-media'));
    });
  }

  /* Page transitions on internal navigation */
  const pageTransition = document.getElementById('page-transition');
  function navigateTo(url) {
    if (prefersReducedMotion || !pageTransition) { window.location.href = url; return; }
    pageTransition.classList.add('slide-in');
    setTimeout(() => { window.location.href = url; }, 200);
  }
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto') || href.startsWith('tel') || href.startsWith('http') || href.startsWith('//') || a.classList.contains('cta-btn-primary')) return;
    a.addEventListener('click', (e) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      navigateTo(href);
    });
  });
  window.addEventListener('pageshow', () => {
    if (!pageTransition) return;
    pageTransition.classList.remove('slide-in');
    requestAnimationFrame(() => requestAnimationFrame(() => pageTransition.classList.add('slide-out')));
    setTimeout(() => pageTransition.classList.remove('slide-out'), 700);
  });

  /* Nav scroll state + scroll progress */
  const nav = document.getElementById('site-nav');
  const progress = document.getElementById('scroll-progress');
  window.addEventListener('scroll', () => {
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 80);
    if (progress) {
      const h = document.documentElement;
      const scrollable = h.scrollHeight - h.clientHeight;
      progress.style.width = (scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0) + '%';
    }
  }, { passive: true });

  /* Page loader: full pulsing loader only on the first page of a session; a much
     shorter fade on subsequent internal navigations (avoids the "loading every
     click" feel on a otherwise-instant static site). */
  const loader = document.getElementById('page-loader');
  if (loader) {
    const seen = sessionStorage.getItem('pczVisited');
    setTimeout(() => { loader.classList.add('hidden'); sessionStorage.setItem('pczVisited', '1'); }, seen ? 0 : 250);
  }

  /* Hamburger + mobile menu */
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }));
  }

  /* Shortlist drawer */
  const drawer = document.getElementById('shortlist-drawer');
  const overlay = document.getElementById('shortlist-overlay');
  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add('open'); overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    drawer.querySelector('.drawer-close')?.focus();
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove('open'); overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-open-shortlist]').forEach((btn) => btn.addEventListener('click', openDrawer));
  document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  document.getElementById('drawer-clear')?.addEventListener('click', () => window.PhotoczaroShortlist?.clear());

  /* Reveal-on-scroll (matches photoczaro.com's .reveal/.visible pattern) */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal, .section-line').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal, .section-line').forEach((el) => el.classList.add('visible'));
  }

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
