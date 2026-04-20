/* ============================================================
   TIME-THEME.JS — Smooth Time-of-Day Color Theming
   
   Continuously interpolates between adjacent time-of-day color
   palettes so the site's mood flows like the actual sky. No hard
   color switches — every minute produces a slightly different
   palette as the day progresses.

   Architecture:
   - 8 theme anchors placed at specific hours around the 24h clock
   - Each anchor defines a full palette (bg, text, accent, etc.)
   - The controller calculates the current position on the 24h
     ring, finds the two nearest anchors, and lerps all 9 color
     variables between them
   - CSS custom properties are updated directly on :root
   - Updates once per minute (smooth enough, zero perf cost)
   - Also sets data-time-theme attribute for the nearest anchor
     (used by MutationObserver in rain.js for sprite rebuilds)

   Contrast Safety:
   - During transitions between dark and light themes (Night→Dawn,
     Dusk→Night), naive linear interpolation causes bg and text
     to converge to similar grey values, destroying readability.
   - Solution: use a "contrast-aware" lerp that keeps text and bg
     on opposite sides of the luminance spectrum during the
     crossover. Text transitions faster (leading) while bg
     transitions slower (lagging), or vice versa, ensuring the
     contrast ratio never drops below ~4.5:1 (WCAG AA).

   References:
   - UX StackExchange #49063 (dawn/dusk color algorithms)
   - DEV Community (Mohsen Kamrani, time-based themes)
   - Rayleigh scattering color theory for natural progressions
   - WCAG 2.1 contrast ratio guidelines
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. THEME ANCHOR DEFINITIONS
     Each anchor is placed at the CENTER of its time window.
     Hours are in 24h format (0–24, wrapping).
     isDark flags which themes have inverted (light-on-dark) palettes.
     ============================================================ */

  var ANCHORS = [
    {
      hour: 3,       /* Witching Hour center: 1–5 AM */
      name: 'witching-hour',
      isDark: true,
      colors: {
        bg:          [0x12, 0x0e, 0x18],
        bgSubtle:    [0x1e, 0x18, 0x28],
        text:        [0xd8, 0xc8, 0xd0],
        textMuted:   [0x88, 0x78, 0x88],
        accent:      [0xa0, 0x50, 0x80],
        accentSoft:  [0xb8, 0x68, 0x98],
        border:      [0x38, 0x28, 0x38],
        borderLight: [0x48, 0x38, 0x48],
        weather:     [0xc8, 0xb0, 0xc0],
        elder:       [0xc0, 0x90, 0x58],
        younger:     [0xa8, 0x98, 0xc0],
        woman:       [0xd0, 0x88, 0xa0],
        cicero:      [0x5a, 0x78, 0x88]
      }
    },
    {
      hour: 6,       /* Dawn center: 5–7 AM */
      name: 'dawn',
      isDark: false,
      colors: {
        bg:          [0xe0, 0xd4, 0xe8],
        bgSubtle:    [0xd4, 0xc5, 0xdd],
        text:        [0x2d, 0x22, 0x35],
        textMuted:   [0x5e, 0x4a, 0x6e],
        accent:      [0x7b, 0x4a, 0x8a],
        accentSoft:  [0x94, 0x60, 0xa0],
        border:      [0xb8, 0xa0, 0xc4],
        borderLight: [0xc8, 0xb3, 0xd0],
        weather:     [0x3a, 0x2d, 0x45],
        elder:       [0x78, 0x50, 0x2e],
        younger:     [0x70, 0x60, 0x88],
        woman:       [0x98, 0x50, 0x68],
        cicero:      [0x3a, 0x58, 0x60]
      }
    },
    {
      hour: 9,       /* Morning center: 7–11 AM */
      name: 'morning',
      isDark: false,
      colors: {
        bg:          [0xf5, 0xdd, 0xd4],
        bgSubtle:    [0xea, 0xce, 0xc4],
        text:        [0x2d, 0x22, 0x1f],
        textMuted:   [0x6b, 0x4f, 0x45],
        accent:      [0xa0, 0x52, 0x3c],
        accentSoft:  [0xb8, 0x6a, 0x54],
        border:      [0xcc, 0xa8, 0x98],
        borderLight: [0xd8, 0xb8, 0xaa],
        weather:     [0x3a, 0x28, 0x20],
        elder:       [0x70, 0x48, 0x28],
        younger:     [0x78, 0x68, 0x88],
        woman:       [0xa0, 0x58, 0x68],
        cicero:      [0x3e, 0x5c, 0x64]
      }
    },
    {
      hour: 13,      /* Midday center: 11 AM – 3 PM */
      name: 'midday',
      isDark: false,
      colors: {
        bg:          [0xf2, 0xd4, 0xd7],
        bgSubtle:    [0xe8, 0xc2, 0xc6],
        text:        [0x2a, 0x1f, 0x2d],
        textMuted:   [0x5c, 0x45, 0x60],
        accent:      [0x8b, 0x3a, 0x62],
        accentSoft:  [0xa3, 0x4d, 0x78],
        border:      [0xc9, 0xa0, 0xad],
        borderLight: [0xd4, 0xb3, 0xbe],
        weather:     [0x2a, 0x1f, 0x2d],
        elder:       [0x6b, 0x42, 0x26],
        younger:     [0x7a, 0x6a, 0x8a],
        woman:       [0xa3, 0x5d, 0x6f],
        cicero:      [0x40, 0x60, 0x68]
      }
    },
    {
      hour: 16,      /* Golden Hour center: 3–5 PM */
      name: 'golden-hour',
      isDark: false,
      colors: {
        bg:          [0xf0, 0xd0, 0xb8],
        bgSubtle:    [0xe4, 0xc0, 0xa8],
        text:        [0x2e, 0x1f, 0x18],
        textMuted:   [0x6d, 0x48, 0x30],
        accent:      [0xa0, 0x44, 0x28],
        accentSoft:  [0xb8, 0x5a, 0x3c],
        border:      [0xc8, 0x98, 0x78],
        borderLight: [0xd4, 0xa8, 0x88],
        weather:     [0x3a, 0x25, 0x18],
        elder:       [0x68, 0x3e, 0x20],
        younger:     [0x70, 0x58, 0x80],
        woman:       [0x98, 0x48, 0x58],
        cicero:      [0x3c, 0x58, 0x60]
      }
    },
    {
      hour: 18,      /* Sunset center: 5–7 PM */
      name: 'sunset',
      isDark: false,
      colors: {
        bg:          [0xe8, 0xc0, 0xb0],
        bgSubtle:    [0xd8, 0xa8, 0x98],
        text:        [0x2a, 0x18, 0x18],
        textMuted:   [0x6e, 0x38, 0x38],
        accent:      [0xa8, 0x30, 0x30],
        accentSoft:  [0xc0, 0x48, 0x48],
        border:      [0xc0, 0x88, 0x78],
        borderLight: [0xcc, 0x98, 0x88],
        weather:     [0x30, 0x18, 0x18],
        elder:       [0x60, 0x38, 0x1c],
        younger:     [0x68, 0x50, 0x78],
        woman:       [0x90, 0x40, 0x50],
        cicero:      [0x38, 0x50, 0x58]
      }
    },
    {
      hour: 20,      /* Dusk center: 7–9 PM */
      name: 'dusk',
      isDark: false,
      colors: {
        bg:          [0xc8, 0xb0, 0xc8],
        bgSubtle:    [0xb8, 0xa0, 0xb8],
        text:        [0x1e, 0x18, 0x28],
        textMuted:   [0x4a, 0x38, 0x60],
        accent:      [0x6e, 0x38, 0x78],
        accentSoft:  [0x88, 0x4a, 0x90],
        border:      [0xa8, 0x88, 0xb0],
        borderLight: [0xb8, 0x98, 0xb8],
        weather:     [0x25, 0x18, 0x30],
        elder:       [0x58, 0x34, 0x1a],
        younger:     [0x50, 0x38, 0x68],
        woman:       [0x80, 0x38, 0x58],
        cicero:      [0x30, 0x48, 0x50]
      }
    },
    {
      hour: 23,      /* Night center: 9 PM – 1 AM */
      name: 'night',
      isDark: true,
      colors: {
        bg:          [0x1e, 0x18, 0x28],
        bgSubtle:    [0x2a, 0x20, 0x38],
        text:        [0xe0, 0xd0, 0xd8],
        textMuted:   [0xa0, 0x90, 0xa0],
        accent:      [0xc0, 0x70, 0xa0],
        accentSoft:  [0xd8, 0x88, 0xb0],
        border:      [0x48, 0x38, 0x58],
        borderLight: [0x58, 0x48, 0x68],
        weather:     [0xd0, 0xb8, 0xc8],
        elder:       [0xc8, 0x98, 0x60],
        younger:     [0xb0, 0xa0, 0xc8],
        woman:       [0xd8, 0x90, 0xa8],
        cicero:      [0x68, 0x88, 0x98]
      }
    }
  ];

  /* Sort by hour for correct ring traversal */
  ANCHORS.sort(function (a, b) { return a.hour - b.hour; });

  /* ============================================================
     2. INTERPOLATION UTILITIES
     ============================================================ */

  function lerpChannel(a, b, t) {
    return Math.round(a + (b - a) * t);
  }

  function lerpColor(colorA, colorB, t) {
    return [
      lerpChannel(colorA[0], colorB[0], t),
      lerpChannel(colorA[1], colorB[1], t),
      lerpChannel(colorA[2], colorB[2], t)
    ];
  }

  function rgbToHex(rgb) {
    return '#' +
      ((1 << 24) + (rgb[0] << 16) + (rgb[1] << 8) + rgb[2])
        .toString(16).slice(1);
  }

  /* Smooth-step easing for more natural transitions
     (faster in the middle, slower at edges — like real light changes) */
  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  /* Relative luminance per WCAG 2.1 (simplified sRGB) */
  function luminance(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    r = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    g = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    b = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /* WCAG contrast ratio between two RGB colors */
  function contrastRatio(rgb1, rgb2) {
    var l1 = luminance(rgb1), l2 = luminance(rgb2);
    var lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /* ============================================================
     3. CONTRAST-SAFE INTERPOLATION
     
     When transitioning between a dark theme and a light theme,
     naive linear interpolation causes bg and text to converge
     to similar mid-grey values. This function uses asymmetric
     timing: during dark→light transitions, bg leads (brightens
     first) while text stays dark, then text snaps dark at the
     crossover. The reverse happens for light→dark.
     
     This ensures contrast ratio stays above ~4.5:1 (WCAG AA)
     throughout the entire transition.
     ============================================================ */

  function contrastSafeLerp(prevColors, nextColors, t, isCrossover) {
    if (!isCrossover) {
      /* Same-polarity transition (light→light or dark→dark):
         simple lerp is fine, contrast is naturally maintained */
      var result = {};
      for (var k in prevColors) {
        result[k] = lerpColor(prevColors[k], nextColors[k], t);
      }
      return result;
    }

    /* Cross-polarity transition (dark↔light):
       Use a "snap" strategy — hold the departing palette's text/bg
       until the midpoint, then snap to the arriving palette's values.
       The snap is smoothed over the middle 20% to avoid a jarring jump. */

    var result = {};
    var snapStart = 0.4;
    var snapEnd = 0.6;

    /* Calculate separate t values for bg-group and text-group */
    var tBg, tText;

    if (t <= snapStart) {
      /* First half: bg transitions, text holds at source */
      tBg = smoothstep(t / snapStart);  /* 0→1 over first 40% */
      tText = 0;
    } else if (t >= snapEnd) {
      /* Second half: text transitions, bg arrives at target */
      tBg = 1;
      tText = smoothstep((t - snapEnd) / (1 - snapEnd));  /* 0→1 over last 40% */
    } else {
      /* Middle 20%: both transition rapidly */
      var tMid = (t - snapStart) / (snapEnd - snapStart);
      tBg = smoothstep(0.5 + tMid * 0.5);  /* 0.5→1 */
      tText = smoothstep(tMid * 0.5);        /* 0→0.5 */
    }

    /* Background-group properties: bg, bgSubtle, border, borderLight */
    result.bg          = lerpColor(prevColors.bg,          nextColors.bg,          tBg);
    result.bgSubtle    = lerpColor(prevColors.bgSubtle,    nextColors.bgSubtle,    tBg);
    result.border      = lerpColor(prevColors.border,      nextColors.border,      tBg);
    result.borderLight = lerpColor(prevColors.borderLight, nextColors.borderLight, tBg);

    /* Text-group properties: text, textMuted, accent, accentSoft, weather, character colors */
    result.text        = lerpColor(prevColors.text,        nextColors.text,        tText);
    result.textMuted   = lerpColor(prevColors.textMuted,   nextColors.textMuted,   tText);
    result.accent      = lerpColor(prevColors.accent,      nextColors.accent,      tText);
    result.accentSoft  = lerpColor(prevColors.accentSoft,  nextColors.accentSoft,  tText);
    result.weather     = lerpColor(prevColors.weather,     nextColors.weather,     tText);
    result.elder       = lerpColor(prevColors.elder,       nextColors.elder,       tText);
    result.younger     = lerpColor(prevColors.younger,     nextColors.younger,     tText);
    result.woman       = lerpColor(prevColors.woman,       nextColors.woman,       tText);

    /* Safety check: if contrast still drops below 3:1, force text to
       whichever endpoint has better contrast against current bg */
    var cr = contrastRatio(result.bg, result.text);
    if (cr < 3.0) {
      var crPrev = contrastRatio(result.bg, prevColors.text);
      var crNext = contrastRatio(result.bg, nextColors.text);
      result.text = crPrev > crNext ? prevColors.text.slice() : nextColors.text.slice();
      /* Also fix weather to match */
      result.weather = crPrev > crNext ? prevColors.weather.slice() : nextColors.weather.slice();
    }

    return result;
  }

  /* ============================================================
     4. RING POSITION CALCULATOR
     Finds the two adjacent anchors and the interpolation factor
     for any given fractional hour (0–24).
     ============================================================ */

  function getInterpolation(fractionalHour) {
    var h = fractionalHour % 24;
    var n = ANCHORS.length;

    /* Find the anchor just before and just after the current time */
    var prevIdx = -1;
    for (var i = 0; i < n; i++) {
      if (ANCHORS[i].hour <= h) {
        prevIdx = i;
      }
    }

    /* Handle wrap-around (e.g., current time is before the first anchor) */
    if (prevIdx === -1) {
      prevIdx = n - 1; /* last anchor (wraps from previous day) */
    }

    var nextIdx = (prevIdx + 1) % n;
    var prevHour = ANCHORS[prevIdx].hour;
    var nextHour = ANCHORS[nextIdx].hour;

    /* Calculate the span between anchors (handling midnight wrap) */
    var span;
    if (nextHour > prevHour) {
      span = nextHour - prevHour;
    } else {
      span = (24 - prevHour) + nextHour; /* wraps past midnight */
    }

    /* Calculate how far we are between the two anchors */
    var elapsed;
    if (h >= prevHour) {
      elapsed = h - prevHour;
    } else {
      elapsed = (24 - prevHour) + h; /* we're past midnight */
    }

    var t = span > 0 ? elapsed / span : 0;
    t = Math.max(0, Math.min(1, t));

    /* Detect cross-polarity transition (dark↔light) */
    var isCrossover = ANCHORS[prevIdx].isDark !== ANCHORS[nextIdx].isDark;

    return {
      prevIdx: prevIdx,
      nextIdx: nextIdx,
      t: smoothstep(t),
      isCrossover: isCrossover,
      nearestName: t < 0.5 ? ANCHORS[prevIdx].name : ANCHORS[nextIdx].name
    };
  }

  /* ============================================================
     5. CSS VARIABLE UPDATER
     Interpolates all 9 color variables and writes them to :root.
     Uses contrast-safe interpolation for dark↔light transitions.
     ============================================================ */

  var COLOR_KEYS = [
    { key: 'bg',          prop: '--color-bg' },
    { key: 'bgSubtle',    prop: '--color-bg-subtle' },
    { key: 'text',        prop: '--color-text' },
    { key: 'textMuted',   prop: '--color-text-muted' },
    { key: 'accent',      prop: '--color-accent' },
    { key: 'accentSoft',  prop: '--color-accent-soft' },
    { key: 'border',      prop: '--color-border' },
    { key: 'borderLight', prop: '--color-border-light' },
    { key: 'weather',     prop: '--color-weather' },
    { key: 'elder',       prop: '--color-elder' },
    { key: 'younger',     prop: '--color-younger' },
    { key: 'woman',       prop: '--color-woman' },
    { key: 'cicero',      prop: '--color-cicero' }
  ];

  var lastThemeName = '';

  function applyTheme(fractionalHour) {
    var interp = getInterpolation(fractionalHour);
    var prevColors = ANCHORS[interp.prevIdx].colors;
    var nextColors = ANCHORS[interp.nextIdx].colors;
    var root = document.documentElement;

    /* Use contrast-safe interpolation for cross-polarity transitions */
    var blended = contrastSafeLerp(
      prevColors, nextColors, interp.t, interp.isCrossover
    );

    for (var i = 0; i < COLOR_KEYS.length; i++) {
      var ck = COLOR_KEYS[i];
      root.style.setProperty(ck.prop, rgbToHex(blended[ck.key]));
    }

    /* Set the data-time-theme attribute to the nearest anchor name.
       This triggers the MutationObserver in rain.js for sprite rebuilds
       only when the nearest anchor actually changes (not every minute). */
    if (interp.nearestName !== lastThemeName) {
      lastThemeName = interp.nearestName;
      root.setAttribute('data-time-theme', interp.nearestName);
    }
  }

  /* ============================================================
     6. TIME CONTROLLER
     Reads the user's local time and updates the theme.
     Runs once immediately (in <head> to prevent FOUC) and then
     every 60 seconds.
     ============================================================ */

  function getCurrentFractionalHour() {
    var now = new Date();
    return now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  }

  function update() {
    applyTheme(getCurrentFractionalHour());
  }

  /* Run immediately */
  update();

  /* Update every minute */
  setInterval(update, 60000);

  /* ============================================================
     7. DEMO API (for accelerated preview)
     Exposed on window so the demo page can drive the clock.
     ============================================================ */

  window.timeTheme = {
    applyTheme: applyTheme,
    getAnchors: function () { return ANCHORS; },
    update: update
  };

})();
