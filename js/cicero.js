/* ============================================================
   CICERO.JS — Story Page Script
   Lazy-load fade-in + i18n bridge for editable module.
   Made by CAPRI la Ria
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. LAZY-LOAD FADE-IN (IntersectionObserver)
     Elements with .fade-in get .is-visible when they enter
     the viewport. Threshold 0.15 = 15% visible triggers it.
     ============================================================ */

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.fade-in').forEach(function (el) {
      observer.observe(el);
    });
  } else {
    /* Fallback: show everything immediately */
    document.querySelectorAll('.fade-in').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  /* ============================================================
     2. I18N BRIDGE FOR EDITABLE MODULE
     The editable module (js/editable.js) expects window.I18N
     in the format { lang: { key: text } }. The demo i18n system
     uses window.i18n.translations in the same format, so we
     create a compatibility shim.
     ============================================================ */

  if (window.i18n && window.i18n.translations) {
    window.I18N = window.i18n.translations;
  }

  /* ============================================================
     3. LANGUAGE SWITCH HOOK
     When the language changes, update all story paragraphs
     and notify the editable module.
     ============================================================ */

  var lastLang = document.documentElement.lang || 'en';

  var langObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName === 'lang') {
        var newLang = document.documentElement.lang;
        if (newLang !== lastLang) {
          lastLang = newLang;
          onLanguageChanged(newLang);
        }
      }
    });
  });

  langObserver.observe(document.documentElement, { attributes: true });

  function onLanguageChanged(lang) {
    var translations = (window.i18n && window.i18n.translations) || {};
    var langData = translations[lang] || translations['en'] || {};

    /* Update all [data-i18n] elements that aren't user-modified */
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (langData[key] !== undefined) {
        el.setAttribute('data-original-text', langData[key]);
        if (!el.classList.contains('is-modified')) {
          el.textContent = langData[key];
        }
      }
    });

    /* Notify the editable module */
    if (window.EditableModule && window.EditableModule.onLanguageChange) {
      window.EditableModule.onLanguageChange();
    }
  }

  /* ============================================================
     4. SCROLL TO TOP ON LOAD
     ============================================================ */

  window.scrollTo(0, 0);

})();
