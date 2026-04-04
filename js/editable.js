/* ============================================================
   INLINE EDITING — Crowdsource Translation Feedback
   
   Allows visitors to double-click specified text elements to
   edit them inline. Changes persist per-user via localStorage
   and are logged with before/after data for translation skill
   training.
   
   USAGE:
     Add data-editable="unique-key" to any element:
       <p data-editable="hero-tagline" data-i18n="tagline">Original text</p>
   
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
   
   Sources & references:
     - contentEditable best practices: https://medium.com/content-uneditable/contenteditable-the-good-the-bad-and-the-ugly-261a38555e9c
     - localStorage persistence pattern: https://blog.stephentvedt.com/posts/2013/content-editable/
     - CoTranslate crowdsource model: https://www.sciencedirect.com/science/article/pii/S2352711023002042
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
    es: '¿No te convence la traducción? ¡Inténtalo tú!',
    pt: 'Não curtiu a tradução? Tente você!',
    fr: 'La traduction ne vous plaît pas ? Essayez vous-même !',
    ja: '翻訳がしっくりこない？自分で試してみて！',
    ko: '번역이 마음에 안 드나요? 직접 해 보세요!',
    id: 'Kurang sreg dengan terjemahannya? Coba sendiri!',
    zh: '觉得翻译不够好？来试试你的版本！'
  };

  /* ---- State ---- */
  var activeElement = null;
  var originalText = '';
  var toastEl = null;
  var toastTimer = null;

  /* ---- Helpers ---- */

  /**
   * Get the current site language from the <html> lang attribute
   * or from localStorage (matching the i18n system).
   */
  function getCurrentLang() {
    return document.documentElement.lang || 
           localStorage.getItem('preferred-language') || 
           'en';
  }

  /**
   * Build a storage key for a specific editable element.
   * Includes the language so edits are per-language.
   */
  function storageKey(editableKey) {
    return STORAGE_KEY_PREFIX + editableKey + '_' + getCurrentLang();
  }

  /**
   * Get the original (untouched) text for an element.
   * If the element has data-i18n, pull from the i18n system.
   * Otherwise use data-original-text (set on init).
   */
  function getOriginalText(el) {
    var i18nKey = el.getAttribute('data-i18n');
    if (i18nKey && window.I18N && window.I18N[getCurrentLang()]) {
      return window.I18N[getCurrentLang()][i18nKey] || el.getAttribute('data-original-text') || '';
    }
    return el.getAttribute('data-original-text') || '';
  }

  /**
   * Show a brief toast notification.
   */
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
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-visible');
    }, 2400);
  }

  /**
   * Send an edit event to the remote Google Sheet endpoint.
   * Uses fetch with no-cors mode since Apps Script redirects.
   * Failures are silent — the localStorage log is the fallback.
   */
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
        // Network error — silently fail, localStorage has the backup
      });
    } catch (e) {
      // fetch not available — silently fail
    }
  }

  /**
   * Log an edit event to localStorage and send to remote.
   */
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

    // Also send to the remote Google Sheet
    sendToRemote(editableKey, lang, before, after);
  }

  /**
   * Save the user's edited text for a specific element.
   */
  function saveEdit(el) {
    var key = el.getAttribute('data-editable');
    var lang = getCurrentLang();
    var newText = el.textContent.trim();
    var origText = getOriginalText(el);

    if (newText === origText) {
      // User reverted to original — remove the override
      localStorage.removeItem(storageKey(key));
      el.classList.remove('is-modified');
      removeResetButton(el);
      return;
    }

    if (newText === '') {
      // Don't allow empty edits — revert
      el.textContent = origText;
      localStorage.removeItem(storageKey(key));
      el.classList.remove('is-modified');
      removeResetButton(el);
      return;
    }

    // Save the override
    try {
      localStorage.setItem(storageKey(key), newText);
    } catch (e) {
      // localStorage full
    }

    // Log the edit
    logEdit(key, lang, origText, newText);

    // Mark as modified
    el.classList.add('is-modified');
    addResetButton(el);

    showToast('Edit saved');
  }

  /**
   * Add a reset button to a modified element.
   */
  function addResetButton(el) {
    if (el.querySelector('.editable-reset')) return;
    var btn = document.createElement('button');
    btn.className = 'editable-reset';
    btn.setAttribute('aria-label', 'Reset to original');
    btn.setAttribute('title', 'Reset to original');
    btn.innerHTML = '&#x2715;'; // × symbol
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      resetElement(el);
    });
    // Ensure parent has position for absolute child
    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }
    el.appendChild(btn);
  }

  /**
   * Remove the reset button from an element.
   */
  function removeResetButton(el) {
    var btn = el.querySelector('.editable-reset');
    if (btn) btn.remove();
  }

  /**
   * Reset an element to its original translation.
   */
  function resetElement(el) {
    var key = el.getAttribute('data-editable');
    var origText = getOriginalText(el);
    el.textContent = origText;
    localStorage.removeItem(storageKey(key));
    el.classList.remove('is-modified');
    removeResetButton(el);
    showToast('Reset to original');
  }

  /* ---- Core editing logic ---- */

  /**
   * Enter edit mode on an element.
   */
  function startEditing(el) {
    if (activeElement) {
      finishEditing(activeElement);
    }

    activeElement = el;
    originalText = el.textContent;

    el.setAttribute('contenteditable', 'true');
    el.classList.add('is-editing');
    el.focus();

    // Select all text for easy replacement
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  /**
   * Exit edit mode and save.
   */
  function finishEditing(el) {
    if (!el) return;

    el.removeAttribute('contenteditable');
    el.classList.remove('is-editing');

    // Strip any HTML that contentEditable may have introduced
    var cleanText = el.textContent.trim();
    el.textContent = cleanText;

    saveEdit(el);
    activeElement = null;
    originalText = '';
  }

  /**
   * Cancel editing and revert.
   */
  function cancelEditing(el) {
    if (!el) return;

    el.removeAttribute('contenteditable');
    el.classList.remove('is-editing');
    el.textContent = originalText;
    activeElement = null;
    originalText = '';
  }

  /* ---- Initialization ---- */

  /**
   * Initialize all editable elements on the page.
   */
  function init() {
    var elements = document.querySelectorAll('[data-editable]');
    if (!elements.length) return;

    var lang = getCurrentLang();

    elements.forEach(function (el) {
      var key = el.getAttribute('data-editable');

      // Store the original text (before any user overrides)
      if (!el.hasAttribute('data-original-text')) {
        el.setAttribute('data-original-text', el.textContent.trim());
      }

      // Set the hover hint in the current language
      el.setAttribute('data-edit-hint', HINT_I18N[lang] || DOUBLE_CLICK_HINT);

      // Apply any saved user override
      var saved = localStorage.getItem(storageKey(key));
      if (saved) {
        el.textContent = saved;
        el.classList.add('is-modified');
        addResetButton(el);
      }

      // Double-click to edit
      el.addEventListener('dblclick', function (e) {
        e.preventDefault();
        startEditing(el);
      });
    });

    // Global keyboard handlers
    document.addEventListener('keydown', function (e) {
      if (!activeElement) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        finishEditing(activeElement);
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditing(activeElement);
      }
    });

    // Click outside to finish editing
    document.addEventListener('click', function (e) {
      if (!activeElement) return;
      if (!activeElement.contains(e.target)) {
        finishEditing(activeElement);
      }
    });
  }

  /**
   * Re-initialize after a language switch.
   * Called by the i18n system when the language changes.
   * Updates hints and restores per-language overrides.
   */
  function onLanguageChange() {
    var elements = document.querySelectorAll('[data-editable]');
    var lang = getCurrentLang();

    elements.forEach(function (el) {
      var key = el.getAttribute('data-editable');

      // Update the hover hint
      el.setAttribute('data-edit-hint', HINT_I18N[lang] || DOUBLE_CLICK_HINT);

      // Update the original text reference (i18n may have changed it)
      var i18nKey = el.getAttribute('data-i18n');
      if (i18nKey && window.I18N && window.I18N[lang]) {
        el.setAttribute('data-original-text', window.I18N[lang][i18nKey] || el.textContent.trim());
      }

      // Check for a saved override in this language
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

  /**
   * Export the edit log as a JSON string (for manual retrieval).
   * Call window.EditableModule.exportEdits() from the console.
   */
  function exportEdits() {
    var edits = [];
    try {
      edits = JSON.parse(localStorage.getItem(STORAGE_KEY_EDITS)) || [];
    } catch (e) {
      edits = [];
    }
    return JSON.stringify(edits, null, 2);
  }

  /**
   * Get a summary of all edits grouped by language and key.
   * Call window.EditableModule.editSummary() from the console.
   */
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

  /**
   * Clear all edits and overrides (for development/testing).
   * Call window.EditableModule.clearAll() from the console.
   */
  function clearAll() {
    // Remove all editable_ prefixed keys
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

    // Reset all elements
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
