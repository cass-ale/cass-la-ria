/* ============================================================
   MAIN.JS
   Lightweight script for the Cass la Ria site.
   Currently handles viewport-height fix for mobile browsers
   and provides a hook for future enhancements.
   ============================================================ */

(function () {
  'use strict';

  /* ---- Mobile viewport height fix ----
     On iOS Safari and some Android browsers the address bar
     causes 100vh to be taller than the visible area.
     We set a CSS custom property --vh so layout can use it.  */

  function setViewportHeight() {
    var vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', vh + 'px');
  }

  setViewportHeight();
  window.addEventListener('resize', setViewportHeight);

  /* ---- Ready hook ----
     Add any future initialisation logic below.  */

  document.addEventListener('DOMContentLoaded', function () {
    // Site loaded — extend here as needed.
  });
})();
