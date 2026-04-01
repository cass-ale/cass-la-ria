/* ============================================================
   RAIN.JS — Procedural Weather System v3
   Individual cloud entities with depth, drift, collision/merging,
   continuous Unicode rain, and wind physics.

   Architecture:
   - Individual cloud objects with unique noise seeds
   - Each cloud has position, size, depth, velocity, shape params
   - Clouds merge via bridging when they drift close together
   - Wind affects clouds (speed, stretch) and rain (angle, drift)
   - Wind gradient: faster at cloud height, slower near ground
   - Rain spawns from cloud base, drifts with wind
   - 7 weather presets randomly selected per visit
   - Umbrella cursor (desktop) / touch deflection (mobile)

   Sources & references:
   - Simplex noise: Stefan Gustavson (2005)
   - Domain warping: Inigo Quilez, iquilezles.org/articles/warp
   - ASCII Clouds: caidan.dev (Caidan Williams, HN 2025)
   - Cloud merging: Westcott 1994, Monthly Weather Review
   - Rain angle physics: Physics StackExchange #128586
   - Wind gradient / Ekman spiral: Cliff Mass Weather Blog
   - Particle physics: Nature of Code (Daniel Shiffman)
   - Canvas DPI fix: medium.com/wdstack (Coen Warmer)
   - Canvas optimization: MDN Canvas API Tutorial
   - Custom cursor: 14islands.com/journal
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     1. SIMPLEX NOISE (Stefan Gustavson, optimized for 2D/3D)
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
      var i = Math.floor(xin + s), j = Math.floor(yin + s);
      var t = (i + j) * G2;
      var x0 = xin - (i - t), y0 = yin - (j - t);
      var i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
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
      var i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      var t = (i + j + k) * G3;
      var x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
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
      var x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
      var x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
      var x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
      var ii=i&255,jj=j&255,kk=k&255;
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

  /* Cloud character sets — density-mapped */
  var CLOUD_CHARS_DENSE  = ['\u2588','\u2593','\u2592','#','@','%','&','W','M'];
  var CLOUD_CHARS_MEDIUM = ['0','8','6','9','3','5','*','+','=',':','^','~','$'];
  var CLOUD_CHARS_LIGHT  = ['\u2591','\u00B7','\u2022','\u2801','\u2802','.',',','\u2024'];

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

  /* Cloud rendering grid */
  var CLOUD_CELL = 11;                /* px per character cell */
  var CLOUD_ZONE_FRAC = 0.30;        /* fraction of viewport for cloud zone */
  var CLOUD_MIN_ZONE = 120;

  /* Bottom fade */
  var BOTTOM_FADE_ZONE = 0.15;

  /* ============================================================
     3. CLOUD TYPE DEFINITIONS
     Controls the noise shape for each cloud type.
     ============================================================ */

  var CLOUD_TYPES = {
    cirrus: {
      noiseScale: 0.018,
      aspectX: 3.5,        /* horizontal stretch */
      aspectY: 0.6,
      cutoff: 0.38,
      warpStr: 1.2,
      morphSpeed: 0.4,
      widthRange: [0.22, 0.40],   /* fraction of viewport */
      heightRange: [0.15, 0.25],  /* fraction of cloud zone */
      count: [3, 5],
      depthLayers: 2
    },
    stratus: {
      noiseScale: 0.012,
      aspectX: 3.0,
      aspectY: 0.5,
      cutoff: 0.30,
      warpStr: 1.8,
      morphSpeed: 0.2,
      widthRange: [0.35, 0.60],
      heightRange: [0.20, 0.35],
      count: [2, 4],
      depthLayers: 2
    },
    stratocumulus: {
      noiseScale: 0.014,
      aspectX: 2.2,
      aspectY: 0.8,
      cutoff: 0.32,
      warpStr: 2.2,
      morphSpeed: 0.25,
      widthRange: [0.18, 0.35],
      heightRange: [0.25, 0.40],
      count: [3, 6],
      depthLayers: 2
    },
    cumulus: {
      noiseScale: 0.010,
      aspectX: 1.4,
      aspectY: 1.0,
      cutoff: 0.34,
      warpStr: 2.8,
      morphSpeed: 0.3,
      widthRange: [0.12, 0.28],
      heightRange: [0.35, 0.60],
      count: [3, 5],
      depthLayers: 3
    },
    nimbostratus: {
      noiseScale: 0.009,
      aspectX: 2.5,
      aspectY: 0.7,
      cutoff: 0.25,
      warpStr: 2.0,
      morphSpeed: 0.15,
      widthRange: [0.30, 0.55],
      heightRange: [0.35, 0.55],
      count: [2, 4],
      depthLayers: 3
    },
    cumulonimbus: {
      noiseScale: 0.008,
      aspectX: 1.2,
      aspectY: 1.0,
      cutoff: 0.22,
      warpStr: 3.2,
      morphSpeed: 0.2,
      widthRange: [0.20, 0.40],
      heightRange: [0.50, 0.80],
      count: [2, 4],
      depthLayers: 3
    }
  };

  /* ============================================================
     4. WEATHER PRESETS
     ============================================================ */

  var WEATHER_PRESETS = {
    gentleMist: {
      name: 'Gentle Mist',
      cloudType: 'cirrus',
      dropCount: 80,
      fallSpeed: 1.2,
      fallSpeedVariance: 0.4,
      windSpeed: 0.15,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.35,
      rainOpacity: 0.18,
      charSize: 12,
      cloudDriftSpeed: 8,
      virga: 0.3
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
      cloudOpacity: 0.40,
      rainOpacity: 0.22,
      charSize: 13,
      cloudDriftSpeed: 12,
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
      cloudOpacity: 0.45,
      rainOpacity: 0.28,
      charSize: 13,
      cloudDriftSpeed: 18,
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
      cloudOpacity: 0.48,
      rainOpacity: 0.30,
      charSize: 14,
      cloudDriftSpeed: 30,
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
      cloudOpacity: 0.55,
      rainOpacity: 0.35,
      charSize: 14,
      cloudDriftSpeed: 14,
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
      cloudOpacity: 0.58,
      rainOpacity: 0.38,
      charSize: 15,
      cloudDriftSpeed: 40,
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
      cloudOpacity: 0.62,
      rainOpacity: 0.40,
      charSize: 15,
      cloudDriftSpeed: 55,
      virga: 0.0
    }
  };

  /* ============================================================
     5. UTILITIES
     ============================================================ */

  function randomRange(min, max) { return min + Math.random() * (max - min); }
  function randomInt(min, max) { return Math.floor(randomRange(min, max + 1)); }
  function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function smoothstep(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT ||
           ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  }

  /* ============================================================
     6. NOISE HELPERS
     ============================================================ */

  var noise = new SimplexNoise(Math.random() * 65536);

  function fbm(x, y, octaves) {
    var v = 0, amp = 0.5, freq = 1;
    for (var i = 0; i < octaves; i++) {
      v += amp * noise.noise2D(x * freq, y * freq);
      amp *= 0.5;
      freq *= 2;
    }
    return v;
  }

  /* Domain-warped noise for a single cloud entity */
  function cloudEntityNoise(x, y, time, ct, seed) {
    var sx = x * ct.noiseScale * ct.aspectX + seed;
    var sy = y * ct.noiseScale * ct.aspectY + seed * 0.7;

    var qx = fbm(sx + time * 0.08, sy + time * 0.04, 3);
    var qy = fbm(sx + 5.2 + time * 0.06, sy + 1.3 + time * 0.03, 3);

    var warped = fbm(
      sx + ct.warpStr * qx + time * ct.morphSpeed * 0.08,
      sy + ct.warpStr * qy + time * ct.morphSpeed * 0.04,
      4
    );

    return (warped + 1) * 0.5;  /* normalize to [0, 1] */
  }

  /* Character from density */
  function charFromDensity(norm) {
    if (norm > 0.65) return randomItem(CLOUD_CHARS_DENSE);
    if (norm > 0.30) return randomItem(CLOUD_CHARS_MEDIUM);
    return randomItem(CLOUD_CHARS_LIGHT);
  }

  /* ============================================================
     7. INDIVIDUAL CLOUD ENTITY
     Each cloud is an independent object with its own noise seed,
     position, size, depth layer, and drift velocity.
     ============================================================ */

  function CloudEntity(x, y, w, h, depth, seed, ct) {
    this.x = x;              /* center x in px */
    this.y = y;              /* center y in px */
    this.w = w;              /* width in px */
    this.h = h;              /* height in px */
    this.depth = depth;       /* 0 = far (dim), 1 = mid, 2 = near (bright) */
    this.seed = seed;
    this.ct = ct;             /* cloud type params reference */
    this.vx = 0;              /* current drift velocity */
    this.merging = false;
    this.mergePartner = null;
    this.mergeProgress = 0;   /* 0 to 1 */
    this.absorbed = false;    /* true = being absorbed into partner */
    this.opacity = 1.0;       /* for fade-in/out */
    this.charCycleOffset = Math.random() * 1000;
  }

  /* ============================================================
     8. CLOUD MANAGER
     Spawns, updates, renders, and handles collision for clouds.
     ============================================================ */

  var clouds = [];
  var MERGE_DISTANCE_FACTOR = 0.08;   /* fraction of combined widths to start bridging */
  var BRIDGE_GROW_RATE = 0.15;        /* how fast bridges thicken per second */

  function spawnClouds() {
    clouds = [];
    var ct = CLOUD_TYPES[activeCloudType];
    var count = randomInt(ct.count[0], ct.count[1]);

    for (var i = 0; i < count; i++) {
      var depth = i % ct.depthLayers;
      var wFrac = randomRange(ct.widthRange[0], ct.widthRange[1]);
      var hFrac = randomRange(ct.heightRange[0], ct.heightRange[1]);
      var cw = W * wFrac;
      var ch = cloudZoneH * hFrac;

      /* Distribute across the viewport with some overlap allowed */
      var cx = randomRange(-cw * 0.3, W + cw * 0.3);
      var cy = cloudZoneH * randomRange(0.2, 0.7);

      var seed = Math.random() * 10000;

      var cloud = new CloudEntity(cx, cy, cw, ch, depth, seed, ct);
      clouds.push(cloud);
    }

    /* Sort by depth so far clouds render first */
    clouds.sort(function (a, b) { return a.depth - b.depth; });
  }

  function updateClouds(dt) {
    var dtSec = dt / 16.667;

    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      if (c.absorbed && c.opacity <= 0) continue;

      /* Drift with wind — deeper clouds move slower (parallax) */
      var depthFactor = 0.5 + 0.5 * (c.depth / Math.max(c.ct.depthLayers - 1, 1));
      var targetVx = activePreset.cloudDriftSpeed * depthFactor * (currentWind >= 0 ? 1 : -1);
      c.vx = lerp(c.vx, targetVx, 0.01 * dtSec);

      /* Wind stretches clouds */
      var windStretch = 1.0 + Math.abs(currentWind) * 0.08;
      /* (applied during rendering, not stored) */

      c.x += c.vx * dtSec * 0.016;

      /* Wrap around screen edges */
      if (c.vx > 0 && c.x - c.w * 0.5 > W + 50) {
        c.x = -c.w * 0.5 - 20;
        c.seed = Math.random() * 10000;  /* new shape on re-entry */
      } else if (c.vx < 0 && c.x + c.w * 0.5 < -50) {
        c.x = W + c.w * 0.5 + 20;
        c.seed = Math.random() * 10000;
      }

      /* Handle absorption fade */
      if (c.absorbed) {
        c.opacity = Math.max(0, c.opacity - 0.3 * dtSec * 0.016);
      } else {
        c.opacity = Math.min(1, c.opacity + 0.5 * dtSec * 0.016);
      }
    }

    /* Collision detection and merging */
    checkCloudMerging(dtSec);
  }

  function checkCloudMerging(dtSec) {
    for (var i = 0; i < clouds.length; i++) {
      var a = clouds[i];
      if (a.absorbed) continue;

      for (var j = i + 1; j < clouds.length; j++) {
        var b = clouds[j];
        if (b.absorbed) continue;
        if (a.depth !== b.depth) continue;  /* only same-depth clouds merge */

        /* Check horizontal overlap */
        var aLeft = a.x - a.w * 0.5;
        var aRight = a.x + a.w * 0.5;
        var bLeft = b.x - b.w * 0.5;
        var bRight = b.x + b.w * 0.5;

        var gap = Math.max(bLeft - aRight, aLeft - bRight);
        var mergeThreshold = (a.w + b.w) * MERGE_DISTANCE_FACTOR;

        if (gap < mergeThreshold) {
          /* Clouds are close enough to bridge */
          if (!a.merging || a.mergePartner !== b) {
            a.merging = true;
            a.mergePartner = b;
            a.mergeProgress = 0;
            b.merging = true;
            b.mergePartner = a;
            b.mergeProgress = 0;
          }

          /* Advance merge */
          a.mergeProgress = Math.min(1, a.mergeProgress + BRIDGE_GROW_RATE * dtSec * 0.016);
          b.mergeProgress = a.mergeProgress;

          /* Full merge: smaller cloud gets absorbed */
          if (a.mergeProgress >= 1) {
            var smaller = a.w * a.h < b.w * b.h ? a : b;
            var larger = smaller === a ? b : a;
            smaller.absorbed = true;
            /* Larger cloud grows (Westcott 1994: merged cloud is bigger) */
            larger.w *= 1.15;
            larger.h *= 1.08;
            larger.merging = false;
            larger.mergePartner = null;
            larger.mergeProgress = 0;
          }
        } else {
          /* Drifted apart — cancel merge */
          if (a.merging && a.mergePartner === b) {
            a.merging = false;
            a.mergePartner = null;
            a.mergeProgress = Math.max(0, a.mergeProgress - BRIDGE_GROW_RATE * 0.5 * dtSec * 0.016);
            b.merging = false;
            b.mergePartner = null;
            b.mergeProgress = a.mergeProgress;
          }
        }
      }
    }

    /* Respawn absorbed clouds after they fully fade */
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      if (c.absorbed && c.opacity <= 0) {
        /* Respawn off-screen */
        var ct = CLOUD_TYPES[activeCloudType];
        var wFrac = randomRange(ct.widthRange[0], ct.widthRange[1]);
        var hFrac = randomRange(ct.heightRange[0], ct.heightRange[1]);
        c.w = W * wFrac;
        c.h = cloudZoneH * hFrac;
        c.x = currentWind >= 0 ? -c.w * 0.5 - randomRange(50, 200) : W + c.w * 0.5 + randomRange(50, 200);
        c.y = cloudZoneH * randomRange(0.2, 0.7);
        c.seed = Math.random() * 10000;
        c.absorbed = false;
        c.merging = false;
        c.mergePartner = null;
        c.mergeProgress = 0;
        c.opacity = 0;
      }
    }
  }

  /* ============================================================
     9. CLOUD RENDERING (offscreen buffer)
     Each cloud is rendered individually with its own noise field.
     ============================================================ */

  function renderClouds() {
    cloudCtx.clearRect(0, 0, W, cloudZoneH);

    var textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-text').trim() || '#2a1f2d';

    cloudCtx.font = (CLOUD_CELL - 1) + 'px "Cormorant Garamond", Georgia, serif';
    cloudCtx.textAlign = 'center';
    cloudCtx.textBaseline = 'middle';

    var windStretch = 1.0 + Math.abs(currentWind) * 0.08;

    /* Reset density map */
    if (cloudDensityMap) {
      for (var k = 0; k < cloudDensityMap.length; k++) cloudDensityMap[k] = 0;
    }

    for (var ci = 0; ci < clouds.length; ci++) {
      var c = clouds[ci];
      if (c.absorbed && c.opacity <= 0) continue;

      /* Depth-based opacity and size scaling */
      var depthOpacity = 0.4 + 0.6 * (c.depth / Math.max(c.ct.depthLayers - 1, 1));
      var baseOpacity = activePreset.cloudOpacity * depthOpacity * c.opacity;

      /* Cloud bounding box in screen coords */
      var cw = c.w * windStretch;
      var ch = c.h;
      var left = Math.floor((c.x - cw * 0.5) / CLOUD_CELL);
      var right = Math.ceil((c.x + cw * 0.5) / CLOUD_CELL);
      var top = Math.floor((c.y - ch * 0.5) / CLOUD_CELL);
      var bottom = Math.ceil((c.y + ch * 0.5) / CLOUD_CELL);

      /* Clamp to screen */
      left = Math.max(0, left);
      right = Math.min(Math.ceil(W / CLOUD_CELL), right);
      top = Math.max(0, top);
      bottom = Math.min(Math.ceil(cloudZoneH / CLOUD_CELL), bottom);

      for (var row = top; row < bottom; row++) {
        for (var col = left; col < right; col++) {
          var px = col * CLOUD_CELL;
          var py = row * CLOUD_CELL;

          /* Normalize position within cloud (0 to 1) */
          var nx = (px - (c.x - cw * 0.5)) / cw;
          var ny = (py - (c.y - ch * 0.5)) / ch;

          /* Elliptical falloff — gives clouds defined edges */
          var ex = (nx - 0.5) * 2;
          var ey = (ny - 0.5) * 2;
          var ellipse = ex * ex + ey * ey;
          if (ellipse > 1.0) continue;

          /* Soft edge falloff */
          var edgeFade = smoothstep(1.0, 0.5, ellipse);

          /* Sample noise for this cloud */
          var density = cloudEntityNoise(px, py, timeAccum, c.ct, c.seed);

          /* Apply edge falloff to density */
          density *= edgeFade;

          /* Flat bottom for cumulus-type clouds */
          if (c.ct === CLOUD_TYPES.cumulus || c.ct === CLOUD_TYPES.cumulonimbus) {
            if (ny > 0.65) {
              density *= smoothstep(1.0, 0.65, ny) * 1.3;
            }
          }

          /* Cutoff threshold */
          if (density < c.ct.cutoff) continue;

          var norm = (density - c.ct.cutoff) / (1 - c.ct.cutoff);
          var charOpacity = baseOpacity * smoothstep(0, 0.3, norm);

          cloudCtx.globalAlpha = clamp(charOpacity, 0, 1);
          cloudCtx.fillStyle = textColor;

          var ch2 = charFromDensity(norm);
          cloudCtx.fillText(ch2, px + CLOUD_CELL * 0.5, py + CLOUD_CELL * 0.5);

          /* Update density map for rain spawning */
          if (cloudDensityMap) {
            var mapCol = Math.floor(px / CLOUD_CELL);
            var mapRow = Math.floor(py / CLOUD_CELL);
            if (mapCol >= 0 && mapCol < cloudDensityCols && mapRow >= 0 && mapRow < cloudDensityRows) {
              var idx = mapRow * cloudDensityCols + mapCol;
              cloudDensityMap[idx] = Math.max(cloudDensityMap[idx], norm);
            }
          }
        }
      }
    }

    /* Render bridges between merging clouds */
    renderBridges(textColor, windStretch);

    cloudCtx.globalAlpha = 1;
  }

  /* Bridge rendering — wispy connection between merging clouds */
  function renderBridges(textColor, windStretch) {
    for (var i = 0; i < clouds.length; i++) {
      var a = clouds[i];
      if (!a.merging || !a.mergePartner || a.absorbed) continue;
      var b = a.mergePartner;
      if (b.absorbed) continue;

      /* Only render bridge once per pair */
      if (clouds.indexOf(b) < i) continue;

      var progress = a.mergeProgress;
      if (progress <= 0) continue;

      /* Bridge region between the two clouds */
      var aRight = a.x + a.w * windStretch * 0.5;
      var bLeft = b.x - b.w * windStretch * 0.5;
      var leftEdge, rightEdge;
      if (aRight < bLeft) {
        leftEdge = aRight;
        rightEdge = bLeft;
      } else {
        leftEdge = bLeft;
        rightEdge = aRight;
      }

      /* Bridge vertical center — average of the two clouds */
      var bridgeY = (a.y + b.y) * 0.5;
      var bridgeH = Math.min(a.h, b.h) * 0.3 * progress;

      var bLeft2 = Math.max(0, Math.floor(leftEdge / CLOUD_CELL));
      var bRight2 = Math.min(Math.ceil(W / CLOUD_CELL), Math.ceil(rightEdge / CLOUD_CELL));
      var bTop = Math.max(0, Math.floor((bridgeY - bridgeH * 0.5) / CLOUD_CELL));
      var bBottom = Math.min(Math.ceil(cloudZoneH / CLOUD_CELL), Math.ceil((bridgeY + bridgeH * 0.5) / CLOUD_CELL));

      for (var row = bTop; row < bBottom; row++) {
        for (var col = bLeft2; col < bRight2; col++) {
          var px = col * CLOUD_CELL;
          var py = row * CLOUD_CELL;

          /* Bridge density based on progress and position */
          var bx = (px - leftEdge) / Math.max(rightEdge - leftEdge, 1);
          var by = (py - (bridgeY - bridgeH * 0.5)) / Math.max(bridgeH, 1);

          /* Wispy shape — thin in middle, thicker at ends */
          var bridgeDensity = progress * 0.6 *
            (1 - Math.abs(by - 0.5) * 2) *
            (0.3 + 0.7 * (1 - 4 * (bx - 0.5) * (bx - 0.5)));

          /* Add some noise for organic look */
          bridgeDensity *= 0.5 + 0.5 * ((noise.noise2D(px * 0.03 + timeAccum, py * 0.03) + 1) * 0.5);

          if (bridgeDensity < 0.1) continue;

          cloudCtx.globalAlpha = clamp(bridgeDensity * activePreset.cloudOpacity * 0.7, 0, 1);
          cloudCtx.fillStyle = textColor;
          cloudCtx.fillText(randomItem(CLOUD_CHARS_LIGHT), px + CLOUD_CELL * 0.5, py + CLOUD_CELL * 0.5);
        }
      }
    }
  }

  /* ============================================================
     10. PRE-RENDERED CHARACTER SPRITES (rain)
     ============================================================ */

  var charSprites = {};
  var spriteReady = false;

  function buildCharSprites(fontSize, color) {
    charSprites = {};
    for (var i = 0; i < RAIN_CHARS.length; i++) {
      var c = RAIN_CHARS[i];
      var off = document.createElement('canvas');
      var sz = Math.ceil(fontSize * 1.4);
      off.width = sz; off.height = sz;
      var octx = off.getContext('2d');
      octx.font = fontSize + 'px "Cormorant Garamond", Georgia, serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = color;
      octx.fillText(c, sz / 2, sz / 2);
      charSprites[c] = off;
    }
    spriteReady = true;
  }

  /* ============================================================
     11. RAINDROP OBJECT POOL
     ============================================================ */

  function Raindrop() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.char = '1'; this.opacity = 0; this.active = false;
    this.windFactor = 1; this.size = 13;
    this.virgaDrop = false; this.virgaFadeY = 0;
  }

  Raindrop.prototype.reset = function (x, y, preset) {
    this.x = x; this.y = y;
    this.vy = preset.fallSpeed + randomRange(-preset.fallSpeedVariance, preset.fallSpeedVariance);
    this.vx = 0;
    this.char = randomItem(RAIN_CHARS);
    this.opacity = preset.rainOpacity * randomRange(0.6, 1.0);
    this.active = true;
    this.windFactor = randomRange(0.8, 1.2);
    this.size = preset.charSize + randomInt(-1, 1);
    this.virgaDrop = Math.random() < preset.virga;
    this.virgaFadeY = this.virgaDrop ? randomRange(H * 0.3, H * 0.7) : H;
  };

  /* ============================================================
     12. MAIN ANIMATION CONTROLLER
     ============================================================ */

  var canvas, ctx;
  var cloudCanvas, cloudCtx;
  var animId = null;
  var lastTime = 0;
  var running = false;

  var W = 0, H = 0, dpi = 1;
  var drops = [];
  var activePreset = null;
  var activeCloudType = null;
  var currentWind = 0;
  var targetWind = 0;
  var timeAccum = 0;
  var cloudZoneH = 0;

  var cloudFieldTimer = 0;
  var CLOUD_FIELD_INTERVAL = 100;

  var cloudDensityMap = null;
  var cloudDensityCols = 0;
  var cloudDensityRows = 0;

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
    cloudZoneH = Math.max(H * CLOUD_ZONE_FRAC, CLOUD_MIN_ZONE);

    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.width = Math.floor(W * dpi);
    canvas.height = Math.floor(H * dpi);

    ctx = canvas.getContext('2d');
    ctx.scale(dpi, dpi);

    if (!cloudCanvas) cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = Math.floor(W * dpi);
    cloudCanvas.height = Math.floor(cloudZoneH * dpi);
    cloudCtx = cloudCanvas.getContext('2d');
    cloudCtx.scale(dpi, dpi);

    /* Density map */
    cloudDensityCols = Math.ceil(W / CLOUD_CELL);
    cloudDensityRows = Math.ceil(cloudZoneH / CLOUD_CELL);
    cloudDensityMap = new Float32Array(cloudDensityCols * cloudDensityRows);
  }

  function initDrops() {
    var count = activePreset.dropCount;
    drops = [];
    for (var i = 0; i < count; i++) {
      var drop = new Raindrop();
      spawnDrop(drop, true);
      drops.push(drop);
    }
  }

  function spawnDrop(drop, initialScatter) {
    var spawnX, spawnY;

    if (cloudDensityMap && !initialScatter) {
      var attempts = 0, spawned = false;
      while (attempts < 8 && !spawned) {
        var col = randomInt(0, cloudDensityCols - 1);
        var row = randomInt(0, cloudDensityRows - 1);
        var idx = row * cloudDensityCols + col;
        if (cloudDensityMap[idx] > 0.05) {
          if (Math.random() < cloudDensityMap[idx]) {
            spawnX = col * CLOUD_CELL + randomRange(0, CLOUD_CELL);
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

  /* ---- Interaction ---- */

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

  function onMouseMove(e) {
    mouseX = e.clientX; mouseY = e.clientY; mouseActive = true;
    if (umbrellaEl) {
      umbrellaEl.style.left = mouseX + 'px';
      umbrellaEl.style.top = mouseY + 'px';
      umbrellaEl.classList.add('visible');
    }
  }
  function onMouseLeave() { mouseActive = false; if (umbrellaEl) umbrellaEl.classList.remove('visible'); }
  function onMouseEnter() { mouseActive = true; if (umbrellaEl) umbrellaEl.classList.add('visible'); }

  function onTouchStart(e) { updateTouchPoints(e); }
  function onTouchMove(e) { updateTouchPoints(e); }
  function onTouchEnd() { touchPoints = []; if (touchRippleEl) touchRippleEl.classList.remove('active'); }

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
     13. PHYSICS — DEFLECTION
     ============================================================ */

  function applyUmbrellaDeflection(drop) {
    if (!mouseActive) return;
    var dx = drop.x - mouseX, dy = drop.y - mouseY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > UMBRELLA_RADIUS || dist < 1) return;

    var angle = Math.atan2(dy, dx);
    if (angle > -Math.PI && angle < 0) {
      var nx = dx / dist, ny = dy / dist;
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
      var dx = drop.x - tp.x, dy = drop.y - tp.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TOUCH_RADIUS && dist > 1) {
        var force = (TOUCH_RADIUS - dist) / TOUCH_RADIUS;
        drop.vx += (dx / dist) * force * 2;
        drop.vy += (dy / dist) * force * 1.5;
      }
    }
  }

  /* ============================================================
     14. ANIMATION LOOP
     ============================================================ */

  function loop(timestamp) {
    if (!running) return;

    var dt = timestamp - lastTime;
    lastTime = timestamp;
    if (dt > MAX_DELTA) dt = MAX_DELTA;

    var dtFactor = dt / 16.667;
    timeAccum += dt * 0.001;

    ctx.clearRect(0, 0, W, H);

    /* Wind */
    updateWind(dtFactor);

    /* Clouds — update entities every frame, render periodically */
    updateClouds(dt);
    cloudFieldTimer += dt;
    if (cloudFieldTimer >= CLOUD_FIELD_INTERVAL) {
      renderClouds();
      cloudFieldTimer = 0;
    }
    ctx.drawImage(cloudCanvas, 0, 0, W * dpi, cloudZoneH * dpi, 0, 0, W, cloudZoneH);

    /* Rain */
    updateDrops(dtFactor);
    drawDrops();

    animId = requestAnimationFrame(loop);
  }

  function updateWind(dtFactor) {
    if (activePreset.gustEnabled) {
      var n = Math.sin(timeAccum * 0.7 * activePreset.gustFrequency) * 0.5 +
              Math.sin(timeAccum * 1.3 * activePreset.gustFrequency) * 0.3 +
              Math.sin(timeAccum * 0.3 * activePreset.gustFrequency) * 0.2;
      targetWind = activePreset.windSpeed + n * activePreset.gustStrength;
    } else {
      targetWind = activePreset.windSpeed;
    }
    currentWind = lerp(currentWind, targetWind, 0.02 * dtFactor);
  }

  function updateDrops(dtFactor) {
    for (var i = 0; i < drops.length; i++) {
      var drop = drops[i];
      if (!drop.active) { spawnDrop(drop, false); continue; }

      drop.vy += 0.02 * dtFactor;

      var heightFactor = 0.3 + 0.7 * clamp(1 - drop.y / H, 0, 1);
      var effectiveWind = currentWind * drop.windFactor * heightFactor;
      drop.vx = lerp(drop.vx, effectiveWind, 0.05 * dtFactor);

      if (isDesktop) applyUmbrellaDeflection(drop);
      else applyTouchDeflection(drop);

      drop.vx *= 0.995;
      drop.x += drop.vx * dtFactor;
      drop.y += drop.vy * dtFactor;

      if (drop.virgaDrop && drop.y > drop.virgaFadeY) {
        var vp = (drop.y - drop.virgaFadeY) / (H * 0.15);
        drop.opacity = activePreset.rainOpacity * (1 - vp);
        if (drop.opacity <= 0) { drop.active = false; continue; }
      }

      var fadeStart = H * (1 - BOTTOM_FADE_ZONE);
      if (drop.y > fadeStart && !drop.virgaDrop) {
        var fp = (drop.y - fadeStart) / (H * BOTTOM_FADE_ZONE);
        drop.opacity = activePreset.rainOpacity * (1 - fp) * randomRange(0.6, 1.0);
      }

      if (drop.y > H + 20 || drop.x < -100 || drop.x > W + 100 || drop.opacity <= 0) {
        drop.active = false;
      }
    }
  }

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
     15. LIFECYCLE
     ============================================================ */

  function init() {
    selectPreset();
    setupCanvas();

    var textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-text').trim() || '#2a1f2d';
    buildCharSprites(activePreset.charSize, textColor);

    spawnClouds();
    initDrops();
    setupInteraction();

    /* Initial cloud render */
    renderClouds();

    running = true;
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

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

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      setupCanvas();
      spawnClouds();

      var newDpi = Math.min(window.devicePixelRatio || 1, MAX_DPI);
      if (newDpi !== dpi) {
        var textColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--color-text').trim() || '#2a1f2d';
        buildCharSprites(activePreset.charSize, textColor);
      }

      for (var i = 0; i < drops.length; i++) {
        if (drops[i].x > W || drops[i].y > H) drops[i].active = false;
      }
    }, RESIZE_DEBOUNCE);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
