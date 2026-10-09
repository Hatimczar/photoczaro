/*
 * Shared accessibility behaviour for the mobile menu, the skip link and the
 * image viewer. Loaded on every public page (deferred).
 *
 * Why this exists: several pages put the full-screen menu inside <main>, and
 * the per-page open/close code makes every other direct child of <body>
 * inert while the menu is open. That also made <main> (and so the menu itself)
 * inert, and the header with the hamburger. Here the menu is moved out to be a
 * direct child of <body>, gets a real Close control, contains Tab focus while
 * open, and returns focus to the opener when it closes.
 */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const main = document.querySelector("main");

  /* ---- Skip link: make sure there is one, and that it really moves focus ---- */
  if (main) {
    if (!main.id) main.id = "main-content";
    let skip = document.querySelector(".skip-link");
    if (!skip) {
      skip = document.createElement("a");
      skip.className = "skip-link";
      skip.href = "#" + main.id;
      skip.textContent = "Skip to content";
      document.body.insertBefore(skip, document.body.firstChild);
    }
    skip.addEventListener("click", (e) => {
      const id = (skip.getAttribute("href") || "").replace(/^.*#/, "");
      const target = document.getElementById(id) || main;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }, true);
  }

  /* ---- Mobile menu ---- */
  const menu = document.getElementById("mobile-menu");
  const burger = document.getElementById("nav-hamburger");
  if (menu && burger) {
    // Out of <main> (and any other container that is made inert), so it is never disabled with the page.
    if (menu.parentElement !== document.body) document.body.appendChild(menu);

    // The header (with the hamburger) is made inert while the menu is open, so Close lives inside the menu,
    // positioned exactly over the hamburger so the visible X is the real, working control.
    const close = document.createElement("button");
    close.type = "button";
    close.className = "menu-close";
    close.setAttribute("aria-label", "Close menu");
    menu.insertBefore(close, menu.firstChild);
    close.addEventListener("click", () => burger.click());

    const place = () => {
      const r = burger.getBoundingClientRect();
      const size = 44;
      close.style.top = Math.max(0, r.top + r.height / 2 - size / 2) + "px";
      close.style.left = Math.max(0, r.left + r.width / 2 - size / 2) + "px";
    };

    const focusables = () => Array.from(menu.querySelectorAll("a[href], button:not([disabled])")).filter((el) => el.getClientRects().length > 0);
    let wasOpen = false;
    const sync = () => {
      const open = menu.classList.contains("open");
      if (open === wasOpen) return;
      wasOpen = open;
      if (open) {
        place();
        const first = menu.querySelector(".mobile-menu-nav a") || close;
        setTimeout(() => first.focus(), 60);
      } else {
        burger.focus();
      }
    };
    new MutationObserver(sync).observe(menu, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", () => { if (wasOpen) place(); });

    document.addEventListener("keydown", (e) => {
      if (!menu.classList.contains("open") || e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !menu.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !menu.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    });
  }
})();
