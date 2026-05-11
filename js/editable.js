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
     Edits are sent to a Google Sheet via Apps Script in
     debounced batches (5s delay). On page close, any pending
     edits are flushed via navigator.sendBeacon.
     Sheet: https://docs.google.com/spreadsheets/d/1dtYb5b_2DNpFJnZf23rfnQAJWVnE9hwnHLjZTn4XvT8/edit
     Endpoint: Google Apps Script doPost() web app
     Failures are silent — localStorage is the primary fallback.
   
   SPAM / TROLL DETECTION:
     Each edit is analysed client-side before submission.
     Flags (PROFANITY, GIBBERISH, LENGTH_LONG, LENGTH_SHORT,
     LINK_INJECT, RATE_FLOOD, DUPLICATE) are included in the
     payload so the Google Sheet can filter flagged rows.
     Edits are never blocked — flags are informational only.
   
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

  /* ---- Language gate ---- */
  /* Editing is only available for non-English languages.
     English is the source text — nothing to improve. */
  function isSourceLang() {
    return getCurrentLang() === 'en';
  }

  /* ---- English hover suppression ----
     When the language is English, we completely remove the
     data-editable attribute so that editable.css hover styles
     (dashed underline, tooltip) cannot match. The key is stashed
     in data-editable-key so it can be restored when switching
     to a non-English language.
     This is more robust than CSS-only suppression because it
     eliminates the selector match at the DOM level, avoiding
     any specificity or cache issues.
     Reference: https://css-tricks.com/a-complete-guide-to-data-attributes/ */

  function suppressEditableForEnglish() {
    /* Add class-based CSS guard (Edge-safe, no attribute-selector issues).
       Reference: https://stackoverflow.com/q/44723246 */
    document.documentElement.classList.add('is-source-lang');

    document.querySelectorAll('[data-editable]').forEach(function (el) {
      var key = el.getAttribute('data-editable');
      el.setAttribute('data-editable-key', key);
      el.removeAttribute('data-editable');
      el.removeAttribute('data-edit-hint');
      el.removeAttribute('data-editable-multiline');
    });
  }

  function restoreEditableForTranslation(lang) {
    /* Remove class-based CSS guard so hover styles apply again */
    document.documentElement.classList.remove('is-source-lang');

    document.querySelectorAll('[data-editable-key]').forEach(function (el) {
      var key = el.getAttribute('data-editable-key');
      el.setAttribute('data-editable', key);
      /* Restore multiline if the element originally had it
         (we detect this from the HTML — multiline elements have
         longer text content, typically paragraphs) */
      if (el.hasAttribute('data-editable-multiline-stash')) {
        el.setAttribute('data-editable-multiline', '');
      }
      el.setAttribute('data-edit-hint', HINT_I18N[lang] || DOUBLE_CLICK_HINT);
    });
  }

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

  /* ---- Spam / troll detection ---- */

  /**
   * Analyse an edit and return an array of flag strings.
   * An empty array means the edit looks legitimate.
   *
   * Heuristics (all client-side, lightweight, no external API):
   *   1. PROFANITY    — matches a compact list of common English slurs
   *                     and spam keywords. Not exhaustive, but catches
   *                     the obvious cases without a heavy dictionary.
   *   2. GIBBERISH    — text is >60% non-letter characters (excluding
   *                     CJK/Hangul/Devanagari/Arabic which are valid).
   *   3. LENGTH       — edit is >5x or <0.1x the original length.
   *   4. LINK_INJECT  — edit contains http://, https://, or www.
   *   5. RATE_FLOOD   — user has submitted >10 edits in the last 5 min.
   *   6. DUPLICATE    — identical text submitted for the same key+lang.
   *
   * Flags are informational — the edit is still saved locally and
   * sent to the Google Sheet with a "flags" column so the site
   * owner can filter/review flagged rows.
   *
   * References:
   *   - Honeypot + heuristic anti-spam: https://dev.to/ingosteinke/how-to-stop-form-spam-without-using-recaptcha-13i8
   *   - Client-side spam filtering: https://stackoverflow.com/questions/3868643
   *   - Content moderation best practices: https://dev.to/bewalt/content-moderation-and-profanity-filtering-best-practices-1ik8
   */

  /* Compact profanity / spam keyword list (lowercase).
     Kept intentionally short — catches blatant trolling, not edge cases. */
  var PROFANITY_RE = /\b(fuck|shit|ass(?:hole)?|bitch|cunt|dick|damn|bastard|nigger|faggot|retard|whore|slut|cock|penis|vagina|porn|viagra|cialis|casino|crypto|nft|airdrop|buy\s?now|click\s?here|free\s?money|subscribe|follow\s?me)\b/i;

  /* URL / link injection pattern */
  var LINK_RE = /https?:\/\/|www\./i;

  /* Non-letter noise detector.
     Matches characters that are NOT: letters (any script), digits,
     whitespace, or common punctuation. If >60% of the text is noise,
     it is likely gibberish / keyboard mashing. */
  var NOISE_CHAR_RE = /[^\p{L}\p{N}\s.,;:!?'"\-\u2014\u2013()\[\]]/gu;

  /* Rate limiting state */
  var recentEditTimestamps = [];
  var RATE_WINDOW_MS = 5 * 60 * 1000;  // 5 minutes
  var RATE_MAX_EDITS = 10;

  function detectSpamFlags(editableKey, lang, before, after) {
    var flags = [];

    /* 1. Profanity / spam keywords */
    if (PROFANITY_RE.test(after)) {
      flags.push('PROFANITY');
    }

    /* 2. Gibberish — high ratio of non-letter noise characters */
    if (after.length > 3) {
      var noiseChars = after.match(NOISE_CHAR_RE);
      var noiseRatio = noiseChars ? noiseChars.length / after.length : 0;
      if (noiseRatio > 0.6) {
        flags.push('GIBBERISH');
      }
    }

    /* 3. Length anomaly — suspiciously long or short vs original */
    if (before.length > 0) {
      var ratio = after.length / before.length;
      if (ratio > 5) {
        flags.push('LENGTH_LONG');
      } else if (ratio < 0.1) {
        flags.push('LENGTH_SHORT');
      }
    }

    /* 4. Link / URL injection */
    if (LINK_RE.test(after)) {
      flags.push('LINK_INJECT');
    }

    /* 5. Rate flooding — too many edits in a short window */
    var now = Date.now();
    recentEditTimestamps.push(now);
    /* Prune timestamps older than the window */
    recentEditTimestamps = recentEditTimestamps.filter(function (t) {
      return now - t < RATE_WINDOW_MS;
    });
    if (recentEditTimestamps.length > RATE_MAX_EDITS) {
      flags.push('RATE_FLOOD');
    }

    /* 6. Duplicate — same text already submitted for this key+lang */
    var dupeKey = 'editable_dupe_' + editableKey + '_' + lang;
    try {
      var prev = localStorage.getItem(dupeKey);
      if (prev === after) {
        flags.push('DUPLICATE');
      }
      localStorage.setItem(dupeKey, after);
    } catch (e) { /* ignore */ }

    return flags;
  }

  /* ---- Remote logging (debounced batch) ---- */

  /**
   * Edits are collected into a batch queue and flushed to the
   * Google Sheet endpoint after a short delay (BATCH_DELAY_MS).
   * This avoids firing a separate fetch() for every keystroke
   * or rapid edit sequence.
   *
   * If the user closes the tab before the batch fires, the
   * 'visibilitychange' / 'pagehide' listener flushes immediately
   * via navigator.sendBeacon (which survives page unload).
   *
   * References:
   *   - navigator.sendBeacon: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/sendBeacon
   *   - Batching pattern: https://web.dev/articles/performance-http2
   */

  var pendingBatch = [];
  var batchTimer = null;
  var BATCH_DELAY_MS = 5000;  // 5-second debounce

  function queueForRemote(payload) {
    if (!REMOTE_ENDPOINT) return;
    pendingBatch.push(payload);

    /* Reset the debounce timer */
    clearTimeout(batchTimer);
    batchTimer = setTimeout(flushBatch, BATCH_DELAY_MS);
  }

  function flushBatch() {
    if (!pendingBatch.length) return;

    var batch = pendingBatch.slice();
    pendingBatch = [];
    clearTimeout(batchTimer);

    /* Send each edit as an individual request (Apps Script doPost
       expects a single edit object, not an array). We use a small
       stagger (50ms) to avoid hammering the endpoint. */
    batch.forEach(function (payload, i) {
      setTimeout(function () {
        try {
          fetch(REMOTE_ENDPOINT, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
          }).catch(function () {
            /* Network error — silently fail; localStorage has the data */
          });
        } catch (e) {
          /* fetch not available — silently fail */
        }
      }, i * 50);
    });
  }

  /* Flush on page unload so edits aren't lost */
  function flushOnUnload() {
    if (!pendingBatch.length || !REMOTE_ENDPOINT) return;

    /* sendBeacon is fire-and-forget and survives page close.
       Falls back to synchronous flush if sendBeacon unavailable. */
    pendingBatch.forEach(function (payload) {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            REMOTE_ENDPOINT,
            new Blob([JSON.stringify(payload)], { type: 'text/plain' })
          );
        }
      } catch (e) { /* ignore */ }
    });
    pendingBatch = [];
  }

  /* Register unload listeners (both for maximum browser coverage) */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushOnUnload();
  });
  window.addEventListener('pagehide', flushOnUnload);

  /* ---- Edit logging ---- */

  function logEdit(editableKey, lang, before, after) {
    /* Run spam detection */
    var flags = detectSpamFlags(editableKey, lang, before, after);

    var editRecord = {
      key: editableKey,
      lang: lang,
      before: before,
      after: after,
      timestamp: new Date().toISOString(),
      url: window.location.pathname,
      userAgent: navigator.userAgent,
      flags: flags.length ? flags.join(',') : ''
    };

    /* Persist to localStorage */
    var edits = [];
    try {
      edits = JSON.parse(localStorage.getItem(STORAGE_KEY_EDITS)) || [];
    } catch (e) {
      edits = [];
    }
    edits.push(editRecord);
    try {
      localStorage.setItem(STORAGE_KEY_EDITS, JSON.stringify(edits));
    } catch (e) {
      /* localStorage full — silently fail */
    }

    /* Queue for remote logging (batched) */
    queueForRemote(editRecord);
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
    /* No pencil on English — source text is not editable */
    if (isSourceLang()) return;
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
    /* Block editing when viewing the English source text */
    if (isSourceLang()) return;

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
    /* Bail out entirely when translation UI is disabled */
    if (document.documentElement.classList.contains('i18n-disabled')) return;

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

      // Stash multiline flag before potential suppression
      if (el.hasAttribute('data-editable-multiline')) {
        el.setAttribute('data-editable-multiline-stash', '');
      }

      // Set the hover hint (desktop only — hidden by CSS on touch)
      // No hint when viewing English source text
      if (lang === 'en') {
        el.removeAttribute('data-edit-hint');
      } else {
        el.setAttribute('data-edit-hint', HINT_I18N[lang] || DOUBLE_CLICK_HINT);
      }

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

    /* Suppress editable hover affordance when viewing English source.
       This removes data-editable entirely so editable.css selectors
       cannot match — no dashed underline, no tooltip, no cursor change.
       Belt-and-suspenders: re-suppress after current task queue clears
       (catches race conditions with other DOMContentLoaded handlers)
       and again on window load (catches late-running scripts).
       Reference: https://github.com/whatwg/dom/issues/520 */
    if (lang === 'en') {
      suppressEditableForEnglish();
      requestAnimationFrame(function () {
        if (getCurrentLang() === 'en') suppressEditableForEnglish();
      });
    }

    /* Final safety net: re-check on window load in case any script
       between DOMContentLoaded and load re-adds data-editable. */
    window.addEventListener('load', function () {
      if (getCurrentLang() === 'en') suppressEditableForEnglish();
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
      if (e.target.closest && (e.target.closest('[data-editable]') || e.target.closest('[data-editable-key]'))) return;
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
    var lang = getCurrentLang();

    /* When switching TO English, suppress editable affordance.
       When switching FROM English, restore it first. */
    if (lang === 'en') {
      suppressEditableForEnglish();
    } else {
      restoreEditableForTranslation(lang);
    }

    /* Query both selectors to cover elements in either state */
    var elements = document.querySelectorAll('[data-editable], [data-editable-key]');

    elements.forEach(function (el) {
      var key = el.getAttribute('data-editable') || el.getAttribute('data-editable-key');

      // No hint when viewing English source text
      if (lang === 'en') {
        el.removeAttribute('data-edit-hint');
      } else {
        el.setAttribute('data-edit-hint', HINT_I18N[lang] || DOUBLE_CLICK_HINT);
      }

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

    document.querySelectorAll('[data-editable], [data-editable-key]').forEach(function (el) {
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
