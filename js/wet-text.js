/* ============================================================
   WET-TEXT.JS — Rain-intensity-responsive wet text effect
   Applies an SVG filter chain to the "Cass la Ria" heading that
   makes it appear wet and dripping based on the active weather
   preset's intensity.

   Technique: SVG feTurbulence + feDisplacementMap + feSpecularLighting
   applied via CSS filter: url(#wet-text-filter).

   The effect has these layers:
   1. feTurbulence (fractalNoise) — smooth noise for edge displacement
   2. feDisplacementMap — distorts text edges (water running over them)
   3. feTurbulence (fractalNoise) — finer noise for specular bump map
   4. feSpecularLighting — glossy wet sheen (water catching light)
   5. feComposite — clips highlights to text shape
   6. feBlend (screen) — composites highlights over displaced text

   Rain particles still pass through the text because they live on
   a separate canvas layer (z-index: 0) while the heading is at
   z-index: 2. The SVG filter only affects the text's appearance.

   Sources & references:
   - Sara Soueidan, Codrops: SVG Filter Effects with feTurbulence
     https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/
   - Lucas Bebber, Codrops: Rain & Water Effect Experiments
     https://tympanus.net/codrops/2015/11/04/rain-water-effect-experiments/
   - MDN: feTurbulence, feDisplacementMap, feSpecularLighting
     https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence
   - CSS-Tricks: A Look at SVG Light Source Filters
     https://css-tricks.com/look-svg-light-source-filters/
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
     Tuned via static visual comparison at each intensity level.
     ============================================================ */

  /* feTurbulence #1 — coarse fractalNoise for displacement.
     fractalNoise produces smoother, more organic distortion than turbulence.
     Low X = wide horizontal pattern, higher Y = vertical drip streaks. */
  var TURB1_FREQ_X   = [0.010, 0.018];
  var TURB1_FREQ_Y   = [0.020, 0.070];

  /* feDisplacementMap scale — edge distortion amount.
     Calibrated so text remains readable at all levels.
     Gentle Mist ≈ 0.5, Steady Rain ≈ 2.5, Typhoon ≈ 6. */
  var DISPLACE_SCALE  = [0.0, 6.0];

  /* feTurbulence #2 — finer fractalNoise for specular bump map.
     Creates the water-droplet texture on the text surface. */
  var TURB2_FREQ_X   = [0.020, 0.040];
  var TURB2_FREQ_Y   = [0.035, 0.070];

  /* feSpecularLighting — wet glossy sheen.
     surfaceScale = bump height (how raised the water looks).
     specularConstant = highlight brightness.
     specularExponent = highlight tightness (higher = sharper). */
  var SPEC_SURFACE    = [0.0, 7.0];
  var SPEC_CONSTANT   = [0.0, 0.70];
  var SPEC_EXPONENT   = [25, 12];

  /* fePointLight Z — higher = more dramatic highlights */
  var LIGHT_Z         = [40, 180];

  /* Drip animation — seed changes per second.
     Creates the illusion of water flowing over the text. */
  var DRIP_SPEED      = [0.0, 2.5];

  /* ============================================================
     3. SVG FILTER CREATION
     ============================================================ */

  var svgNS = 'http://www.w3.org/2000/svg';
  var turbulence1El = null;
  var turbulence2El = null;
  var displacementEl = null;
  var specLightingEl = null;
  var pointLightEl = null;

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
    filter.setAttribute('x', '-15%');
    filter.setAttribute('y', '-15%');
    filter.setAttribute('width', '130%');
    filter.setAttribute('height', '140%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');

    /* --- Step 1: Coarse fractalNoise for displacement --- */
    turbulence1El = document.createElementNS(svgNS, 'feTurbulence');
    turbulence1El.setAttribute('type', 'fractalNoise');
    turbulence1El.setAttribute('baseFrequency', '0.010 0.020');
    turbulence1El.setAttribute('numOctaves', '3');
    turbulence1El.setAttribute('seed', '1');
    turbulence1El.setAttribute('stitchTiles', 'stitch');
    turbulence1El.setAttribute('result', 'coarseNoise');

    /* --- Step 2: Displace text edges --- */
    displacementEl = document.createElementNS(svgNS, 'feDisplacementMap');
    displacementEl.setAttribute('in', 'SourceGraphic');
    displacementEl.setAttribute('in2', 'coarseNoise');
    displacementEl.setAttribute('scale', '0');
    displacementEl.setAttribute('xChannelSelector', 'R');
    displacementEl.setAttribute('yChannelSelector', 'G');
    displacementEl.setAttribute('result', 'displaced');

    /* --- Step 3: Fine fractalNoise for specular bump --- */
    turbulence2El = document.createElementNS(svgNS, 'feTurbulence');
    turbulence2El.setAttribute('type', 'fractalNoise');
    turbulence2El.setAttribute('baseFrequency', '0.020 0.035');
    turbulence2El.setAttribute('numOctaves', '3');
    turbulence2El.setAttribute('seed', '42');
    turbulence2El.setAttribute('stitchTiles', 'stitch');
    turbulence2El.setAttribute('result', 'fineNoise');

    /* --- Step 4: Specular lighting (wet sheen) --- */
    specLightingEl = document.createElementNS(svgNS, 'feSpecularLighting');
    specLightingEl.setAttribute('in', 'fineNoise');
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

    /* Assemble filter chain */
    filter.appendChild(turbulence1El);
    filter.appendChild(displacementEl);
    filter.appendChild(turbulence2El);
    filter.appendChild(specLightingEl);
    filter.appendChild(clipComposite);
    filter.appendChild(blend);

    defs.appendChild(filter);
    svg.appendChild(defs);
    document.body.appendChild(svg);
  }

  /* ============================================================
     4. ANIMATION LOOP
     ============================================================ */

  var animId = null;
  var seedAccum = 0;
  var lastSeed = 1;
  var lastTime = 0;
  var currentIntensity = 0;
  var targetIntensity = 0;
  var headingEl = null;
  var filterApplied = false;

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

    /* Below threshold: skip GPU work */
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

    /* --- Update turbulence #1 (displacement source) --- */
    var freq1X = lerpRange(TURB1_FREQ_X, i);
    var freq1Y = lerpRange(TURB1_FREQ_Y, i);
    turbulence1El.setAttribute('baseFrequency', freq1X.toFixed(4) + ' ' + freq1Y.toFixed(4));

    /* Animate seed for flowing drip motion */
    var speed = lerpRange(DRIP_SPEED, i);
    seedAccum += dt * speed;
    var newSeed = Math.floor(seedAccum) + 1;
    if (newSeed !== lastSeed) {
      lastSeed = newSeed;
      /* Pseudo-random seed sequence for organic variation */
      var seedVal = ((newSeed * 7) % 97) + 1;
      turbulence1El.setAttribute('seed', String(seedVal));
      turbulence2El.setAttribute('seed', String(((newSeed * 13) % 89) + 1));
    }

    /* --- Update displacement scale --- */
    var displaceScale = lerpRange(DISPLACE_SCALE, i);
    displacementEl.setAttribute('scale', displaceScale.toFixed(1));

    /* --- Update turbulence #2 (specular bump source) --- */
    var freq2X = lerpRange(TURB2_FREQ_X, i);
    var freq2Y = lerpRange(TURB2_FREQ_Y, i);
    turbulence2El.setAttribute('baseFrequency', freq2X.toFixed(4) + ' ' + freq2Y.toFixed(4));

    /* --- Update specular lighting --- */
    var surfScale = lerpRange(SPEC_SURFACE, i);
    var specConst = lerpRange(SPEC_CONSTANT, i);
    var specExp = lerpRange(SPEC_EXPONENT, i);
    specLightingEl.setAttribute('surfaceScale', surfScale.toFixed(2));
    specLightingEl.setAttribute('specularConstant', specConst.toFixed(3));
    specLightingEl.setAttribute('specularExponent', specExp.toFixed(1));

    /* --- Update light position --- */
    var lightZ = lerpRange(LIGHT_Z, i);
    pointLightEl.setAttribute('z', lightZ.toFixed(0));

    animId = requestAnimationFrame(update);
  }

  /* ============================================================
     5. INITIALISATION
     ============================================================ */

  function init() {
    headingEl = document.getElementById('hero-name');
    if (!headingEl) return;

    /* Respect reduced motion preference */
    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) return;

    createSVGFilter();

    /* GPU compositing hint */
    headingEl.style.willChange = 'filter';

    animId = requestAnimationFrame(update);

    /* Pause when tab is hidden to save CPU/GPU */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else {
        lastTime = 0;
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
