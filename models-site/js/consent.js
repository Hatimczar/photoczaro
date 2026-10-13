/*
 * Analytics consent for models.photoczaro.com.
 * Google Analytics 4 is NOT loaded until the visitor accepts. The choice is
 * kept in localStorage; "Cookie settings" in the footer reopens the banner,
 * and declining after accepting stops measurement and clears the GA cookies.
 * The admin panel never loads this script.
 */
(function () {
  "use strict";
  const GA_ID = "G-K0ZSGEKSDS";
  const KEY = "pczAnalyticsConsent";
  const i18n = window.PhotoczaroI18n;
  const FALLBACK = {
    "consent.title": "Analytics cookies",
    "consent.body": "We would like to use Google Analytics to understand how visitors use this site. It sets cookies and sends usage data to Google. Nothing is collected unless you accept.",
    "consent.policy": "Privacy Policy",
    "consent.accept": "Accept",
    "consent.decline": "Decline",
  };
  const t = (k) => { const v = i18n && i18n.t ? i18n.t(k) : null; return v == null ? FALLBACK[k] : v; };

  let memory = null;
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return memory; } }
  function write(v) { memory = v; try { localStorage.setItem(KEY, v); } catch (e) { /* storage blocked: the choice lasts for this page view */ } }

  function loadAnalytics() {
    if (window.__pczGaLoaded) return;
    window.__pczGaLoaded = true;
    window["ga-disable-" + GA_ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    // Measurement only: no Google Signals, no ad personalisation.
    window.gtag("config", GA_ID, { anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }

  function stopAnalytics() {
    window["ga-disable-" + GA_ID] = true;
    const host = location.hostname.split(".");
    const domains = [location.hostname, "." + location.hostname, host.length > 2 ? "." + host.slice(-2).join(".") : ""];
    document.cookie.split(";").map((c) => c.trim().split("=")[0]).filter((n) => /^_ga/.test(n)).forEach((n) => {
      domains.forEach((d) => { document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (d ? "; domain=" + d : ""); });
    });
  }

  let banner = null;
  function closeBanner(returnFocus) {
    if (banner) { banner.remove(); banner = null; }
    if (returnFocus) returnFocus.focus();
  }

  function openBanner(opener) {
    if (banner) { banner.querySelector("button").focus(); return; }
    banner = document.createElement("div");
    banner.className = "consent-banner";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-modal", "false");
    banner.setAttribute("aria-labelledby", "consent-title");
    const policy = i18n && i18n.path ? i18n.path("/privacy-policy") : "/privacy-policy";
    banner.innerHTML =
      '<p class="consent-title" id="consent-title"></p>' +
      '<p class="consent-body"><span></span> <a></a></p>' +
      '<div class="consent-actions"><button type="button" class="consent-btn consent-accept"></button><button type="button" class="consent-btn consent-decline"></button></div>';
    banner.querySelector(".consent-title").textContent = t("consent.title");
    banner.querySelector(".consent-body span").textContent = t("consent.body");
    const link = banner.querySelector(".consent-body a");
    link.textContent = t("consent.policy");
    link.href = policy;
    const accept = banner.querySelector(".consent-accept");
    const decline = banner.querySelector(".consent-decline");
    accept.textContent = t("consent.accept");
    decline.textContent = t("consent.decline");
    accept.addEventListener("click", () => { write("granted"); loadAnalytics(); closeBanner(opener); });
    decline.addEventListener("click", () => { write("denied"); stopAnalytics(); closeBanner(opener); });
    banner.addEventListener("keydown", (e) => { if (e.key === "Escape") { write("denied"); stopAnalytics(); closeBanner(opener); } });
    document.body.appendChild(banner);
    if (opener) accept.focus();
  }

  function init() {
    const choice = read();
    if (choice === "granted") loadAnalytics();
    else if (choice !== "denied") openBanner(null);
    document.querySelectorAll("[data-consent-open]").forEach((b) => b.addEventListener("click", () => openBanner(b)));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
