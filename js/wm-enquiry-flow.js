/* Work With Me: one-question-at-a-time photoshoot enquiry.
 * Answers live in this page's DOM only. Nothing is stored, sent to a server or
 * included in analytics. The WhatsApp message is built in the browser and opened
 * for the visitor to review and send themselves.
 * Text comes from <script type="application/json" id="wm-flow-config"> on each
 * page so every language version keeps its own wording. */
(function () {
  'use strict';

  var root = document.getElementById('wm-flow');
  var cfgEl = document.getElementById('wm-flow-config');
  if (!root || !cfgEl) return;

  var cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }

  var $ = function (id) { return document.getElementById(id); };
  var form = $('wm-enquiry-form');
  var steps = Array.prototype.slice.call(root.querySelectorAll('.wm-flow-step'));
  var radios = Array.prototype.slice.call(root.querySelectorAll('input[name="shootType"]'));
  var typeGroup = $('wm-type-group');
  var nameInput = $('wm-name');
  var noteInput = $('wm-note');
  var privacy = $('wm-privacy');
  var backBtn = $('wm-back');
  var skipBtn = $('wm-skip');
  var nextBtn = $('wm-next');
  var progressEl = $('wm-progress');
  var fillEl = $('wm-progress-fill');
  var statusEl = $('wm-form-status');
  var nojs = $('wm-nojs');
  var emailLink = $('wm-email-fallback');
  var TOTAL = 3;
  var REVIEW = 4;
  var current = 1;
  var started = false;

  var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function track(name) {
    try {
      if (window.photoczaroAnalytics && typeof window.photoczaroAnalytics.trackEvent === 'function') {
        // Event name only. Answers are never passed to analytics.
        window.photoczaroAnalytics.trackEvent(name, { cta_location: 'enquiry_form' });
      }
    } catch (e) { /* analytics must never break the form */ }
  }

  function selectedRadio() {
    for (var i = 0; i < radios.length; i++) if (radios[i].checked) return radios[i];
    return null;
  }
  function typeLabel() {
    var r = selectedRadio();
    if (!r) return '';
    var t = r.parentNode.querySelector('.wm-card-title');
    return t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  function cleanName() { return nameInput.value.replace(/\s+/g, ' ').trim(); }
  function cleanNote() { return noteInput.value.replace(/\r\n?/g, '\n').trim(); }

  function setError(control, errId, message) {
    var err = $(errId);
    if (!err) return;
    err.textContent = message || '';
    var ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== errId; });
    if (message) ids.push(errId);
    if (ids.length) control.setAttribute('aria-describedby', ids.join(' ')); else control.removeAttribute('aria-describedby');
    if (message) control.setAttribute('aria-invalid', 'true'); else control.removeAttribute('aria-invalid');
  }

  function fillReview() {
    $('wm-rv-type').textContent = typeLabel();
    $('wm-rv-name').textContent = cleanName();
    var note = cleanNote();
    $('wm-rv-note').textContent = note;
    $('wm-rv-note-row').hidden = !note;
  }

  function show(step, moveFocus) {
    current = step;
    steps.forEach(function (s) {
      var on = Number(s.getAttribute('data-step')) === step;
      s.hidden = !on;
      s.classList.remove('is-entering');
      if (on && moveFocus) {
        // Restart the entrance animation; CSS switches it off for reduced motion.
        void s.offsetWidth;
        s.classList.add('is-entering');
      }
    });
    if (step === REVIEW) {
      fillReview();
      progressEl.textContent = cfg.review;
      fillEl.style.width = '100%';
    } else {
      progressEl.textContent = cfg.progress.replace('{n}', String(step)).replace('{total}', String(TOTAL));
      fillEl.style.width = (step / TOTAL * 100) + '%';
    }
    backBtn.hidden = step === 1;
    skipBtn.hidden = step !== 3;
    nextBtn.textContent = step === REVIEW ? cfg.send : cfg.next;
    statusEl.textContent = '';

    if (moveFocus) {
      var title = $('wm-step-title-' + step);
      if (title) {
        title.focus({ preventScroll: true });
        var box = root.getBoundingClientRect();
        if (box.top < 0 || box.top > window.innerHeight * 0.5) {
          root.scrollIntoView({ block: 'start', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        }
      }
    }
  }

  function validate(step) {
    if (step === 1) {
      if (!selectedRadio()) {
        setError(typeGroup, 'wm-err-type', cfg.errors.type);
        radios[0].focus();
        return false;
      }
      setError(typeGroup, 'wm-err-type', '');
    } else if (step === 2) {
      var name = cleanName();
      nameInput.value = name;
      if (!name) {
        setError(nameInput, 'wm-err-name', cfg.errors.name);
        nameInput.focus();
        return false;
      }
      setError(nameInput, 'wm-err-name', '');
    } else if (step === REVIEW) {
      if (!privacy.checked) {
        setError(privacy, 'wm-err-privacy', cfg.errors.privacy);
        privacy.focus();
        return false;
      }
      setError(privacy, 'wm-err-privacy', '');
    }
    return true;
  }

  // Exactly the message in the brief; the Notes line is left out when blank.
  function buildMessage() {
    var m = cfg.message;
    var lines = [m.greeting, '', m.name + ': ' + cleanName(), m.type + ': ' + typeLabel()];
    var note = cleanNote();
    if (note) lines.push(m.notes + ': ' + note);
    return lines.join('\n');
  }
  function buildUrl() {
    return 'https://wa.me/' + cfg.wa + '?text=' + encodeURIComponent(buildMessage());
  }

  function markStarted() {
    if (started) return;
    started = true;
    track('work_with_me_form_start');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    markStarted();
    if (!validate(current)) return;
    if (current < REVIEW) {
      show(current + 1, true);
      return;
    }
    // Opens WhatsApp with the draft ready. Nothing is sent from here.
    statusEl.textContent = cfg.opening;
    track('work_with_me_whatsapp_continue');
    window.open(buildUrl(), '_blank', 'noopener,noreferrer');
  });

  backBtn.addEventListener('click', function () {
    if (current > 1) show(current - 1, true);
  });
  skipBtn.addEventListener('click', function () {
    noteInput.value = '';
    show(REVIEW, true);
  });

  // Corrected answers lose their error straight away.
  radios.forEach(function (r) {
    r.addEventListener('change', function () { setError(typeGroup, 'wm-err-type', ''); });
  });
  nameInput.addEventListener('input', function () {
    if (nameInput.hasAttribute('aria-invalid') && nameInput.value.trim()) setError(nameInput, 'wm-err-name', '');
  });
  privacy.addEventListener('change', function () {
    if (privacy.checked) setError(privacy, 'wm-err-privacy', '');
  });
  root.addEventListener('focusin', markStarted);
  root.addEventListener('change', markStarted);

  if (emailLink) emailLink.addEventListener('click', function () { track('work_with_me_email_click'); });

  // Session-card buttons on the page name a shoot type: preselect the matching
  // card (the visitor can still change it) and show the first question.
  Array.prototype.forEach.call(document.querySelectorAll('.session-cta'), function (a) {
    a.addEventListener('click', function () {
      var key = a.getAttribute('data-session-type');
      var match = radios.filter(function (r) { return r.getAttribute('data-cta') === key; })[0];
      if (!match) return;
      match.checked = true;
      setError(typeGroup, 'wm-err-type', '');
      show(1, false);
    });
  });

  // Ready: reveal the flow and retire the no-JavaScript fallback.
  root.hidden = false;
  if (nojs) nojs.hidden = true;
  show(1, false);
})();
