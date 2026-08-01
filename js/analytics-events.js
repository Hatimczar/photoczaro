/*
 * Photoczaro shared analytics helper.
 * Fails silently when gtag is unavailable or blocked; never throws,
 * never delays navigation, never persists data to storage or cookies.
 */
(function () {
  'use strict';

  function cleanPagePath() {
    try {
      return window.location.pathname;
    } catch (e) {
      return '';
    }
  }

  function trackEvent(eventName, parameters) {
    try {
      if (typeof window.gtag !== 'function') return;
      var params = {};
      var source = parameters || {};
      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) params[key] = source[key];
      }
      // page_path is set last so a caller-supplied value can never override it.
      params.page_path = cleanPagePath();
      window.gtag('event', eventName, params);
    } catch (e) {
      /* analytics must never throw or block the page */
    }
  }

  var formStartedKeys = {}; // in-memory only for this page load, never persisted

  function markFormStartedOnce(key, eventName, parameters) {
    if (formStartedKeys[key]) return;
    formStartedKeys[key] = true;
    trackEvent(eventName, parameters);
  }

  window.photoczaroAnalytics = {
    trackEvent: trackEvent,
    markFormStartedOnce: markFormStartedOnce
  };

  function isManaged(el) {
    return !!el.closest('[data-analytics-managed="true"]');
  }

  function readExplicitParams(a) {
    var params = {};
    var attrs = a.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var name = attrs[i].name;
      if (name.indexOf('data-analytics-param-') === 0) {
        var key = name.slice('data-analytics-param-'.length);
        params[key] = attrs[i].value;
      }
    }
    return params;
  }

  function classifyGenericContact(a) {
    var href = a.getAttribute('href') || '';
    if (/^https:\/\/wa\.me\//i.test(href)) return { event: 'whatsapp_click', destinationType: 'whatsapp' };
    if (/^tel:/i.test(href)) return { event: 'call_click', destinationType: 'call' };
    if (/^mailto:/i.test(href)) return { event: 'email_click', destinationType: 'email' };
    return null;
  }

  function ctaLocationFor(a) {
    var own = a.getAttribute('data-cta-location');
    if (own) return own;
    var region = a.closest('[data-cta-region]');
    if (region) return region.getAttribute('data-cta-region');
    return 'unspecified';
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;

    // Explicit, data-driven events (blog_to_service_click, agency_primary_cta_click,
    // homepage_primary_cta_click, external_profile_click, etc.) take priority and
    // are never double-fired alongside the generic contact classification below.
    var explicitEvent = a.getAttribute('data-analytics-event');
    if (explicitEvent) {
      trackEvent(explicitEvent, readExplicitParams(a));
      return;
    }

    if (isManaged(a)) return; // already tracked by page-specific bespoke code

    var generic = classifyGenericContact(a);
    if (generic) {
      trackEvent(generic.event, { cta_location: ctaLocationFor(a), destination_type: generic.destinationType });
      return;
    }

    if (a.hasAttribute('hreflang') && a.closest('.lang-switch-menu')) {
      var ctaLocation = 'footer_language_switcher';
      if (a.closest('.lang-switch-nav')) ctaLocation = 'desktop_language_switcher';
      else if (a.closest('.mobile-menu-overlay')) ctaLocation = 'mobile_menu_language_switcher';
      trackEvent('language_switcher_click', { language_code: a.getAttribute('hreflang'), cta_location: ctaLocation });
    }
  }, true);
})();
