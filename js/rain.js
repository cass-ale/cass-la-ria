/* ============================================================
   RAIN.JS — Procedural Weather System
   Continuous Unicode rain, noise-based clouds, and wind physics.

   Architecture:
   - Simplex noise generates organic cloud shapes in real-time
   - Domain warping (IQ technique) creates realistic cloud forms
   - Clouds merge naturally when noise fields overlap
   - Wind affects clouds (speed, stretch) and rain (angle, drift)
   - Wind gradient: faster at cloud height, slower near ground
   - Rain spawns from cloud base, drifts with wind
   - 7 weather presets randomly selected per visit
   - Umbrella cursor (desktop) / touch deflection (mobile)

   Sources & references:
   - Simplex noise: Stefan Gustavson (2005)
   - Domain warping: Inigo Quilez, iquilezles.org/articles/warp
   - ASCII Clouds: caidan.dev (Caidan Williams, HN 2025)
   - p5.js cloud algorithm: Kyle Geske (stungeye)
   - Rain angle physics: Physics StackExchange #128586
   - Wind gradient / Ekman spiral: Cliff Mass Weather Blog
   - Cloud merging: Westcott 1994, Monthly Weather Review
   - Particle physics: Nature of Code (Daniel Shiffman)
   - Canvas DPI fix: medium.com/wdstack (Coen Warmer)
   - Canvas optimization: MDN Canvas API Tutorial
   - Custom cursor: 14islands.com/journal
   - Weather presets: canvasengine.net/presets/weather
   - Raindrop terminal velocity: ~9 m/s (UArk Physics)
   - Wind-driven rain: Testik 2017, J. Hydrometeorology
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. SIMPLEX NOISE (Stefan Gustavson, optimized for 2D/3D)
     Lightweight implementation — no dependencies.
     ============================================================ */

  var SimplexNoise = (function () {
    var F2 = 0.5 * (Math.sqrt(3) - 1);
    var G2 = (3 - Math.sqrt(3)) / 6;
    var F3 = 1 / 3;
    var G3 = 1 / 6;

    var grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];

    function SN(seed) {
      this.perm = new Uint8Array(512);
      this.permMod12 = new Uint8Array(512);
      var p = new Uint8Array(256);
      for (var i = 0; i < 256; i++) p[i] = i;
      /* Fisher-Yates shuffle with seed */
      seed = seed || Math.random() * 65536;
      if (seed < 1) seed *= 65536;
      seed = ~~seed;
      for (var i = 255; i > 0; i--) {
        seed = (seed * 16807 + 0) % 2147483647;
        var j = seed % (i + 1);
        var tmp = p[i]; p[i] = p[j]; p[j] = tmp;
      }
      for (var i = 0; i < 512; i++) {
        this.perm[i] = p[i & 255];
        this.permMod12[i] = this.perm[i] % 12;
      }
    }

    SN.prototype.noise2D = function (xin, yin) {
      var s = (xin + yin) * F2;
      var i = Math.floor(xin + s);
      var j = Math.floor(yin + s);
      var t = (i + j) * G2;
      var X0 = i - t, Y0 = j - t;
      var x0 = xin - X0, y0 = yin - Y0;
      var i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; }
      else { i1 = 0; j1 = 1; }
      var x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      var x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      var ii = i & 255, jj = j & 255;
      var gi0 = this.permMod12[ii + this.perm[jj]];
      var gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
      var gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
      var n0 = 0, n1 = 0, n2 = 0;
      var t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0); }
      var t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1); }
      var t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2); }
      return 70 * (n0 + n1 + n2);
    };

    SN.prototype.noise3D = function (xin, yin, zin) {
      var s = (xin + yin + zin) * F3;
      var i = Math.floor(xin + s);
      var j = Math.floor(yin + s);
      var k = Math.floor(zin + s);
      var t = (i + j + k) * G3;
      var X0 = i - t, Y0 = j - t, Z0 = k - t;
      var x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;
      var i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
        else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
        else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
      } else {
        if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
        else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
        else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
      }
      var x1=x0-i1+G3, y1=y0-j1+G3, z1=z0-k1+G3;
      var x2=x0-i2+2*G3, y2=y0-j2+2*G3, z2=z0-k2+2*G3;
      var x3=x0-1+3*G3, y3=y0-1+3*G3, z3=z0-1+3*G3;
      var ii=i&255, jj=j&255, kk=k&255;
      var gi0=this.permMod12[ii+this.perm[jj+this.perm[kk]]];
      var gi1=this.permMod12[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]];
      var gi2=this.permMod12[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]];
      var gi3=this.permMod12[ii+1+this.perm[jj+1+this.perm[kk+1]]];
      var n0=0,n1=0,n2=0,n3=0;
      var t0=0.6-x0*x0-y0*y0-z0*z0;
      if(t0>=0){t0*=t0;n0=t0*t0*(grad3[gi0][0]*x0+grad3[gi0][1]*y0+grad3[gi0][2]*z0);}
      var t1=0.6-x1*x1-y1*y1-z1*z1;
      if(t1>=0){t1*=t1;n1=t1*t1*(grad3[gi1][0]*x1+grad3[gi1][1]*y1+grad3[gi1][2]*z1);}
      var t2=0.6-x2*x2-y2*y2-z2*z2;
      if(t2>=0){t2*=t2;n2=t2*t2*(grad3[gi2][0]*x2+grad3[gi2][1]*y2+grad3[gi2][2]*z2);}
      var t3=0.6-x3*x3-y3*y3-z3*z3;
      if(t3>=0){t3*=t3;n3=t3*t3*(grad3[gi3][0]*x3+grad3[gi3][1]*y3+grad3[gi3][2]*z3);}
      return 32*(n0+n1+n2+n3);
    };

    return SN;
  })();

  /* ============================================================
     2. CONFIGURATION
     ============================================================ */

  var RAIN_CHARS = ['1', 'l', '!', 'I', 'i'];

  /* Diverse Unicode character set for clouds — constantly cycling */
  var CLOUD_CHARS_DENSE   = ['\u2588','\u2593','\u2592','#','@','%','&','W','M','N'];
  var CLOUD_CHARS_MEDIUM  = ['0','1','2','3','4','5','6','7','8','9','*','+','=',':','^','~'];
  var CLOUD_CHARS_LIGHT   = ['\u2591','\u00B7','\u2022','\u2801','\u2802','\u2804','.',','];

  /* Umbrella */
  var UMBRELLA_CHAR = '\u2602';
  var UMBRELLA_RADIUS = 55;

  /* Touch */
  var TOUCH_RADIUS = 50;

  /* Performance */
  var MAX_DPI = 2;
  var MAX_DELTA = 50;
  var MOBILE_BREAKPOINT = 768;
  var MOBILE_DROP_FACTOR = 0.5;
  var RESIZE_DEBOUNCE = 200;

  /* Cloud grid — procedural noise sampled on this grid */
  var CLOUD_CELL_SIZE = 12;          /* px per character cell */
  var CLOUD_ZONE_HEIGHT = 0.18;      /* fraction of viewport for cloud zone */
  var CLOUD_MIN_ZONE = 100;          /* minimum cloud zone height in px */

  /* Bottom fade */
  var BOTTOM_FADE_ZONE = 0.15;

  /* ============================================================
     3. CLOUD TYPE DEFINITIONS
     Each type has noise parameters that produce realistic shapes.
     Based on study of 24+ reference images per cloud type.
     ============================================================ */

  var CLOUD_TYPES = {
    cirrus: {
      noiseFreqX: 0.025,     /* high horizontal frequency — wispy */
      noiseFreqY: 0.008,     /* low vertical — thin */
      cutoff: 0.52,          /* high cutoff — sparse */
      warpStrength: 1.5,
      evolutionSpeed: 0.3,
      aspectStretch: 3.0     /* very wide relative to tall */
    },
    stratus: {
      noiseFreqX: 0.015,
      noiseFreqY: 0.006,
      cutoff: 0.38,          /* low cutoff — wide coverage */
      warpStrength: 2.0,
      evolutionSpeed: 0.2,
      aspectStretch: 2.5
    },
    stratocumulus: {
      noiseFreqX: 0.012,
      noiseFreqY: 0.010,
      cutoff: 0.42,
      warpStrength: 2.5,
      evolutionSpeed: 0.25,
      aspectStretch: 1.8
    },
    cumulus: {
      noiseFreqX: 0.008,
      noiseFreqY: 0.009,
      cutoff: 0.45,
      warpStrength: 3.0,
      evolutionSpeed: 0.35,
      aspectStretch: 1.2
    },
    nimbostratus: {
      noiseFreqX: 0.007,
      noiseFreqY: 0.006,
      cutoff: 0.32,          /* very low cutoff — dense, heavy */
      warpStrength: 2.0,
      evolutionSpeed: 0.15,
      aspectStretch: 2.0
    },
    cumulonimbus: {
      noiseFreqX: 0.006,
      noiseFreqY: 0.005,
      cutoff: 0.28,          /* lowest cutoff — massive, dark */
      warpStrength: 3.5,
      evolutionSpeed: 0.2,
      aspectStretch: 1.0
    }
  };

  /* ============================================================
     4. WEATHER PRESETS
     Each preset maps to cloud types, wind behavior, and rain
     intensity. Randomly selected once per page load.
     ============================================================ */

  var WEATHER_PRESETS = {
    gentleMist: {
      name: 'Gentle Mist',
      cloudType: 'cirrus',
      dropCount: 80,
      fallSpeed: 1.2,
      fallSpeedVariance: 0.4,
      windSpeed: 0,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.10,
      rainOpacity: 0.18,
      charSize: 12,
      cloudDriftSpeed: 0.12,
      virga: 0.3               /* 30% of drops fade before bottom */
    },
    lightDrizzle: {
      name: 'Light Drizzle',
      cloudType: 'stratocumulus',
      dropCount: 140,
      fallSpeed: 2.0,
      fallSpeedVariance: 0.6,
      windSpeed: 0.3,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.14,
      rainOpacity: 0.22,
      charSize: 13,
      cloudDriftSpeed: 0.18,
      virga: 0.15
    },
    steadyRain: {
      name: 'Steady Rain',
      cloudType: 'stratus',
      dropCount: 220,
      fallSpeed: 3.0,
      fallSpeedVariance: 0.8,
      windSpeed: 0.6,
      gustEnabled: true,
      gustStrength: 0.4,
      gustFrequency: 0.8,
      cloudOpacity: 0.17,
      rainOpacity: 0.28,
      charSize: 13,
      cloudDriftSpeed: 0.25,
      virga: 0.05
    },
    windyShower: {
      name: 'Windy Shower',
      cloudType: 'cumulus',
      dropCount: 200,
      fallSpeed: 3.5,
      fallSpeedVariance: 1.0,
      windSpeed: 1.8,
      gustEnabled: true,
      gustStrength: 1.0,
      gustFrequency: 1.2,
      cloudOpacity: 0.18,
      rainOpacity: 0.30,
      charSize: 14,
      cloudDriftSpeed: 0.45,
      virga: 0.08
    },
    downpour: {
      name: 'Downpour',
      cloudType: 'nimbostratus',
      dropCount: 350,
      fallSpeed: 4.5,
      fallSpeedVariance: 1.2,
      windSpeed: 0.4,
      gustEnabled: true,
      gustStrength: 0.6,
      gustFrequency: 0.5,
      cloudOpacity: 0.22,
      rainOpacity: 0.35,
      charSize: 14,
      cloudDriftSpeed: 0.20,
      virga: 0.0
    },
    stormFront: {
      name: 'Storm Front',
      cloudType: 'cumulonimbus',
      dropCount: 400,
      fallSpeed: 5.5,
      fallSpeedVariance: 1.5,
      windSpeed: 2.5,
      gustEnabled: true,
      gustStrength: 1.8,
      gustFrequency: 1.5,
      cloudOpacity: 0.25,
      rainOpacity: 0.38,
      charSize: 15,
      cloudDriftSpeed: 0.60,
      virga: 0.0
    },
    typhoon: {
      name: 'Typhoon',
      cloudType: 'cumulonimbus',
      dropCount: 500,
      fallSpeed: 6.5,
      fallSpeedVariance: 2.0,
      windSpeed: 3.5,
      gustEnabled: true,
      gustStrength: 2.5,
      gustFrequency: 2.0,
      cloudOpacity: 0.28,
      rainOpacity: 0.40,
      charSize: 15,
      cloudDriftSpeed: 0.90,
      virga: 0.0
    }
  };

  /* ============================================================
     5. UTILITY FUNCTIONS
     ============================================================ */

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
  }

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
  }

  function smoothstep(edge0, edge1, x) {
    var t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT ||
           ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  }

  /* ============================================================
     6. NOISE-BASED CLOUD FIELD
     Uses simplex noise with domain warping (IQ technique) to
     generate organic, realistic cloud shapes that morph over time.
     ============================================================ */

  var noise = new SimplexNoise(Math.random() * 65536);

  /* Fractional Brownian Motion — layered noise for detail */
  function fbm(x, y, octaves) {
    var value = 0;
    var amplitude = 0.5;
    var frequency = 1;
    for (var i = 0; i < octaves; i++) {
      value += amplitude * noise.noise2D(x * frequency, y * frequency);
      amplitude *= 0.5;
      frequency *= 2;
    }
    return value;
  }

  /* Domain-warped noise (Inigo Quilez, 2002)
     pattern(p) = fbm(p + fbm(p))
     Produces organic, cloud-like shapes. */
  function cloudNoise(x, y, time, cloudType) {
    var ct = CLOUD_TYPES[cloudType];
    var sx = x * ct.noiseFreqX * ct.aspectStretch;
    var sy = y * ct.noiseFreqY;

    /* First warp layer */
    var qx = fbm(sx + time * 0.1, sy + time * 0.05, 3);
    var qy = fbm(sx + 5.2 + time * 0.08, sy + 1.3 + time * 0.04, 3);

    /* Second layer — warp by the warp (domain warping) */
    var warped = fbm(
      sx + ct.warpStrength * qx + time * ct.evolutionSpeed * 0.1,
      sy + ct.warpStrength * qy + time * ct.evolutionSpeed * 0.05,
      4
    );

    return warped;
  }

  /* Map noise value to a cloud character based on density */
  function cloudCharFromDensity(density, cutoff) {
    var normalized = (density - cutoff) / (1.0 - cutoff);
    if (normalized > 0.7) return randomItem(CLOUD_CHARS_DENSE);
    if (normalized > 0.35) return randomItem(CLOUD_CHARS_MEDIUM);
    return randomItem(CLOUD_CHARS_LIGHT);
  }

  /* ============================================================
     7. PRE-RENDERED CHARACTER SPRITES
     Render each rain character to an offscreen canvas once.
     ============================================================ */

  var charSprites = {};
  var spriteReady = false;

  function buildCharSprites(fontSize, color) {
    charSprites = {};
    var chars = RAIN_CHARS;
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      var offscreen = document.createElement('canvas');
      var size = Math.ceil(fontSize * 1.4);
      offscreen.width = size;
      offscreen.height = size;
      var octx = offscreen.getContext('2d');
      octx.font = fontSize + 'px "Cormorant Garamond", Georgia, serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = color;
      octx.fillText(c, size / 2, size / 2);
      charSprites[c] = offscreen;
    }
    spriteReady = true;
  }

  /* ============================================================
     8. RAINDROP OBJECT POOL
     Pre-allocate all drops. Recycle instead of creating new.
     ============================================================ */

  function Raindrop() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.char = '1';
    this.opacity = 0;
    this.active = false;
    this.windFactor = 1;
    this.size = 13;
    this.virgaDrop = false;    /* will this drop fade before bottom? */
    this.virgaFadeY = 0;      /* Y position where virga fade starts */
  }

  Raindrop.prototype.reset = function (x, y, preset) {
    this.x = x;
    this.y = y;
    this.vy = preset.fallSpeed + randomRange(-preset.fallSpeedVariance, preset.fallSpeedVariance);
    this.vx = 0;
    this.char = randomItem(RAIN_CHARS);
    this.opacity = preset.rainOpacity * randomRange(0.6, 1.0);
    this.active = true;
    this.windFactor = randomRange(0.8, 1.2);
    this.size = preset.charSize + randomInt(-1, 1);
    /* Virga: some drops fade early in light presets */
    this.virgaDrop = Math.random() < preset.virga;
    this.virgaFadeY = this.virgaDrop ? randomRange(H * 0.3, H * 0.7) : H;
  };

  /* ============================================================
     9. MAIN ANIMATION CONTROLLER
     ============================================================ */

  var canvas, ctx;
  var cloudCanvas, cloudCtx;   /* offscreen cloud buffer */
  var animId = null;
  var lastTime = 0;
  var running = false;

  /* State */
  var W = 0, H = 0, dpi = 1;
  var drops = [];
  var activePreset = null;
  var activeCloudType = null;
  var currentWind = 0;
  var targetWind = 0;
  var timeAccum = 0;
  var cloudZoneH = 0;

  /* Cloud field cache — regenerated periodically, not every frame */
  var cloudFieldDirty = true;
  var cloudFieldTimer = 0;
  var CLOUD_FIELD_INTERVAL = 80;  /* ms between cloud field updates */

  /* Cloud density map for rain spawning */
  var cloudDensityMap = null;
  var cloudDensityCols = 0;
  var cloudDensityRows = 0;

  /* Interaction state */
  var mouseX = -9999, mouseY = -9999;
  var mouseActive = false;
  var touchPoints = [];
  var umbrellaEl = null;
  var touchRippleEl = null;
  var isDesktop = false;

  /* ---- Select random preset ---- */

  function selectPreset() {
    var keys = Object.keys(WEATHER_PRESETS);
    var key = keys[Math.floor(Math.random() * keys.length)];
    activePreset = WEATHER_PRESETS[key];
    activeCloudType = activePreset.cloudType;

    if (isMobile()) {
      activePreset = Object.assign({}, activePreset);
      activePreset.dropCount = Math.floor(activePreset.dropCount * MOBILE_DROP_FACTOR);
    }

    if (typeof console !== 'undefined') {
      console.log('[Rain] Weather: ' + activePreset.name +
                  ' | Cloud: ' + activeCloudType +
                  ' | Wind: ' + activePreset.windSpeed);
    }
  }

  /* ---- Canvas setup ---- */

  function setupCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'rain-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(canvas, document.body.firstChild);
    }

    dpi = Math.min(window.devicePixelRatio || 1, MAX_DPI);
    W = window.innerWidth;
    H = window.innerHeight;
    cloudZoneH = Math.max(H * CLOUD_ZONE_HEIGHT, CLOUD_MIN_ZONE);

    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.width = Math.floor(W * dpi);
    canvas.height = Math.floor(H * dpi);

    ctx = canvas.getContext('2d');
    ctx.scale(dpi, dpi);

    /* Cloud offscreen buffer */
    if (!cloudCanvas) {
      cloudCanvas = document.createElement('canvas');
    }
    cloudCanvas.width = Math.floor(W * dpi);
    cloudCanvas.height = Math.floor(cloudZoneH * dpi);
    cloudCtx = cloudCanvas.getContext('2d');
    cloudCtx.scale(dpi, dpi);

    cloudFieldDirty = true;
  }

  /* ---- Initialize drop pool ---- */

  function initDrops() {
    var count = activePreset.dropCount;
    drops = [];
    for (var i = 0; i < count; i++) {
      var drop = new Raindrop();
      spawnDrop(drop, true);
      drops.push(drop);
    }
  }

  /* ---- Spawn / recycle a drop ---- */

  function spawnDrop(drop, initialScatter) {
    var spawnX, spawnY;

    /* Try to spawn from a dense cloud region */
    if (cloudDensityMap && !initialScatter) {
      var attempts = 0;
      var spawned = false;
      while (attempts < 5 && !spawned) {
        var col = randomInt(0, cloudDensityCols - 1);
        var row = randomInt(0, cloudDensityRows - 1);
        var idx = row * cloudDensityCols + col;
        if (cloudDensityMap[idx] > 0.1) {
          /* Higher density = higher spawn probability */
          if (Math.random() < cloudDensityMap[idx]) {
            spawnX = col * CLOUD_CELL_SIZE + randomRange(0, CLOUD_CELL_SIZE);
            spawnY = cloudZoneH + randomRange(0, 10);
            spawned = true;
          }
        }
        attempts++;
      }
      if (!spawned) {
        spawnX = randomRange(0, W);
        spawnY = randomRange(-20, cloudZoneH);
      }
    } else {
      spawnX = randomRange(0, W);
      spawnY = randomRange(-20, 0);
    }

    drop.reset(spawnX, spawnY, activePreset);

    if (initialScatter) {
      drop.y = randomRange(-H * 0.1, H);
      drop.x = randomRange(0, W);
    }
  }

  /* ---- Interaction setup ---- */

  function setupInteraction() {
    isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (isDesktop) {
      if (!umbrellaEl) {
        umbrellaEl = document.createElement('div');
        umbrellaEl.className = 'umbrella-cursor';
        umbrellaEl.textContent = UMBRELLA_CHAR;
        umbrellaEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(umbrellaEl);
      }
      document.addEventListener('mousemove', onMouseMove, { passive: true });
      document.addEventListener('mouseleave', onMouseLeave, { passive: true });
      document.addEventListener('mouseenter', onMouseEnter, { passive: true });
      document.body.classList.add('rain-active');
    } else {
      if (!touchRippleEl) {
        touchRippleEl = document.createElement('div');
        touchRippleEl.className = 'touch-ripple';
        touchRippleEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(touchRippleEl);
      }
      document.addEventListener('touchstart', onTouchStart, { passive: false });
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd, { passive: true });
    }
  }

  /* ---- Mouse handlers ---- */

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseActive = true;
    if (umbrellaEl) {
      umbrellaEl.style.left = mouseX + 'px';
      umbrellaEl.style.top = mouseY + 'px';
      umbrellaEl.classList.add('visible');
    }
  }

  function onMouseLeave() {
    mouseActive = false;
    if (umbrellaEl) umbrellaEl.classList.remove('visible');
  }

  function onMouseEnter() {
    mouseActive = true;
    if (umbrellaEl) umbrellaEl.classList.add('visible');
  }

  /* ---- Touch handlers ---- */

  function onTouchStart(e) { updateTouchPoints(e); }
  function onTouchMove(e) { updateTouchPoints(e); }
  function onTouchEnd() {
    touchPoints = [];
    if (touchRippleEl) touchRippleEl.classList.remove('active');
  }

  function updateTouchPoints(e) {
    touchPoints = [];
    for (var i = 0; i < e.touches.length; i++) {
      touchPoints.push({ x: e.touches[i].clientX, y: e.touches[i].clientY });
    }
    if (touchRippleEl && touchPoints.length > 0) {
      touchRippleEl.style.left = touchPoints[0].x + 'px';
      touchRippleEl.style.top = touchPoints[0].y + 'px';
      touchRippleEl.classList.add('active');
    }
  }

  /* ============================================================
     10. PHYSICS — DEFLECTION
     ============================================================ */

  function applyUmbrellaDeflection(drop) {
    if (!mouseActive) return;
    var dx = drop.x - mouseX;
    var dy = drop.y - mouseY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > UMBRELLA_RADIUS || dist < 1) return;

    var angle = Math.atan2(dy, dx);
    if (angle > -Math.PI && angle < 0) {
      var nx = dx / dist;
      var ny = dy / dist;
      var dot = drop.vx * nx + drop.vy * ny;
      if (dot < 0) {
        drop.vx -= 1.6 * dot * nx;
        drop.vy -= 1.6 * dot * ny;
        drop.vx += randomRange(-0.3, 0.3);
        drop.vy += randomRange(-0.1, 0.2);
        drop.x = mouseX + nx * (UMBRELLA_RADIUS + 2);
        drop.y = mouseY + ny * (UMBRELLA_RADIUS + 2);
      }
    }
  }

  function applyTouchDeflection(drop) {
    for (var i = 0; i < touchPoints.length; i++) {
      var tp = touchPoints[i];
      var dx = drop.x - tp.x;
      var dy = drop.y - tp.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TOUCH_RADIUS && dist > 1) {
        var force = (TOUCH_RADIUS - dist) / TOUCH_RADIUS;
        drop.vx += (dx / dist) * force * 2;
        drop.vy += (dy / dist) * force * 1.5;
      }
    }
  }

  /* ============================================================
     11. ANIMATION LOOP
     ============================================================ */

  function loop(timestamp) {
    if (!running) return;

    var dt = timestamp - lastTime;
    lastTime = timestamp;
    if (dt > MAX_DELTA) dt = MAX_DELTA;

    var dtFactor = dt / 16.667;
    timeAccum += dt * 0.001;

    /* Clear */
    ctx.clearRect(0, 0, W, H);

    /* Wind */
    updateWind(dtFactor);

    /* Clouds — update offscreen buffer periodically */
    cloudFieldTimer += dt;
    if (cloudFieldTimer >= CLOUD_FIELD_INTERVAL || cloudFieldDirty) {
      updateCloudField();
      cloudFieldTimer = 0;
      cloudFieldDirty = false;
    }
    /* Draw cloud buffer to main canvas */
    ctx.drawImage(cloudCanvas, 0, 0, W * dpi, cloudZoneH * dpi, 0, 0, W, cloudZoneH);

    /* Rain */
    updateDrops(dtFactor);
    drawDrops();

    animId = requestAnimationFrame(loop);
  }

  /* ---- Wind system ---- */

  function updateWind(dtFactor) {
    if (activePreset.gustEnabled) {
      /* Multi-harmonic wind noise for organic gusts */
      var n = Math.sin(timeAccum * 0.7 * activePreset.gustFrequency) * 0.5 +
              Math.sin(timeAccum * 1.3 * activePreset.gustFrequency) * 0.3 +
              Math.sin(timeAccum * 0.3 * activePreset.gustFrequency) * 0.2;
      targetWind = activePreset.windSpeed + n * activePreset.gustStrength;
    } else {
      targetWind = activePreset.windSpeed;
    }
    currentWind = lerp(currentWind, targetWind, 0.02 * dtFactor);
  }

  /* ---- Cloud field rendering (offscreen buffer) ---- */

  function updateCloudField() {
    cloudCtx.clearRect(0, 0, W, cloudZoneH);

    var cols = Math.ceil(W / CLOUD_CELL_SIZE);
    var rows = Math.ceil(cloudZoneH / CLOUD_CELL_SIZE);

    /* Prepare density map for rain spawning */
    if (!cloudDensityMap || cloudDensityCols !== cols || cloudDensityRows !== rows) {
      cloudDensityMap = new Float32Array(cols * rows);
      cloudDensityCols = cols;
      cloudDensityRows = rows;
    }

    var ct = CLOUD_TYPES[activeCloudType];
    var textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-text').trim() || '#2a1f2d';

    cloudCtx.font = (CLOUD_CELL_SIZE - 1) + 'px "Cormorant Garamond", Georgia, serif';
    cloudCtx.textAlign = 'center';
    cloudCtx.textBaseline = 'middle';

    /* Wind stretches clouds horizontally */
    var windStretch = 1.0 + Math.abs(currentWind) * 0.12;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var px = col * CLOUD_CELL_SIZE;
        var py = row * CLOUD_CELL_SIZE;

        /* Sample noise with time offset for drift and morphing */
        var nx = (px / windStretch + timeAccum * activePreset.cloudDriftSpeed * 60);
        var ny = py;

        var density = cloudNoise(nx, ny, timeAccum, activeCloudType);

        /* Normalize from [-1,1] to [0,1] */
        density = (density + 1) * 0.5;

        /* Store in density map */
        var mapIdx = row * cols + col;
        cloudDensityMap[mapIdx] = density > ct.cutoff ? (density - ct.cutoff) / (1 - ct.cutoff) : 0;

        if (density > ct.cutoff) {
          var charOpacity = activePreset.cloudOpacity *
            smoothstep(ct.cutoff, ct.cutoff + 0.25, density);

          cloudCtx.globalAlpha = clamp(charOpacity, 0, 1);
          cloudCtx.fillStyle = textColor;

          var ch = cloudCharFromDensity(density, ct.cutoff);
          cloudCtx.fillText(ch, px + CLOUD_CELL_SIZE * 0.5, py + CLOUD_CELL_SIZE * 0.5);
        }
      }
    }
    cloudCtx.globalAlpha = 1;
  }

  /* ---- Drop update with realistic physics ---- */

  function updateDrops(dtFactor) {
    /* Rain angle from wind (physics: atan2(windSpeed, terminalVelocity)) */
    var windAngle = Math.atan2(currentWind, activePreset.fallSpeed);

    for (var i = 0; i < drops.length; i++) {
      var drop = drops[i];
      if (!drop.active) {
        spawnDrop(drop, false);
        continue;
      }

      /* Gravity */
      drop.vy += 0.02 * dtFactor;

      /* Wind gradient: stronger at top, weaker near ground (Ekman spiral) */
      var heightFactor = 0.3 + 0.7 * clamp(1 - drop.y / H, 0, 1);
      var effectiveWind = currentWind * drop.windFactor * heightFactor;

      /* Apply wind */
      drop.vx = lerp(drop.vx, effectiveWind, 0.05 * dtFactor);

      /* Deflection */
      if (isDesktop) {
        applyUmbrellaDeflection(drop);
      } else {
        applyTouchDeflection(drop);
      }

      /* Drag */
      drop.vx *= 0.995;

      /* Update position */
      drop.x += drop.vx * dtFactor;
      drop.y += drop.vy * dtFactor;

      /* Virga: some drops fade early */
      if (drop.virgaDrop && drop.y > drop.virgaFadeY) {
        var virgaProgress = (drop.y - drop.virgaFadeY) / (H * 0.15);
        drop.opacity = activePreset.rainOpacity * (1 - virgaProgress);
        if (drop.opacity <= 0) { drop.active = false; continue; }
      }

      /* Bottom fade */
      var fadeStart = H * (1 - BOTTOM_FADE_ZONE);
      if (drop.y > fadeStart && !drop.virgaDrop) {
        var fadeProgress = (drop.y - fadeStart) / (H * BOTTOM_FADE_ZONE);
        drop.opacity = activePreset.rainOpacity * (1 - fadeProgress) * randomRange(0.6, 1.0);
      }

      /* Recycle */
      if (drop.y > H + 20 || drop.x < -100 || drop.x > W + 100 || drop.opacity <= 0) {
        drop.active = false;
      }
    }
  }

  /* ---- Drop drawing ---- */

  function drawDrops() {
    var windAngle = Math.atan2(currentWind, activePreset.fallSpeed);

    for (var i = 0; i < drops.length; i++) {
      var drop = drops[i];
      if (!drop.active || drop.opacity <= 0) continue;

      ctx.globalAlpha = clamp(drop.opacity, 0, 1);

      if (spriteReady && charSprites[drop.char]) {
        var sprite = charSprites[drop.char];
        var halfSize = drop.size * 0.7;

        ctx.save();
        ctx.translate(~~drop.x, ~~drop.y);
        ctx.rotate(windAngle * 0.5);
        ctx.drawImage(sprite, -halfSize, -halfSize, drop.size, drop.size);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ============================================================
     12. LIFECYCLE
     ============================================================ */

  function init() {
    selectPreset();
    setupCanvas();

    var textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-text').trim() || '#2a1f2d';
    buildCharSprites(activePreset.charSize, textColor);

    initDrops();
    setupInteraction();

    running = true;
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  /* ---- Visibility API ---- */

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
      if (animId) { cancelAnimationFrame(animId); animId = null; }
    } else {
      if (!running) {
        running = true;
        lastTime = performance.now();
        animId = requestAnimationFrame(loop);
      }
    }
  });

  /* ---- Debounced resize ---- */

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      setupCanvas();

      var newDpi = Math.min(window.devicePixelRatio || 1, MAX_DPI);
      if (newDpi !== dpi) {
        var textColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--color-text').trim() || '#2a1f2d';
        buildCharSprites(activePreset.charSize, textColor);
      }

      for (var i = 0; i < drops.length; i++) {
        if (drops[i].x > W || drops[i].y > H) {
          drops[i].active = false;
        }
      }
    }, RESIZE_DEBOUNCE);
  });

  /* ---- Start on DOM ready ---- */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
