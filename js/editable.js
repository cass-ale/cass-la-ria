/* ============================================================
   INLINE EDITING — Crowdsource Translation Feedback
   
   Allows visitors to edit specified text elements inline.
   On desktop: double-click to edit, hover for tooltip.
   On mobile: tap to reveal edit pencil button, tap pencil to
   enter edit mode with visible Save/Cancel buttons.
   
   Changes persist per-user via localStorage and are logged
   with before/after data for translation skill training.
   
   USAGE:
     Add data-editable="unique-key" to any element:
       <p data-editable="hero-tagline" data-i18n="tagline">Original text</p>
   
     For multi-line elements (paragraphs, descriptions):
       <p data-editable="story-text" data-editable-multiline>Long text...</p>
       (Ctrl+Enter / Cmd+Enter saves; plain Enter adds line break)
   
     The "unique-key" is used as the localStorage key prefix.
     If the element also has data-i18n, the current language
     is included in the key for per-language editing.
   
   ACTIVATION:
     Include this script and css/editable.css in the page.
     The module self-initializes on DOMContentLoaded.
   
   DATA FORMAT (localStorage):
     editable_edits: JSON array of all edit events
     editable_[key]_[lang]: persisted text per element per language
   
   REMOTE LOGGING:
     Edits are also sent to a Google Sheet via Apps Script.
     Sheet: https://docs.google.com/spreadsheets/d/1dtYb5b_2DNpFJnZf23rfnQAJWVnE9hwnHLjZTn4XvT8/edit
     Endpoint: Google Apps Script doPost() web app
     Failures are silent — localStorage is the primary fallback.
   
   MOBILE UX:
     - Tap on editable element shows a floating pencil button
     - Tap pencil to enter edit mode
     - Visible Save/Cancel buttons replace Enter/Escape keys
     - Font size enforced >= 16px to prevent iOS auto-zoom
     - Editing element scrolled into view above virtual keyboard
     - Toast positioned higher to stay above keyboard
     - Larger touch targets (48px minimum) per Material Design
   
   DESKTOP UX (v2 — audit fixes):
     - Double-click to enter edit mode
     - Subtle inline hint bar: "Enter to save · Esc to cancel"
     - Enter saves (Ctrl+Enter for multiline elements)
     - Escape cancels
     - Click-outside CANCELS (does not auto-save)
     - Reset button visible at reduced opacity, full on hover
     - Screen reader announcements for edit state changes
   
   Sources & references:
     - contentEditable best practices: https://medium.com/content-uneditable/contenteditable-the-good-the-bad-and-the-ugly-261a38555e9c
     - localStorage persistence pattern: https://blog.stephentvedt.com/posts/2013/content-editable/
     - CoTranslate crowdsource model: https://www.sciencedirect.com/science/article/pii/S2352711023002042
     - Apple HIG touch targets: 44pt minimum
     - Material Design touch targets: 48dp minimum
     - CSS-Tricks mobile double-tap issue: https://css-tricks.com/annoying-mobile-double-tap-link-issue/
   ============================================================ */

;(function () {
  'use strict';

  /* ---- Constants ---- */
  var STORAGE_KEY_EDITS = 'editable_edits';
  var STORAGE_KEY_PREFIX = 'editable_';
  var REMOTE_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxLB4rItK7I8Th_G5vT2ITAUllEMUj78yzOSUifkZ2E1OG8l-ehkhKKya8Zqlu-Rj4/exec';
  var DOUBLE_CLICK_HINT = "Don't like the translation? Give it a try yourself!";
  var HINT_I18N = {
    en: "Don't like the translation? Give it a try yourself!",
    es: '\u00bfNo te convence la traducci\u00f3n? \u00a1Int\u00e9ntalo t\u00fa!',
    pt: 'N\u00e3o curtiu a tradu\u00e7\u00e3o? Tente voc\u00ea!',
    fr: 'La traduction ne vous pla\u00eet pas ? Essayez vous-m\u00eame !',
    ja: '\u7ffb\u8a33\u304c\u3057\u3063\u304f\u308a\u3053\u306a\u3044\uff1f\u81ea\u5206\u3067\u8a66\u3057\u3066\u307f\u3066\uff01',
    ko: '\ubc88\uc5ed\uc774 \ub9c8\uc74c\uc5d0 \uc548 \ub4dc\ub098\uc694? \uc9c1\uc811 \ud574 \ubcf4\uc138\uc694!',
    id: 'Kurang sreg dengan terjemahannya? Coba sendiri!',
    zh: '\u89c9\u5f97\u7ffb\u8bd1\u4e0d\u591f\u597d\uff1f\u6765\u8bd5\u8bd5\u4f60\u7684\u7248\u672c\uff01'
  };

  /* Desktop save/cancel hint text */
  var SAVE_HINT_I18N = {
    en: 'Enter to save \u00b7 Esc to cancel',
    es: 'Enter para guardar \u00b7 Esc para cancelar',
    pt: 'Enter para salvar \u00b7 Esc para cancelar',
    fr: 'Entr\u00e9e pour enregistrer \u00b7 \u00c9chap pour annuler',
    ja: 'Enter\u3067\u4fdd\u5b58 \u00b7 Esc\u3067\u30ad\u30e3\u30f3\u30bb\u30eb',
    ko: 'Enter \uc800\uc7a5 \u00b7 Esc \ucde8\uc18c',
    id: 'Enter untuk simpan \u00b7 Esc untuk batal',
    zh: 'Enter \u4fdd\u5b58 \u00b7 Esc \u53d6\u6d88'
  };

  /* Multiline save hint (Ctrl/Cmd+Enter) */
  var SAVE_HINT_MULTI_I18N = {
    en: 'Ctrl+Enter to save \u00b7 Esc to cancel',
    es: 'Ctrl+Enter para guardar \u00b7 Esc para cancelar',
    pt: 'Ctrl+Enter para salvar \u00b7 Esc para cancelar',
    fr: 'Ctrl+Entr\u00e9e pour enregistrer \u00b7 \u00c9chap pour annuler',
    ja: 'Ctrl+Enter\u3067\u4fdd\u5b58 \u00b7 Esc\u3067\u30ad\u30e3\u30f3\u30bb\u30eb',
    ko: 'Ctrl+Enter \uc800\uc7a5 \u00b7 Esc \ucde8\uc18c',
    id: 'Ctrl+Enter untuk simpan \u00b7 Esc untuk batal',
    zh: 'Ctrl+Enter \u4fdd\u5b58 \u00b7 Esc \u53d6\u6d88'
  };

  /* Mobile-specific button labels */
  var MOBILE_LABELS = {
    en: { save: 'Save', cancel: 'Cancel', edit: 'Edit' },
    es: { save: 'Guardar', cancel: 'Cancelar', edit: 'Editar' },
    pt: { save: 'Salvar', cancel: 'Cancelar', edit: 'Editar' },
    fr: { save: 'Enregistrer', cancel: 'Annuler', edit: 'Modifier' },
    ja: { save: '\u4fdd\u5b58', cancel: '\u30ad\u30e3\u30f3\u30bb\u30eb', edit: '\u7de8\u96c6' },
    ko: { save: '\uc800\uc7a5', cancel: '\ucde8\uc18c', edit: '\ud3b8\uc9d1' },
    id: { save: 'Simpan', cancel: 'Batal', edit: 'Edit' },
    zh: { save: '\u4fdd\u5b58', cancel: '\u53d6\u6d88', edit: '\u7f16\u8f91' }
  };

  /* ---- State ---- */
  var activeElement = null;
  var originalText = '';
  var toastEl = null;
  var toastTimer = null;
  var isTouchDevice = false;
  var activePencilBtn = null;
  var activeMobileBar = null;
  var activeDesktopHint = null;  // Desktop save/cancel hint element
  var srAnnouncer = null;        // Screen reader live region

  /* ---- Device detection ---- */

  function detectTouch() {
    if (window.matchMedia) {
      isTouchDevice = window.matchMedia('(hover: none)').matches;
    } else {
      isTouchDevice = 'ontouchstart' in window;
    }
  }

  /* ---- Helpers ---- */

  function getCurrentLang() {
    return document.documentElement.lang || 
           localStorage.getItem('preferred-language') || 
           'en';
  }

  function storageKey(editableKey) {
    return STORAGE_KEY_PREFIX + editableKey + '_' + getCurrentLang();
  }

  function getOriginalText(el) {
    var i18nKey = el.getAttribute('data-i18n');
    if (i18nKey && window.I18N && window.I18N[getCurrentLang()]) {
      return window.I18N[getCurrentLang()][i18nKey] || el.getAttribute('data-original-text') || '';
    }
    return el.getAttribute('data-original-text') || '';
  }

  function isMultiline(el) {
    return el.hasAttribute('data-editable-multiline');
  }

  function isMac() {
    return navigator.platform && navigator.platform.indexOf('Mac') > -1;
  }

  function getMobileLabels() {
    var lang = getCurrentLang();
    return MOBILE_LABELS[lang] || MOBILE_LABELS.en;
  }

  /* ---- Accessibility: screen reader announcements ---- */

  function ensureSRAnnouncer() {
    if (srAnnouncer) return;
    srAnnouncer = document.createElement('div');
    srAnnouncer.setAttribute('role', 'status');
    srAnnouncer.setAttribute('aria-live', 'assertive');
    srAnnouncer.setAttribute('aria-atomic', 'true');
    srAnnouncer.className = 'editable-sr-only';
    document.body.appendChild(srAnnouncer);
  }

  function announceToSR(message) {
    ensureSRAnnouncer();
    srAnnouncer.textContent = '';
    requestAnimationFrame(function () {
      srAnnouncer.textContent = message;
    });
  }

  /* ---- Toast notification ---- */

  function showToast(message) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'editable-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    if (isTouchDevice) {
      toastEl.classList.add('is-mobile');
    } else {
      toastEl.classList.remove('is-mobile');
    }
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2400);
  }

  /* ---- Remote logging ---- */

  function sendToRemote(editableKey, lang, before, after) {
    if (!REMOTE_ENDPOINT) return;

    var payload = {
      key: editableKey,
      lang: lang,
      before: before,
      after: after,
      url: window.location.pathname,
      userAgent: navigator.userAgent
    };

    try {
      fetch(REMOTE_ENDPOINT, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      }).catch(function () {
        // Network error — silently fail
      });
    } catch (e) {
      // fetch not available — silently fail
    }
  }

  function logEdit(editableKey, lang, before, after) {
    var edits = [];
    try {
      edits = JSON.parse(localStorage.getItem(STORAGE_KEY_EDITS)) || [];
    } catch (e) {
      edits = [];
    }

    edits.push({
      key: editableKey,
      lang: lang,
      before: before,
      after: after,
      timestamp: new Date().toISOString(),
      url: window.location.pathname,
      userAgent: navigator.userAgent
    });

    try {
      localStorage.setItem(STORAGE_KEY_EDITS, JSON.stringify(edits));
    } catch (e) {
      // localStorage full — silently fail
    }

    sendToRemote(editableKey, lang, before, after);
  }

  /* ---- Save / Reset ---- */

  function saveEdit(el) {
    var key = el.getAttribute('data-editable');
    var lang = getCurrentLang();
    var newText = el.textContent.trim();
    var origText = getOriginalText(el);

    if (newText === origText) {
      localStorage.removeItem(storageKey(key));
      el.classList.remove('is-modified');
      removeResetButton(el);
      return;
    }

    if (newText === '') {
      el.textContent = origText;
      localStorage.removeItem(storageKey(key));
      el.classList.remove('is-modified');
      removeResetButton(el);
      return;
    }

    try {
      localStorage.setItem(storageKey(key), newText);
    } catch (e) {}

    logEdit(key, lang, origText, newText);
    el.classList.add('is-modified');
    addResetButton(el);
    showToast('Edit saved');
    announceToSR('Your edit has been saved.');
  }

  function addResetButton(el) {
    if (el.querySelector('.editable-reset')) return;
    var btn = document.createElement('button');
    btn.className = 'editable-reset';
    btn.setAttribute('aria-label', 'Reset to original');
    btn.setAttribute('title', 'Reset to original');
    btn.innerHTML = '&#x2715;';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      resetElement(el);
    });
    btn.addEventListener('touchend', function (e) {
      e.stopPropagation();
      e.preventDefault();
      resetElement(el);
    });
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
    el.appendChild(btn);
  }

  function removeResetButton(el) {
    var btn = el.querySelector('.editable-reset');
    if (btn) btn.remove();
  }

  function resetElement(el) {
    var key = el.getAttribute('data-editable');
    var origText = getOriginalText(el);
    el.textContent = origText;
    localStorage.removeItem(storageKey(key));
    el.classList.remove('is-modified');
    removeResetButton(el);
    showToast('Reset to original');
    announceToSR('Text has been reset to the original.');
  }

  /* ---- Desktop UI: Save/Cancel hint bar ---- */

  function showDesktopHint(el) {
    removeDesktopHint();

    var lang = getCurrentLang();
    var multi = isMultiline(el);
    var hintText = multi
      ? (SAVE_HINT_MULTI_I18N[lang] || SAVE_HINT_MULTI_I18N.en)
      : (SAVE_HINT_I18N[lang] || SAVE_HINT_I18N.en);

    // On Mac, replace "Ctrl" with "Cmd" for multiline
    if (multi && isMac()) {
      hintText = hintText.replace('Ctrl', '\u2318');
    }

    var hint = document.createElement('div');
    hint.className = 'editable-desktop-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = hintText;

    // Insert after the element
    if (el.nextSibling) {
      el.parentNode.insertBefore(hint, el.nextSibling);
    } else {
      el.parentNode.appendChild(hint);
    }
    activeDesktopHint = hint;

    // Animate in
    requestAnimationFrame(function () {
      hint.classList.add('is-visible');
    });
  }

  function removeDesktopHint() {
    if (activeDesktopHint) {
      activeDesktopHint.classList.remove('is-visible');
      var ref = activeDesktopHint;
      setTimeout(function () { ref.remove(); }, 300);
      activeDesktopHint = null;
    }
  }

  /* ---- Mobile UI: Pencil button ---- */

  function showPencilButton(el) {
    removePencilButton();

    var labels = getMobileLabels();
    var btn = document.createElement('button');
    btn.className = 'editable-pencil-btn';
    btn.setAttribute('aria-label', labels.edit);
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

    var rect = el.getBoundingClientRect();
    btn.style.position = 'fixed';
    btn.style.top = Math.max(8, rect.top - 48) + 'px';
    btn.style.right = '16px';
    btn.style.zIndex = '10001';

    btn.addEventListener('touchend', function (e) {
      e.preventDefault();
      e.stopPropagation();
      removePencilButton();
      startEditing(el);
    });

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      removePencilButton();
      startEditing(el);
    });

    document.body.appendChild(btn);
    activePencilBtn = btn;

    setTimeout(function () {
      if (activePencilBtn === btn) {
        removePencilButton();
      }
    }, 4000);
  }

  function removePencilButton() {
    if (activePencilBtn) {
      activePencilBtn.remove();
      activePencilBtn = null;
    }
  }

  /* ---- Mobile UI: Save/Cancel bar ---- */

  function showMobileBar(el) {
    removeMobileBar();

    var labels = getMobileLabels();
    var bar = document.createElement('div');
    bar.className = 'editable-mobile-bar';

    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'editable-mobile-btn editable-mobile-cancel';
    cancelBtn.textContent = labels.cancel;
    cancelBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      e.stopPropagation();
      cancelEditing(el);
    });
    cancelBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      cancelEditing(el);
    });

    var saveBtn = document.createElement('button');
    saveBtn.className = 'editable-mobile-btn editable-mobile-save';
    saveBtn.textContent = labels.save;
    saveBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      e.stopPropagation();
      finishEditing(el);
    });
    saveBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      finishEditing(el);
    });

    bar.appendChild(cancelBtn);
    bar.appendChild(saveBtn);
    document.body.appendChild(bar);
    activeMobileBar = bar;

    requestAnimationFrame(function () {
      bar.classList.add('is-visible');
    });
  }

  function removeMobileBar() {
    if (activeMobileBar) {
      activeMobileBar.classList.remove('is-visible');
      var barRef = activeMobileBar;
      setTimeout(function () { barRef.remove(); }, 300);
      activeMobileBar = null;
    }
  }

  /* ---- Core editing logic ---- */

  function startEditing(el) {
    if (activeElement) {
      cancelEditing(activeElement);
    }

    activeElement = el;
    originalText = el.textContent;

    el.setAttribute('contenteditable', 'true');
    el.classList.add('is-editing');

    if (isTouchDevice) {
      showMobileBar(el);
      el.classList.add('is-editing-mobile');
    } else {
      showDesktopHint(el);
    }

    el.focus();

    // Select all text for easy replacement — use a small delay
    // to avoid the double-click word-selection flash on desktop
    setTimeout(function () {
      var range = document.createRange();
      range.selectNodeContents(el);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }, 10);

    // Scroll element into view on mobile
    if (isTouchDevice) {
      setTimeout(function () {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 350);
    }

    announceToSR('Editing mode. ' + (isMultiline(el) ? 'Press Control Enter to save, or Escape to cancel.' : 'Press Enter to save, or Escape to cancel.'));
  }

  function finishEditing(el) {
    if (!el) return;

    el.removeAttribute('contenteditable');
    el.classList.remove('is-editing');
    el.classList.remove('is-editing-mobile');

    var cleanText = el.textContent.trim();
    el.textContent = cleanText;

    saveEdit(el);
    activeElement = null;
    originalText = '';

    removeDesktopHint();

    if (isTouchDevice) {
      removeMobileBar();
      el.blur();
      document.activeElement && document.activeElement.blur();
    }
  }

  function cancelEditing(el) {
    if (!el) return;

    el.removeAttribute('contenteditable');
    el.classList.remove('is-editing');
    el.classList.remove('is-editing-mobile');
    el.textContent = originalText;
    activeElement = null;
    originalText = '';

    removeDesktopHint();

    if (isTouchDevice) {
      removeMobileBar();
      el.blur();
      document.activeElement && document.activeElement.blur();
    }

    announceToSR('Editing cancelled.');
  }

  /* ---- Initialization ---- */

  function init() {
    detectTouch();

    var elements = document.querySelectorAll('[data-editable]');
    if (!elements.length) return;

    var lang = getCurrentLang();

    elements.forEach(function (el) {
      var key = el.getAttribute('data-editable');

      // Store the original text
      if (!el.hasAttribute('data-original-text')) {
        el.setAttribute('data-original-text', el.textContent.trim());
      }

      // Set the hover hint (desktop only — hidden by CSS on touch)
      el.setAttribute('data-edit-hint', HINT_I18N[lang] || DOUBLE_CLICK_HINT);

      // Apply any saved user override
      var saved = localStorage.getItem(storageKey(key));
      if (saved) {
        el.textContent = saved;
        el.classList.add('is-modified');
        addResetButton(el);
      }

      // Desktop: double-click to edit
      el.addEventListener('dblclick', function (e) {
        if (isTouchDevice) return;
        e.preventDefault();
        startEditing(el);
      });

      // Mobile: single tap to show pencil button
      el.addEventListener('touchend', function (e) {
        if (!isTouchDevice) return;
        if (activeElement === el) return;

        if (e.target.classList && e.target.classList.contains('editable-reset')) return;

        e.preventDefault();
        showPencilButton(el);
      });
    });

    // Desktop: keyboard handlers
    document.addEventListener('keydown', function (e) {
      if (!activeElement) return;

      // Escape always cancels
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing(activeElement);
        return;
      }

      // Enter handling depends on multiline mode
      if (e.key === 'Enter') {
        if (isMultiline(activeElement)) {
          // Multiline: Ctrl+Enter (or Cmd+Enter on Mac) saves
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            finishEditing(activeElement);
          }
          // Plain Enter: allow default (line break) in multiline
        } else {
          // Single-line: Enter saves
          if (!e.shiftKey) {
            e.preventDefault();
            finishEditing(activeElement);
          }
        }
      }
    });

    // Desktop: click-outside CANCELS (not saves)
    document.addEventListener('mousedown', function (e) {
      if (!activeElement) return;
      if (isTouchDevice) return;
      if (activeElement.contains(e.target)) return;
      // Don't cancel if clicking the desktop hint bar
      if (activeDesktopHint && activeDesktopHint.contains(e.target)) return;
      // Don't cancel if clicking a reset button
      if (e.target.classList && e.target.classList.contains('editable-reset')) return;

      cancelEditing(activeElement);
    });

    // Dismiss pencil button when tapping elsewhere on mobile
    document.addEventListener('touchend', function (e) {
      if (!activePencilBtn) return;
      if (activePencilBtn.contains(e.target)) return;
      if (e.target.closest && e.target.closest('[data-editable]')) return;
      removePencilButton();
    });

    // Listen for orientation changes to re-detect touch
    window.addEventListener('resize', function () {
      detectTouch();
    });

    if (isTouchDevice) {
      document.body.classList.add('is-touch-device');
    }
  }

  /**
   * Re-initialize after a language switch.
   */
  function onLanguageChange() {
    var elements = document.querySelectorAll('[data-editable]');
    var lang = getCurrentLang();

    elements.forEach(function (el) {
      var key = el.getAttribute('data-editable');

      el.setAttribute('data-edit-hint', HINT_I18N[lang] || DOUBLE_CLICK_HINT);

      var i18nKey = el.getAttribute('data-i18n');
      if (i18nKey && window.I18N && window.I18N[lang]) {
        el.setAttribute('data-original-text', window.I18N[lang][i18nKey] || el.textContent.trim());
      }

      var saved = localStorage.getItem(storageKey(key));
      if (saved) {
        el.textContent = saved;
        el.classList.add('is-modified');
        addResetButton(el);
      } else {
        el.classList.remove('is-modified');
        removeResetButton(el);
      }
    });
  }

  function exportEdits() {
    var edits = [];
    try {
      edits = JSON.parse(localStorage.getItem(STORAGE_KEY_EDITS)) || [];
    } catch (e) {
      edits = [];
    }
    return JSON.stringify(edits, null, 2);
  }

  function editSummary() {
    var edits = [];
    try {
      edits = JSON.parse(localStorage.getItem(STORAGE_KEY_EDITS)) || [];
    } catch (e) {
      edits = [];
    }

    var summary = {};
    edits.forEach(function (edit) {
      var group = edit.lang + '/' + edit.key;
      if (!summary[group]) {
        summary[group] = {
          key: edit.key,
          lang: edit.lang,
          original: edit.before,
          suggestions: [],
          count: 0
        };
      }
      summary[group].suggestions.push(edit.after);
      summary[group].count++;
    });

    return summary;
  }

  function clearAll() {
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(STORAGE_KEY_PREFIX) === 0) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(function (k) {
      localStorage.removeItem(k);
    });

    document.querySelectorAll('[data-editable]').forEach(function (el) {
      var origText = getOriginalText(el);
      if (origText) el.textContent = origText;
      el.classList.remove('is-modified');
      removeResetButton(el);
    });

    showToast('All edits cleared');
  }

  /* ---- Public API ---- */
  window.EditableModule = {
    init: init,
    onLanguageChange: onLanguageChange,
    exportEdits: exportEdits,
    editSummary: editSummary,
    clearAll: clearAll
  };

  /* ---- Auto-init ---- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
