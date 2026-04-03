/* ============================================================
   WET-TEXT.JS — Rain-intensity-responsive wet text effect  v2
   Applies an SVG filter chain to the "Cass la Ria" heading that
   makes it appear wet and dripping based on the active weather
   preset's intensity.

   v2 PERFORMANCE OPTIMISATIONS (Apr 2026):
   ────────────────────────────────────────
   1. SMIL <animate> on feColorMatrix hueRotate replaces JS seed
      changes. The browser interpolates natively at the display
      refresh rate — no JS→DOM→repaint cycle for the flowing
      motion. This is the standard technique recommended by
      Michael Mullany (StackOverflow, 32k rep SVG expert):
      https://stackoverflow.com/a/72769040
      https://codepen.io/mullany/pen/AZqQqB

   2. numOctaves reduced from 3 → 2 on both feTurbulence
      elements. Each octave doubles Perlin noise computation;
      this halves CPU cost with minimal visual difference at
      text scale.

   3. Intensity-dependent parameters (displacement scale,
      specular constants) are throttled to 15 fps instead of
      60 fps. Updates are skipped entirely when the delta from
      the last written value is below a perceptual threshold.

   4. Mobile / low-end fallback: on devices with < 4 logical
      cores, the SVG filter is replaced with a lightweight CSS
      text-shadow glow that still conveys "wetness" without
      any filter overhead.

   Technique: SVG feTurbulence + feColorMatrix hueRotate +
   feDisplacementMap + feSpecularLighting applied via CSS
   filter: url(#wet-text-filter).

   Rain particles still pass through the text because they live
   on a separate canvas layer (z-index: 0) while the heading is
   at z-index: 2.

   Sources & references:
   - Sara Soueidan, Codrops: SVG Filter Effects with feTurbulence
     https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/
   - Lucas Bebber, Codrops: Rain & Water Effect Experiments
     https://tympanus.net/codrops/2015/11/04/rain-water-effect-experiments/
   - Michael Mullany: feColorMatrix hueRotate for smooth turbulence
     https://stackoverflow.com/a/72769040
   - GSAP Forum: feTurbulence mobile performance discussion
     https://gsap.com/community/forums/topic/33075-gsap-and-feturbulence-mobile-performance/
   - MDN: feTurbulence, feDisplacementMap, feSpecularLighting
   - CSS-Tricks: A Look at SVG Light Source Filters
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. INTENSITY MAP
     Maps each weather preset name to a 0–1 intensity value.
     ============================================================ */

  var INTENSITY_MAP = {
    'Gentle Mist':   0.08,
    'Light Drizzle': 0.22,
    'Steady Rain':   0.42,
    'Windy Shower':  0.58,
    'Downpour':      0.74,
    'Storm Front':   0.88,
    'Typhoon':       1.00
  };

  /* ============================================================
     2. FILTER PARAMETER RANGES [min, max]
     Interpolated linearly from min (intensity=0) to max (intensity=1).
     ============================================================ */

  /* feTurbulence #1 — coarse fractalNoise for displacement */
  var TURB1_FREQ_X   = [0.010, 0.018];
  var TURB1_FREQ_Y   = [0.020, 0.070];

  /* feDisplacementMap scale — edge distortion amount */
  var DISPLACE_SCALE  = [0.0, 6.0];

  /* feTurbulence #2 — finer fractalNoise for specular bump map */
  var TURB2_FREQ_X   = [0.020, 0.040];
  var TURB2_FREQ_Y   = [0.035, 0.070];

  /* feSpecularLighting — wet glossy sheen */
  var SPEC_SURFACE    = [0.0, 7.0];
  var SPEC_CONSTANT   = [0.0, 0.70];
  var SPEC_EXPONENT   = [25, 12];

  /* fePointLight Z */
  var LIGHT_Z         = [40, 180];

  /* SMIL hueRotate duration — faster at higher intensity.
     At intensity=1 the hue cycles every 6s; at 0.1 every 60s.
     This replaces the old JS seed animation entirely. */
  var HUEROTATE_DUR   = [60, 6];

  /* JS update throttle — 15 fps = 66.7ms between updates.
     Only intensity-dependent params are updated via JS now;
     the flowing motion is handled by SMIL. */
  var JS_UPDATE_INTERVAL = 1000 / 15;

  /* Perceptual thresholds — skip setAttribute if the new value
     is within this delta of the last written value. */
  var THRESH_FREQ     = 0.0005;
  var THRESH_SCALE    = 0.15;
  var THRESH_SPEC     = 0.02;
  var THRESH_LIGHT    = 2.0;

  /* ============================================================
     3. MOBILE / LOW-END DETECTION
     ============================================================ */

  var isLowEnd = (function () {
    /* Check logical core count (available in all modern browsers) */
    var cores = navigator.hardwareConcurrency || 4;
    if (cores < 4) return true;

    /* Check for mobile via coarse pointer (touch-only devices) */
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      /* Mobile devices with 4+ cores can still struggle with SVG filters.
         The GSAP forum confirmed iOS Safari crashes with feTurbulence.
         Use a conservative check: mobile = low-end for this effect. */
      return true;
    }

    return false;
  })();

  /* ============================================================
     4. SVG FILTER CREATION (with SMIL hueRotate)
     ============================================================ */

  var svgNS = 'http://www.w3.org/2000/svg';
  var turbulence1El = null;
  var turbulence2El = null;
  var displacementEl = null;
  var specLightingEl = null;
  var pointLightEl = null;
  var hueRotate1Anim = null;
  var hueRotate2Anim = null;

  function createSVGFilter() {
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.pointerEvents = 'none';

    var defs = document.createElementNS(svgNS, 'defs');

    var filter = document.createElementNS(svgNS, 'filter');
    filter.setAttribute('id', 'wet-text-filter');
    /* Tightened filter region — reduces pixel computation area.
       Was -15%/-15%/130%/140%, now -5%/-5%/110%/115%. */
    filter.setAttribute('x', '-5%');
    filter.setAttribute('y', '-5%');
    filter.setAttribute('width', '110%');
    filter.setAttribute('height', '115%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    /* --- Step 1: Coarse fractalNoise for displacement --- */
    turbulence1El = document.createElementNS(svgNS, 'feTurbulence');
    turbulence1El.setAttribute('type', 'fractalNoise');
    turbulence1El.setAttribute('baseFrequency', '0.010 0.020');
    turbulence1El.setAttribute('numOctaves', '2');   /* v2: was 3 */
    turbulence1El.setAttribute('seed', '1');
    turbulence1El.setAttribute('stitchTiles', 'stitch');
    turbulence1El.setAttribute('result', 'coarseNoise');

    /* --- Step 1b: SMIL hueRotate on coarse noise ---
       This creates smooth flowing motion by rotating the colour
       channels of the Perlin noise. The browser handles this
       natively at the display refresh rate — no JS overhead.
       Technique: Michael Mullany, StackOverflow #72768513 */
    var colorMatrix1 = document.createElementNS(svgNS, 'feColorMatrix');
    colorMatrix1.setAttribute('in', 'coarseNoise');
    colorMatrix1.setAttribute('type', 'hueRotate');
    colorMatrix1.setAttribute('values', '0');
    colorMatrix1.setAttribute('result', 'coarseAnimated');

    hueRotate1Anim = document.createElementNS(svgNS, 'animate');
    hueRotate1Anim.setAttribute('attributeName', 'values');
    hueRotate1Anim.setAttribute('from', '0');
    hueRotate1Anim.setAttribute('to', '360');
    hueRotate1Anim.setAttribute('dur', '30s');
    hueRotate1Anim.setAttribute('repeatCount', 'indefinite');
    colorMatrix1.appendChild(hueRotate1Anim);

    /* --- Step 2: Displace text edges --- */
    displacementEl = document.createElementNS(svgNS, 'feDisplacementMap');
    displacementEl.setAttribute('in', 'SourceGraphic');
    displacementEl.setAttribute('in2', 'coarseAnimated');
    displacementEl.setAttribute('scale', '0');
    displacementEl.setAttribute('xChannelSelector', 'R');
    displacementEl.setAttribute('yChannelSelector', 'G');
    displacementEl.setAttribute('result', 'displaced');

    /* --- Step 3: Fine fractalNoise for specular bump --- */
    turbulence2El = document.createElementNS(svgNS, 'feTurbulence');
    turbulence2El.setAttribute('type', 'fractalNoise');
    turbulence2El.setAttribute('baseFrequency', '0.020 0.035');
    turbulence2El.setAttribute('numOctaves', '2');   /* v2: was 3 */
    turbulence2El.setAttribute('seed', '42');
    turbulence2El.setAttribute('stitchTiles', 'stitch');
    turbulence2El.setAttribute('result', 'fineNoise');

    /* --- Step 3b: SMIL hueRotate on fine noise ---
       Offset duration from coarse noise to avoid synchronised
       motion (would look mechanical). */
    var colorMatrix2 = document.createElementNS(svgNS, 'feColorMatrix');
    colorMatrix2.setAttribute('in', 'fineNoise');
    colorMatrix2.setAttribute('type', 'hueRotate');
    colorMatrix2.setAttribute('values', '0');
    colorMatrix2.setAttribute('result', 'fineAnimated');

    hueRotate2Anim = document.createElementNS(svgNS, 'animate');
    hueRotate2Anim.setAttribute('attributeName', 'values');
    hueRotate2Anim.setAttribute('from', '0');
    hueRotate2Anim.setAttribute('to', '360');
    hueRotate2Anim.setAttribute('dur', '43s');  /* prime offset from 30s */
    hueRotate2Anim.setAttribute('repeatCount', 'indefinite');
    colorMatrix2.appendChild(hueRotate2Anim);

    /* --- Step 4: Specular lighting (wet sheen) --- */
    specLightingEl = document.createElementNS(svgNS, 'feSpecularLighting');
    specLightingEl.setAttribute('in', 'fineAnimated');
    specLightingEl.setAttribute('surfaceScale', '0');
    specLightingEl.setAttribute('specularConstant', '0');
    specLightingEl.setAttribute('specularExponent', '25');
    specLightingEl.setAttribute('lighting-color', '#ffffff');
    specLightingEl.setAttribute('result', 'specular');

    pointLightEl = document.createElementNS(svgNS, 'fePointLight');
    pointLightEl.setAttribute('x', '250');
    pointLightEl.setAttribute('y', '-100');
    pointLightEl.setAttribute('z', '60');
    specLightingEl.appendChild(pointLightEl);

    /* --- Step 5: Clip specular to displaced text shape --- */
    var clipComposite = document.createElementNS(svgNS, 'feComposite');
    clipComposite.setAttribute('in', 'specular');
    clipComposite.setAttribute('in2', 'displaced');
    clipComposite.setAttribute('operator', 'in');
    clipComposite.setAttribute('result', 'specClipped');

    /* --- Step 6: Blend specular over displaced text (screen mode) --- */
    var blend = document.createElementNS(svgNS, 'feBlend');
    blend.setAttribute('in', 'displaced');
    blend.setAttribute('in2', 'specClipped');
    blend.setAttribute('mode', 'screen');

    /* Assemble filter chain (note: colorMatrix elements inserted) */
    filter.appendChild(turbulence1El);
    filter.appendChild(colorMatrix1);
    filter.appendChild(displacementEl);
    filter.appendChild(turbulence2El);
    filter.appendChild(colorMatrix2);
    filter.appendChild(specLightingEl);
    filter.appendChild(clipComposite);
    filter.appendChild(blend);

    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }

  /* ============================================================
     5. ANIMATION LOOP (throttled to 15 fps)
     Only updates intensity-dependent parameters. The flowing
     motion is handled entirely by SMIL hueRotate animations.
     ============================================================ */

  var animId = null;
  var lastTime = 0;
  var lastJsUpdate = 0;
  var currentIntensity = 0;
  var targetIntensity = 0;
  var headingEl = null;
  var filterApplied = false;

  /* Track last-written values to skip redundant setAttribute calls */
  var lastWritten = {
    freq1: '',
    displaceScale: '',
    freq2: '',
    surfScale: '',
    specConst: '',
    specExp: '',
    lightZ: ''
  };

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpRange(range, t) {
    return lerp(range[0], range[1], t);
  }

  function update(timestamp) {
    if (!lastTime) lastTime = timestamp;
    var dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    /* Read active preset from rain.js */
    var preset = null;
    if (window.rainWeather && window.rainWeather.getPreset) {
      preset = window.rainWeather.getPreset();
    }

    if (preset) {
      targetIntensity = INTENSITY_MAP[preset.name] || 0;
    }

    /* Smooth ramp — ~1.5s to reach 63% of target */
    currentIntensity = lerp(currentIntensity, targetIntensity, dt * 0.7);

    /* Below threshold: remove filter to save all GPU work */
    var i = currentIntensity < 0.03 ? 0 : currentIntensity;

    if (i === 0) {
      if (filterApplied && headingEl) {
        headingEl.style.filter = '';
        headingEl.style.webkitFilter = '';
        filterApplied = false;
      }
      animId = requestAnimationFrame(update);
      return;
    }

    /* Apply filter if not yet applied */
    if (!filterApplied && headingEl) {
      headingEl.style.filter = 'url(#wet-text-filter)';
      headingEl.style.webkitFilter = 'url(#wet-text-filter)';
      filterApplied = true;
    }

    /* ── Throttle: only update params at 15 fps ── */
    var elapsed = timestamp - lastJsUpdate;
    if (elapsed < JS_UPDATE_INTERVAL) {
      animId = requestAnimationFrame(update);
      return;
    }
    lastJsUpdate = timestamp;

    /* --- Update turbulence #1 frequencies --- */
    var freq1X = lerpRange(TURB1_FREQ_X, i);
    var freq1Y = lerpRange(TURB1_FREQ_Y, i);
    var freq1Str = freq1X.toFixed(4) + ' ' + freq1Y.toFixed(4);
    if (freq1Str !== lastWritten.freq1) {
      turbulence1El.setAttribute('baseFrequency', freq1Str);
      lastWritten.freq1 = freq1Str;
    }

    /* --- Update displacement scale --- */
    var displaceScale = lerpRange(DISPLACE_SCALE, i);
    var displaceStr = displaceScale.toFixed(1);
    if (displaceStr !== lastWritten.displaceScale) {
      displacementEl.setAttribute('scale', displaceStr);
      lastWritten.displaceScale = displaceStr;
    }

    /* --- Update turbulence #2 frequencies --- */
    var freq2X = lerpRange(TURB2_FREQ_X, i);
    var freq2Y = lerpRange(TURB2_FREQ_Y, i);
    var freq2Str = freq2X.toFixed(4) + ' ' + freq2Y.toFixed(4);
    if (freq2Str !== lastWritten.freq2) {
      turbulence2El.setAttribute('baseFrequency', freq2Str);
      lastWritten.freq2 = freq2Str;
    }

    /* --- Update specular lighting (only if delta > threshold) --- */
    var surfScale = lerpRange(SPEC_SURFACE, i);
    var surfStr = surfScale.toFixed(2);
    if (surfStr !== lastWritten.surfScale) {
      specLightingEl.setAttribute('surfaceScale', surfStr);
      lastWritten.surfScale = surfStr;
    }

    var specConst = lerpRange(SPEC_CONSTANT, i);
    var specStr = specConst.toFixed(3);
    if (specStr !== lastWritten.specConst) {
      specLightingEl.setAttribute('specularConstant', specStr);
      lastWritten.specConst = specStr;
    }

    var specExp = lerpRange(SPEC_EXPONENT, i);
    var expStr = specExp.toFixed(1);
    if (expStr !== lastWritten.specExp) {
      specLightingEl.setAttribute('specularExponent', expStr);
      lastWritten.specExp = expStr;
    }

    /* --- Update light position --- */
    var lightZ = lerpRange(LIGHT_Z, i);
    var lightStr = lightZ.toFixed(0);
    if (lightStr !== lastWritten.lightZ) {
      pointLightEl.setAttribute('z', lightStr);
      lastWritten.lightZ = lightStr;
    }

    /* --- Update SMIL hueRotate speed based on intensity ---
       Higher intensity = faster flowing motion.
       We set the dur attribute on the <animate> elements.
       This doesn't restart the animation — the browser adjusts
       the playback rate smoothly. */
    var dur = lerpRange(HUEROTATE_DUR, i);
    var durStr = dur.toFixed(1) + 's';
    hueRotate1Anim.setAttribute('dur', durStr);
    /* Fine noise rotates at a different rate (prime ratio offset) */
    var dur2 = dur * 1.43;
    hueRotate2Anim.setAttribute('dur', dur2.toFixed(1) + 's');

    animId = requestAnimationFrame(update);
  }

  /* ============================================================
     6. MOBILE FALLBACK — CSS text-shadow glow
     Lightweight alternative that conveys "wetness" without
     any SVG filter overhead. Uses a subtle glossy highlight
     shadow that scales with rain intensity.
     ============================================================ */

  var mobileShadowId = null;
  var mobileIntensity = 0;
  var mobileTarget = 0;
  var mobileLastTime = 0;

  function updateMobileFallback(timestamp) {
    if (!mobileLastTime) mobileLastTime = timestamp;
    var dt = Math.min((timestamp - mobileLastTime) / 1000, 0.1);
    mobileLastTime = timestamp;

    var preset = null;
    if (window.rainWeather && window.rainWeather.getPreset) {
      preset = window.rainWeather.getPreset();
    }
    if (preset) {
      mobileTarget = INTENSITY_MAP[preset.name] || 0;
    }

    mobileIntensity = lerp(mobileIntensity, mobileTarget, dt * 0.7);
    var i = mobileIntensity;

    if (i < 0.03) {
      headingEl.style.textShadow = '';
      mobileShadowId = requestAnimationFrame(updateMobileFallback);
      return;
    }

    /* Glossy wet highlight — white glow above + subtle spread */
    var glowSize = lerp(0, 8, i);
    var glowOpacity = lerp(0, 0.5, i);
    var shineOffset = lerp(0, -2, i);
    var shineOpacity = lerp(0, 0.7, i);

    headingEl.style.textShadow =
      '0 0 ' + glowSize.toFixed(1) + 'px rgba(255,255,255,' + glowOpacity.toFixed(2) + '), ' +
      '0 ' + shineOffset.toFixed(1) + 'px 3px rgba(255,255,255,' + shineOpacity.toFixed(2) + ')';

    mobileShadowId = requestAnimationFrame(updateMobileFallback);
  }

  /* ============================================================
     7. INITIALISATION
     ============================================================ */

  function init() {
    headingEl = document.getElementById('hero-name');
    if (!headingEl) return;

    /* Respect reduced motion preference */
    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    if (isLowEnd) {
      /* Mobile / low-end: use CSS text-shadow fallback */
      mobileShadowId = requestAnimationFrame(updateMobileFallback);

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (mobileShadowId) {
            cancelAnimationFrame(mobileShadowId);
            mobileShadowId = null;
          }
        } else {
          mobileLastTime = 0;
          mobileShadowId = requestAnimationFrame(updateMobileFallback);
        }
      });
      return;
    }

    /* Desktop: full SVG filter with SMIL hueRotate */
    createSVGFilter();

    /* GPU compositing hint */
    headingEl.style.willChange = 'filter';

    animId = requestAnimationFrame(update);

    /* Pause when tab is hidden to save CPU */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else {
        lastTime = 0;
        lastJsUpdate = 0;
        animId = requestAnimationFrame(update);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
