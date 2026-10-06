/* Shared chrome, matches photoczaro.com's cursor/nav/page-transition/reveal system. */
(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Pages served under a language prefix (see js/i18n.js) set <base> so
     relative assets resolve correctly at that nested path (and model
     profiles do the same for /models/:slug). That also changes what a bare
     href="#id" resolves to: instead of "stay on this page, jump to id", the
     browser resolves it against <base> and navigates away (to the homepage).
     So same-page anchors are rewritten to this page's own URL, and handled
     here too so the target also receives keyboard focus (the skip link is
     useless to keyboard and screen-reader users if focus stays in the nav). */
  function focusTarget(target) {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    if (!id) return;
    a.setAttribute('href', window.location.pathname + window.location.search + '#' + id);
    a.addEventListener('click', (e) => {
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      focusTarget(target);
      history.replaceState(null, '', window.location.pathname + window.location.search + '#' + id);
    });
  });

  /* Overlay helpers shared by the mobile menu and the shortlist dialog.
     inertOutside() makes everything except the given elements unreachable
     (no tabbing, clicking or screen-reader access) while an overlay is open;
     trapTab() keeps Tab/Shift+Tab cycling inside it. */
  function inertOutside(allowed) {
    const changed = [];
    (function walk(parent) {
      Array.from(parent.children).forEach((el) => {
        if (['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT'].includes(el.tagName)) return;
        if (allowed.includes(el)) return;
        if (allowed.some((a) => el.contains(a))) { walk(el); return; }
        if (!el.inert) { el.inert = true; changed.push(el); }
      });
    })(document.body);
    return () => changed.forEach((el) => { el.inert = false; });
  }
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  function trapTab(e, containers) {
    if (e.key !== 'Tab') return;
    const items = containers.flatMap((c) => (c.matches(FOCUSABLE) ? [c] : []).concat(Array.from(c.querySelectorAll(FOCUSABLE)))).filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) { e.preventDefault(); first.focus(); }
  }

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
    setTimeout(() => { window.location.href = url; }, 150);
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
    setTimeout(() => pageTransition.classList.remove('slide-out'), 450);
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

  /* Hamburger + mobile menu. Closed: the menu is display:none (out of the tab
     order and accessibility tree). Open: it behaves as a modal layer, so only
     the menu and its toggle are reachable, Tab cycles between them, Escape
     closes, and focus returns to the toggle. */
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  let releaseMenu = null;
  function setMenu(open) {
    if (!hamburger || !mobileMenu) return;
    mobileMenu.classList.toggle('open', open);
    hamburger.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      releaseMenu = inertOutside([mobileMenu, hamburger]);
      mobileMenu.querySelector('a')?.focus();
    } else if (releaseMenu) {
      releaseMenu();
      releaseMenu = null;
    }
  }
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = !mobileMenu.classList.contains('open');
      setMenu(open);
      if (!open) hamburger.focus();
    });
    mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
      if (!mobileMenu.classList.contains('open')) return;
      if (e.key === 'Escape') { setMenu(false); hamburger.focus(); return; }
      trapTab(e, [hamburger, mobileMenu]);
    });
    /* Leaving the mobile layout with the menu open would leave the page inert. */
    window.matchMedia('(min-width: 901px)').addEventListener('change', (ev) => { if (ev.matches && mobileMenu.classList.contains('open')) setMenu(false); });
  }

  /* Shortlist drawer: a modal dialog. Closed, it is hidden (visibility) and
     inert so its buttons are not in the tab order or accessibility tree.
     Open, the page behind is inert, focus is contained, Escape closes, and
     focus goes back to whatever opened it. */
  const drawer = document.getElementById('shortlist-drawer');
  const overlay = document.getElementById('shortlist-overlay');
  let drawerOpener = null;
  let releaseDrawer = null;
  if (drawer) {
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'drawer-title');
    drawer.removeAttribute('aria-label');
    drawer.querySelector('.drawer-head h3')?.setAttribute('id', 'drawer-title');
    drawer.inert = true;
  }
  function openDrawer(e) {
    if (!drawer || drawer.classList.contains('open')) return;
    drawerOpener = (e && e.currentTarget) || document.activeElement;
    if (mobileMenu?.classList.contains('open')) setMenu(false);
    drawer.inert = false;
    drawer.classList.add('open'); overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    releaseDrawer = inertOutside([drawer, overlay]);
    drawer.querySelector('.drawer-close')?.focus();
  }
  function closeDrawer() {
    if (!drawer || !drawer.classList.contains('open')) return;
    drawer.classList.remove('open'); overlay.classList.remove('open');
    document.body.style.overflow = '';
    if (releaseDrawer) { releaseDrawer(); releaseDrawer = null; }
    drawer.inert = true;
    if (drawerOpener && document.contains(drawerOpener)) drawerOpener.focus();
    drawerOpener = null;
  }
  document.querySelectorAll('[data-open-shortlist]').forEach((btn) => btn.addEventListener('click', openDrawer));
  document.getElementById('drawer-close')?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (!drawer || !drawer.classList.contains('open')) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); return; }
    trapTab(e, [drawer]);
  });
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
