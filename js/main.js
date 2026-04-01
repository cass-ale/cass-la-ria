/* ============================================================
   MAIN.JS
   Lightweight script for the Cass la Ria site.
   Handles:
   - Viewport-height fix for mobile & in-app browsers (Instagram,
     TikTok, Facebook WebViews)
   - Social media deep linking (opens native app if installed)
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
            var emailEl = document.querySelector('.hero__email');
            if (emailEl) {
              var orig = emailEl.textContent;
              emailEl.textContent = 'Email copied to clipboard!';
              emailEl.style.opacity = '1';
              setTimeout(function () {
                emailEl.textContent = orig;
                emailEl.style.opacity = '';
              }, 2500);
            }
          });
        }
      }, 800);
    });
  }

  /* ============================================================
     4. INITIALISATION
     ============================================================ */

  document.addEventListener('DOMContentLoaded', function () {
    setupDeepLinks();
    setupMailtoFallback();
  });
})();
