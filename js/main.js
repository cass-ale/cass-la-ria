/* ============================================================
   MAIN.JS
   Lightweight script for the Cass la Ria site.
   Handles:
   - Viewport-height fix for mobile & in-app browsers (Instagram,
     TikTok, Facebook WebViews)
   - Social media deep linking (opens native app if installed)
   - Mailto fallback for Edge mobile / WebView
   - i18n language switching with CJK font lazy loading
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. VIEWPORT HEIGHT FIX
     On iOS Safari, Android Chrome, and especially in-app browsers
     (Instagram, TikTok, Facebook), 100vh includes the hidden area
     behind toolbars. We set --vh from window.innerHeight which is
     always the visible viewport.
     ============================================================ */

  function setViewportHeight() {
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }

  setViewportHeight();
  window.addEventListener('resize', setViewportHeight);
  /* orientationchange fires in WebViews where resize may not */
  window.addEventListener('orientationchange', function () {
    setTimeout(setViewportHeight, 150);
  });

  /* ============================================================
     2. SOCIAL MEDIA DEEP LINKING
     On mobile, attempt to open the native app first.
     If the app isn't installed, the browser stays on the page
     and we fall back to the regular https URL.

     data-app-ios: iOS URL scheme (e.g. youtube://...)
     data-app-android: Android intent URL
     ============================================================ */

  function isMobileDevice() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function setupDeepLinks() {
    if (!isMobileDevice()) return;

    var links = document.querySelectorAll('[data-app-ios], [data-app-android]');

    for (var i = 0; i < links.length; i++) {
      (function (link) {
        link.addEventListener('click', function (e) {
          var appUrl = null;

          if (isIOS() && link.getAttribute('data-app-ios')) {
            appUrl = link.getAttribute('data-app-ios');
          } else if (isAndroid() && link.getAttribute('data-app-android')) {
            /* Android intents handle fallback natively */
            appUrl = link.getAttribute('data-app-android');
          }

          if (appUrl) {
            e.preventDefault();
            var fallbackUrl = link.href;

            if (isAndroid()) {
              /* Android intent:// URLs handle their own fallback */
              window.location.href = appUrl;
            } else {
              /* iOS: try the app scheme, fall back after timeout */
              var start = Date.now();
              window.location.href = appUrl;

              setTimeout(function () {
                /* If we're still here after 1.5s, the app isn't installed */
                if (Date.now() - start < 2000) {
                  window.location.href = fallbackUrl;
                }
              }, 1500);
            }
          }
        });
      })(links[i]);
    }
  }

  /* ============================================================
     3. MAILTO FALLBACK (Edge mobile, Instagram WebView)
     Edge mobile and some in-app browsers silently fail on
     mailto: links. This handler tries multiple approaches:
     1. Let the native <a href="mailto:"> work (default on desktop)
     2. On mobile: try window.location.href assignment
     3. If still stuck: copy email to clipboard and show feedback

     Reference: stackoverflow.com/questions/63782544
     ============================================================ */

  function setupMailtoFallback() {
    var btn = document.getElementById('contact-btn');
    if (!btn) return;

    var email = 'admin@caprilaria.com';
    var mailto = 'mailto:' + email;

    btn.addEventListener('click', function (e) {
      /* On desktop browsers, the default <a href="mailto:"> works fine.
         On mobile, especially Edge and in-app browsers, we need help. */
      if (!isMobileDevice()) return; /* let default behavior work */

      e.preventDefault();

      /* Try 1: window.location.href (works in most mobile browsers) */
      try {
        window.location.href = mailto;
      } catch (err) {
        /* swallow — some WebViews throw on mailto: */
      }

      /* Try 2: after a short delay, if we're still here, copy to clipboard */
      setTimeout(function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(email).then(function () {
            showEmailCopied();
          });
        }
      }, 800);
    });
  }

  /**
   * Show "Email copied!" feedback in the current language.
   */
  function showEmailCopied() {
    var emailEl = document.querySelector('.hero__email');
    if (!emailEl) return;

    var i18nData = window.i18n || {};
    var lang = document.documentElement.lang || 'en';
    var translations = i18nData.translations || {};
    var langData = translations[lang] || translations['en'] || {};
    var msg = langData['email-copied'] || 'Email copied!';

    var orig = emailEl.textContent;
    emailEl.textContent = msg;
    emailEl.style.opacity = '1';
    setTimeout(function () {
      emailEl.textContent = orig;
      emailEl.style.opacity = '';
    }, 2500);
  }

  /* ============================================================
     4. i18n — LANGUAGE SWITCHING SYSTEM
     Switches all [data-i18n] elements to the selected language,
     updates <html lang>, saves preference to localStorage, and
     lazy-loads CJK fonts only when needed.

     Architecture:
       - Translation data lives in js/i18n.js (loaded before main.js)
       - Language switcher UI is in index.html
       - CJK fonts loaded via Google Fonts with text= subsetting
         (~17KB per font vs 9MB+ for full CJK sets)

     Sources:
       - MDN: developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/lang
       - W3C: w3.org/International/questions/qa-html-language-declarations
       - Smashing Magazine: smashingmagazine.com/2022/05/designing-better-language-selector
     ============================================================ */

  /* CJK languages that need special font loading */
  var CJK_LANGS = { ja: true, ko: true, zh: true };

  /* Google Fonts URLs with text= subsetting (only exact chars used on site).
     These are loaded lazily — zero cost for Latin-only visitors. */
  var CJK_FONT_URLS = {
    ja: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400&display=swap&text=%E3%81%97%E3%81%9F%E3%81%AE%E3%81%B8%E3%81%BE%E3%82%A4%E3%82%B3%E3%82%B5%E3%83%84%E3%83%86%E3%83%88%E3%83%94%E3%83%A1%E3%83%B3%E3%83%BC%E4%BA%A4%E5%83%8F%E5%85%AC%E5%B7%AE%E5%BC%8F%E6%97%A5%E6%98%A0%E6%9C%AC%E6%A5%BD%E7%82%B9%E8%8A%B8%E8%A1%93%E8%A6%96%E8%A6%9A%E8%AA%9E%E9%9F%B3',
    ko: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400&display=swap&text=%EA%B0%81%EA%B1%B4%EA%B3%B5%EA%B5%AD%EA%B8%B0%EB%84%88%EB%8A%94%EB%90%A8%EB%9B%B0%EB%9D%BD%EB%A1%9C%EB%A5%B4%EB%A6%AC%EB%A9%94%EB%AC%B8%EB%B3%B5%EB%B3%B8%EB%B8%8C%EC%82%AC%EC%83%81%EC%88%A0%EC%8B%9C%EC%8B%9D%EC%95%84%EC%95%85%EC%96%B4%EC%97%90%EC%97%B0%EC%98%81%EC%98%88%EC%9A%B0%EC%9B%B9%EC%9C%BC%EC%9D%84%EC%9D%8C%EC%9D%B4%EC%9D%BC%ED%81%AC%ED%8A%B8%ED%8B%B0%ED%95%98%ED%95%9C',
    zh: 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400&display=swap&text=%E4%B8%AD%E4%B9%90%E4%BD%9C%E5%83%8F%E5%88%9B%E5%88%B6%E5%A4%8D%E5%AE%98%E5%B7%B2%E5%BD%B1%E6%96%87%E6%96%B9%E6%9C%AF%E6%AD%A3%E7%95%8C%E7%AB%99%E7%AE%B1%E7%BB%9C%E7%BD%91%E8%80%85%E8%81%94%E8%87%B3%E8%89%BA%E8%A7%86%E8%A7%89%E8%B7%A8%E8%B7%B3%E9%82%AE%E9%9F%B3'
  };

  /* Track which CJK fonts have already been loaded */
  var loadedCJKFonts = {};

  /**
   * Lazy-load a CJK font stylesheet if not already loaded.
   * Injects a <link> tag into <head> for the Google Fonts CSS.
   */
  function loadCJKFont(lang) {
    if (!CJK_LANGS[lang] || loadedCJKFonts[lang]) return;

    var url = CJK_FONT_URLS[lang];
    if (!url) return;

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    loadedCJKFonts[lang] = true;
  }

  /**
   * OG locale mapping for meta tags.
   */
  var OG_LOCALES = {
    en: 'en_US',
    es: 'es_ES',
    pt: 'pt_BR',
    fr: 'fr_FR',
    ja: 'ja_JP',
    ko: 'ko_KR',
    id: 'id_ID',
    zh: 'zh_CN'
  };

  /**
   * Switch the site to the specified language.
   * Updates all [data-i18n] elements, <html lang>, meta tags,
   * aria-current on switcher, and persists to localStorage.
   */
  function switchLanguage(lang) {
    var i18nData = window.i18n || {};
    var translations = i18nData.translations || {};
    var defaultLang = i18nData.defaultLang || 'en';

    /* Fall back to default if language not found */
    if (!translations[lang]) {
      lang = defaultLang;
    }

    var langData = translations[lang];

    /* 1. Update <html lang> attribute */
    document.documentElement.lang = lang;

    /* 2. Update all [data-i18n] elements */
    var elements = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < elements.length; i++) {
      var key = elements[i].getAttribute('data-i18n');
      if (langData[key] !== undefined) {
        elements[i].textContent = langData[key];
      }
    }

    /* 3. Update meta tags */
    var metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && langData['meta-desc']) {
      metaDesc.setAttribute('content', langData['meta-desc']);
    }

    var ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc && langData['meta-desc']) {
      ogDesc.setAttribute('content', langData['meta-desc']);
    }

    var twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc && langData['meta-desc']) {
      twitterDesc.setAttribute('content', langData['meta-desc']);
    }

    var ogLocale = document.querySelector('meta[property="og:locale"]');
    if (ogLocale && OG_LOCALES[lang]) {
      ogLocale.setAttribute('content', OG_LOCALES[lang]);
    }

    /* 4. Update <title> */
    if (langData['meta-title']) {
      document.title = langData['meta-title'];
    }

    /* 5. Update language switcher aria-current */
    var options = document.querySelectorAll('.lang-switcher__option');
    for (var j = 0; j < options.length; j++) {
      var optLang = options[j].getAttribute('data-lang');
      if (optLang === lang) {
        options[j].setAttribute('aria-current', 'true');
      } else {
        options[j].removeAttribute('aria-current');
      }
    }

    /* 6. Lazy-load CJK font if needed */
    if (CJK_LANGS[lang]) {
      loadCJKFont(lang);
    }

    /* 7. Save preference to localStorage */
    try {
      localStorage.setItem('cass-la-ria-lang', lang);
    } catch (e) {
      /* localStorage may be blocked in some WebViews */
    }

    /* 8. Close the language dropdown */
    var trigger = document.getElementById('lang-trigger');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * Set up the language switcher UI interactions.
   * - Desktop: hover to show, click to select
   * - Mobile: tap globe to toggle, tap option to select
   * - Keyboard: Enter/Space to toggle, arrow keys to navigate
   */
  function setupLanguageSwitcher() {
    var trigger = document.getElementById('lang-trigger');
    var list = document.getElementById('lang-list');
    if (!trigger || !list) return;

    /* Toggle dropdown on click/tap */
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    });

    /* Handle language selection */
    var options = list.querySelectorAll('.lang-switcher__option');
    for (var i = 0; i < options.length; i++) {
      options[i].addEventListener('click', function (e) {
        e.stopPropagation();
        var lang = this.getAttribute('data-lang');
        if (lang) {
          switchLanguage(lang);
        }
      });
    }

    /* Close dropdown when clicking outside */
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.lang-switcher')) {
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    /* Keyboard navigation within the dropdown */
    list.addEventListener('keydown', function (e) {
      var items = list.querySelectorAll('.lang-switcher__option');
      var current = document.activeElement;
      var idx = -1;

      for (var j = 0; j < items.length; j++) {
        if (items[j] === current) { idx = j; break; }
      }

      if (e.key === 'ArrowDown' || e.key === 'Down') {
        e.preventDefault();
        var next = (idx + 1) % items.length;
        items[next].focus();
      } else if (e.key === 'ArrowUp' || e.key === 'Up') {
        e.preventDefault();
        var prev = (idx - 1 + items.length) % items.length;
        items[prev].focus();
      } else if (e.key === 'Escape' || e.key === 'Esc') {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });

    /* Restore saved language preference */
    var savedLang = null;
    try {
      savedLang = localStorage.getItem('cass-la-ria-lang');
    } catch (e) {
      /* localStorage may be blocked */
    }

    if (savedLang && window.i18n && window.i18n.translations[savedLang]) {
      switchLanguage(savedLang);
    }
  }

  /* ============================================================
     5. INITIALISATION
     ============================================================ */

  document.addEventListener('DOMContentLoaded', function () {
    setupDeepLinks();
    setupMailtoFallback();
    setupLanguageSwitcher();
  });
})();
