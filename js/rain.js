/* ============================================================
   RAIN.JS — Procedural Weather System v4
   Individual cloud entities with depth, drift, collision/merging,
   continuous Unicode rain, AAA wind physics, splash particles,
   volumetric rain depth, and atmospheric mist.

   Architecture:
   - Individual cloud objects with unique noise seeds
   - Each cloud has position, size, depth, velocity, shape params
   - Randomized per-cloud directions: L-R, R-L, diagonals, angles
   - Z-axis movement: clouds gently approach/recede (scale oscillation)
   - Subtle size breathing and shape evolution over time
   - Clouds merge via bridging when they drift close together
   - 3-layer wind: base drift + asymmetric gust envelope + Perlin turbulence
   - Wind gradient: faster at cloud height, slower near ground
   - 3-depth rain layers with parallax (foreground/mid/background)
   - Splash particles on ground impact
   - Atmospheric ground mist for heavy presets
   - 7 weather presets randomly selected per visit
   - Umbrella cursor (desktop) / touch deflection (mobile)

   Sources & references:
   - Simplex noise: Stefan Gustavson (2005)
   - Domain warping: Inigo Quilez, iquilezles.org/articles/warp
   - ASCII Clouds: caidan.dev (Caidan Williams, HN 2025)
   - Cloud merging: Westcott 1994, Monthly Weather Review
   - Rain angle physics: Physics StackExchange #128586
   - Wind gradient / Ekman spiral: Cliff Mass Weather Blog
   - AAA Wind: Guerrilla Games (Horizon Zero Dawn), Gajatix Studios
   - Wind turbulence: Bandi 2017, Physical Review Letters (Δt^2/3)
   - Gust physics: FESSTVaL, Guidewire (3-20s duration, asymmetric)
   - 1D Noise: Michael Bromley, michaelbromley.co.uk
   - Splash particles: Geoff Blair, geoffblair.com/blog/rain-effect
   - Particle physics: Nature of Code (Daniel Shiffman)
   - Canvas DPI fix: medium.com/wdstack (Coen Warmer)
   - Canvas optimization: MDN Canvas API Tutorial
   - Custom cursor: 14islands.com/journal
   - Device Orientation: MDN DeviceOrientationEvent
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

  /* Mist characters — very light, used for ground fog */
  var MIST_CHARS = ['\u2591', '\u00B7', '.', ',', '\u2024', '~'];

  /* Splash characters — tiny impact marks */
  var SPLASH_CHARS = ['\u00B7', '.', ',', '\'', '\u2024'];

  /* Ice fragment characters — used for Freezing Rain preset */
  var ICE_SPLASH_CHARS = ['*', '+', '\u2022', '\u00D7', '\u2219', '\u2716'];

  /* Umbrella */
  var UMBRELLA_CHAR = '\u2602';
  var UMBRELLA_RADIUS = 55;

  /* Umbrella collision physics
     References:
     - Surface normal reflection: GameDev StackExchange #136073
     - Coefficient of restitution: Cyanilux rain effects breakdown
     - Edge drip behavior: Cyanilux umbrella rim particles
     - Impact splashes: 80 Level "How Rain Works in Video Games"
     - Rain quality criteria: Rock Paper Shotgun rain grading */
  var UMBRELLA_RESTITUTION = 0.45;      /* energy retained after bounce (< 1 = absorb) */
  var UMBRELLA_SPLASH_CHANCE = 0.55;    /* chance of splash on umbrella impact */
  var UMBRELLA_SPLASH_COUNT = [1, 2];   /* min/max splash particles per impact */
  var UMBRELLA_DRIP_CHANCE = 0.12;      /* chance of edge drip per frame when drops are hitting */
  var UMBRELLA_DRIP_SPEED = 0.8;        /* initial downward speed of drip particles */
  var UMBRELLA_DRIP_LIFE = 0.8;         /* seconds a drip particle lives */
  var UMBRELLA_EDGE_ANGLE = 0.35;       /* radians from horizontal = "edge zone" for drips */
  var UMBRELLA_ARC_START = -Math.PI;    /* full top arc start */
  var UMBRELLA_ARC_END = 0;             /* full top arc end */
  var UMBRELLA_SOFT_EDGE = 8;           /* px of soft transition at arc boundary */
  var umbrellaHitCount = 0;             /* running count of hits for drip accumulation */
  var UMBRELLA_DRIP_THRESHOLD = 5;      /* hits needed before drips start */

  /* Touch */
  var TOUCH_RADIUS = 50;

  /* Device tilt (mobile only) */
  var tiltGamma = 0;    /* left-right tilt: -90 to 90 degrees */
  var tiltBeta = 0;     /* front-back tilt: -180 to 180 degrees */
  var tiltPermissionGranted = false;
  var TILT_WIND_INFLUENCE = 0.04;   /* how much tilt affects wind (per degree) */
  var TILT_CLOUD_INFLUENCE = 0.015; /* how much tilt nudges cloud drift */

  /* Animation pause toggle */
  var paused = false;

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

  /* Rain depth layers — parallax configuration */
  var DEPTH_LAYERS = [
    { scale: 0.55, speedMult: 0.45, opacityMult: 0.30, windMult: 0.35, fraction: 0.20 },  /* far background */
    { scale: 0.75, speedMult: 0.70, opacityMult: 0.55, windMult: 0.65, fraction: 0.35 },  /* midground */
    { scale: 1.00, speedMult: 1.00, opacityMult: 1.00, windMult: 1.00, fraction: 0.45 }   /* foreground */
  ];

  /* Splash configuration */
  var SPLASH_POOL_SIZE = 80;
  var SPLASH_SPAWN_CHANCE = 0.35;      /* chance a foreground drop spawns splashes */
  var SPLASH_COUNT_MIN = 2;
  var SPLASH_COUNT_MAX = 4;
  var SPLASH_LIFE = 0.4;               /* seconds */
  var SPLASH_SPEED_MIN = 0.8;
  var SPLASH_SPEED_MAX = 2.0;
  var SPLASH_ARC_GRAVITY = 4.5;

  /* Mist configuration */
  var MIST_POOL_SIZE = 40;
  var MIST_ZONE_FRAC = 0.18;           /* bottom fraction of viewport */
  var MIST_DRIFT_SPEED = 0.3;
  var MIST_LIFE_MIN = 3.0;
  var MIST_LIFE_MAX = 6.0;

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
      virga: 0.3,
      mistEnabled: false,
      mistDensity: 0
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
      virga: 0.15,
      mistEnabled: false,
      mistDensity: 0
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
      virga: 0.05,
      mistEnabled: true,
      mistDensity: 0.3
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
      virga: 0.08,
      mistEnabled: true,
      mistDensity: 0.4
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
      virga: 0.0,
      mistEnabled: true,
      mistDensity: 0.6
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
      virga: 0.0,
      mistEnabled: true,
      mistDensity: 0.75
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
      virga: 0.0,
      mistEnabled: true,
      mistDensity: 0.9
    },

    /* ---- NEW PRESETS ---- */

    monsoon: {
      name: 'Monsoon',
      cloudType: 'nimbostratus',
      dropCount: 600,
      fallSpeed: 5.0,
      fallSpeedVariance: 0.5,    /* uniform terminal velocity — sheet-like */
      windSpeed: 0.3,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.70,
      rainOpacity: 0.45,
      charSize: 14,
      cloudDriftSpeed: 10,
      virga: 0.0,
      mistEnabled: true,
      mistDensity: 1.0
    },
    squallLine: {
      name: 'Squall Line',
      cloudType: 'cumulonimbus',
      dropCount: 450,
      fallSpeed: 5.0,
      fallSpeedVariance: 1.8,
      windSpeed: 4.5,             /* extreme horizontal wind */
      gustEnabled: true,
      gustStrength: 3.5,          /* violent gusts */
      gustFrequency: 2.5,
      cloudOpacity: 0.60,
      rainOpacity: 0.38,
      charSize: 14,
      cloudDriftSpeed: 70,        /* rapid cloud movement */
      virga: 0.0,
      mistEnabled: true,
      mistDensity: 0.7,
      lightningEnabled: true,
      lightningInterval: [8, 20],   /* less frequent than thunderstorm */
      lightningBranches: 2          /* simpler bolts */
    },
    thunderstorm: {
      name: 'Thunderstorm',
      cloudType: 'cumulonimbus',
      dropCount: 380,
      fallSpeed: 4.8,
      fallSpeedVariance: 1.5,
      windSpeed: 2.0,
      gustEnabled: true,
      gustStrength: 2.0,
      gustFrequency: 1.8,
      cloudOpacity: 0.58,
      rainOpacity: 0.35,
      charSize: 14,
      cloudDriftSpeed: 35,
      virga: 0.0,
      mistEnabled: true,
      mistDensity: 0.6,
      lightningEnabled: true,
      lightningInterval: [4, 12],  /* seconds between strikes */
      lightningBranches: 3         /* max branch depth */
    },
    freezingRain: {
      name: 'Freezing Rain',
      cloudType: 'stratus',
      dropCount: 250,
      fallSpeed: 5.5,              /* high terminal velocity — supercooled */
      fallSpeedVariance: 0.8,
      windSpeed: 0.5,
      gustEnabled: true,
      gustStrength: 0.5,
      gustFrequency: 0.6,
      cloudOpacity: 0.50,
      rainOpacity: 0.30,
      charSize: 13,
      cloudDriftSpeed: 15,
      virga: 0.0,
      mistEnabled: false,
      mistDensity: 0,
      iceSplash: true              /* flag: use ice fragment chars instead of liquid */
    },
    radiationFog: {
      name: 'Radiation Fog',
      cloudType: 'stratus',
      dropCount: 0,                /* zero rain */
      fallSpeed: 0,
      fallSpeedVariance: 0,
      windSpeed: 0.05,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.25,
      rainOpacity: 0,
      charSize: 13,
      cloudDriftSpeed: 4,
      virga: 0,
      mistEnabled: true,
      mistDensity: 1.0,
      fogMode: true,               /* flag: dense fog filling 70% of viewport */
      fogZoneFrac: 0.70
    },
    petrichor: {
      name: 'Petrichor',
      cloudType: 'stratocumulus',
      dropCount: 60,
      fallSpeed: 1.5,
      fallSpeedVariance: 0.3,
      windSpeed: 0.2,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.30,
      rainOpacity: 0.15,
      charSize: 12,
      cloudDriftSpeed: 6,
      virga: 0.25,                 /* some drops evaporate mid-fall */
      mistEnabled: true,
      mistDensity: 0.2
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

  /* Secondary noise instance for wind turbulence — independent seed */
  var windNoise = new SimplexNoise(Math.random() * 65536);

  function fbm(x, y, octaves) {
    var v = 0, amp = 0.5, freq = 1;
    for (var i = 0; i < octaves; i++) {
      v += amp * noise.noise2D(x * freq, y * freq);
      amp *= 0.5;
      freq *= 2;
    }
    return v;
  }

  /* Domain-warped noise for a single cloud entity.
     warpExtra adds per-cloud drift so shapes subtly evolve as they travel. */
  function cloudEntityNoise(x, y, time, ct, seed, warpExtra) {
    var wd = warpExtra || 0;
    var sx = x * ct.noiseScale * ct.aspectX + seed;
    var sy = y * ct.noiseScale * ct.aspectY + seed * 0.7;

    var qx = fbm(sx + time * 0.08 + wd, sy + time * 0.04, 3);
    var qy = fbm(sx + 5.2 + time * 0.06, sy + 1.3 + time * 0.03 + wd * 0.5, 3);

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
    this.baseW = w;           /* original width for size pulsing */
    this.baseH = h;           /* original height for size pulsing */
    this.depth = depth;       /* 0 = far (dim), 1 = mid, 2 = near (bright) */
    this.seed = seed;
    this.ct = ct;             /* cloud type params reference */
    this.vx = 0;              /* current x drift velocity */
    this.vy = 0;              /* current y drift velocity */
    this.vz = 0;              /* z-axis velocity (scale change rate) */
    this.zScale = 1.0;        /* current z-axis scale (1 = normal) */
    this.merging = false;
    this.mergePartner = null;
    this.mergeProgress = 0;   /* 0 to 1 */
    this.absorbed = false;    /* true = being absorbed into partner */
    this.opacity = 1.0;       /* for fade-in/out */
    this.charCycleOffset = Math.random() * 1000;

    /* Randomized direction — each cloud gets its own trajectory */
    this.dirAngle = 0;        /* movement angle in radians (set by assignDirection) */
    this.dirSpeed = 1.0;      /* speed multiplier */
    this.zDirection = 0;      /* -1 = receding, 0 = neutral, 1 = approaching */

    /* Shape evolution over time */
    this.shapePhase = Math.random() * Math.PI * 2;  /* unique phase offset */
    this.sizeBreathRate = randomRange(0.04, 0.08);   /* slow, gentle size pulse */
    this.sizeBreathAmp = randomRange(0.015, 0.035);  /* very subtle — max 3.5% size change */
    this.warpDrift = randomRange(-0.12, 0.12);       /* gentle noise warp drift */
  }

  /* Assign a random movement direction to a cloud */
  function assignDirection(cloud) {
    var roll = Math.random();
    if (roll < 0.30) {
      /* Right-to-left */
      cloud.dirAngle = Math.PI + randomRange(-0.35, 0.35);
    } else if (roll < 0.60) {
      /* Left-to-right */
      cloud.dirAngle = randomRange(-0.35, 0.35);
    } else if (roll < 0.80) {
      /* Diagonal — any angle with stronger vertical component */
      cloud.dirAngle = randomRange(0, Math.PI * 2);
    } else {
      /* Steep angle — mostly vertical drift */
      cloud.dirAngle = randomRange(-Math.PI * 0.5 - 0.4, -Math.PI * 0.5 + 0.4);
      if (Math.random() < 0.5) cloud.dirAngle += Math.PI;
    }
    cloud.dirSpeed = randomRange(0.6, 1.4);

    /* Z-axis: 30% of clouds approach or recede */
    var zRoll = Math.random();
    if (zRoll < 0.15) {
      cloud.zDirection = 1;   /* approaching — will grow */
    } else if (zRoll < 0.30) {
      cloud.zDirection = -1;  /* receding — will shrink */
    } else {
      cloud.zDirection = 0;   /* neutral z */
    }
  }

  /* ============================================================
     8. CLOUD MANAGER
     Spawns, updates, renders, and handles collision for clouds.
     ============================================================ */

  var clouds = [];
  var MERGE_DISTANCE_FACTOR = 0.08;
  var BRIDGE_GROW_RATE = 0.15;

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

      var cx = randomRange(-cw * 0.3, W + cw * 0.3);
      var cy = cloudZoneH * randomRange(0.2, 0.7);

      var seed = Math.random() * 10000;

      var cloud = new CloudEntity(cx, cy, cw, ch, depth, seed, ct);
      assignDirection(cloud);
      clouds.push(cloud);
    }

    clouds.sort(function (a, b) { return a.depth - b.depth; });
  }

  var Z_SCALE_MIN = 0.75;
  var Z_SCALE_MAX = 1.3;
  var Z_SPEED = 0.008;
  var Z_LATERAL_DRIFT = 0.003;

  function updateClouds(dt) {
    var dtSec = dt / 16.667;
    var tSec = dt * 0.001;

    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      if (c.absorbed && c.opacity <= 0) continue;

      var depthFactor = 0.5 + 0.5 * (c.depth / Math.max(c.ct.depthLayers - 1, 1));
      var baseSpeed = activePreset.cloudDriftSpeed * depthFactor * c.dirSpeed;

      var windInfluence = 0.25;
      var targetVx = Math.cos(c.dirAngle) * baseSpeed + currentWind * windInfluence * baseSpeed;
      var targetVy = Math.sin(c.dirAngle) * baseSpeed * 0.3;

      c.vx = lerp(c.vx, targetVx, 0.008 * dtSec);
      c.vy = lerp(c.vy, targetVy, 0.008 * dtSec);

      c.x += c.vx * dtSec * 0.016;
      c.y += c.vy * dtSec * 0.016;

      if (c.zDirection !== 0) {
        c.zScale += c.zDirection * Z_SPEED * dtSec * 0.016;
        var lateralSign = c.zDirection * (c.dirAngle > 0 ? 1 : -1);
        c.x += lateralSign * Z_LATERAL_DRIFT * baseSpeed * dtSec * 0.016;
        if (c.zScale >= Z_SCALE_MAX) {
          c.zScale = Z_SCALE_MAX;
          c.zDirection = -1;
        } else if (c.zScale <= Z_SCALE_MIN) {
          c.zScale = Z_SCALE_MIN;
          c.zDirection = 1;
        }
      }

      if (tiltPermissionGranted && !isDesktop) {
        c.x += tiltGamma * TILT_CLOUD_INFLUENCE * dtSec * 0.016 * baseSpeed;
      }

      var breathOffset = Math.sin(timeAccum * c.sizeBreathRate + c.shapePhase) * c.sizeBreathAmp;
      c.w = c.baseW * c.zScale * (1 + breathOffset);
      c.h = c.baseH * c.zScale * (1 + breathOffset * 0.6);

      var margin = c.h * 0.3;
      if (c.y < margin) c.y = margin;
      if (c.y > cloudZoneH - margin) c.y = cloudZoneH - margin;

      var pad = 60;
      if (c.x - c.w * 0.5 > W + pad) {
        c.x = -c.w * 0.5 - randomRange(10, 40);
        c.seed = Math.random() * 10000;
        assignDirection(c);
      } else if (c.x + c.w * 0.5 < -pad) {
        c.x = W + c.w * 0.5 + randomRange(10, 40);
        c.seed = Math.random() * 10000;
        assignDirection(c);
      }

      if (c.absorbed) {
        c.opacity = Math.max(0, c.opacity - 0.3 * dtSec * 0.016);
      } else {
        c.opacity = Math.min(1, c.opacity + 0.5 * dtSec * 0.016);
      }
    }

    checkCloudMerging(dtSec);
  }

  function checkCloudMerging(dtSec) {
    for (var i = 0; i < clouds.length; i++) {
      var a = clouds[i];
      if (a.absorbed) continue;

      for (var j = i + 1; j < clouds.length; j++) {
        var b = clouds[j];
        if (b.absorbed) continue;
        if (a.depth !== b.depth) continue;

        var aLeft = a.x - a.w * 0.5;
        var aRight = a.x + a.w * 0.5;
        var bLeft = b.x - b.w * 0.5;
        var bRight = b.x + b.w * 0.5;

        var gap = Math.max(bLeft - aRight, aLeft - bRight);
        var mergeThreshold = (a.w + b.w) * MERGE_DISTANCE_FACTOR;

        if (gap < mergeThreshold) {
          if (!a.merging || a.mergePartner !== b) {
            a.merging = true;
            a.mergePartner = b;
            a.mergeProgress = 0;
            b.merging = true;
            b.mergePartner = a;
            b.mergeProgress = 0;
          }

          a.mergeProgress = Math.min(1, a.mergeProgress + BRIDGE_GROW_RATE * dtSec * 0.016);
          b.mergeProgress = a.mergeProgress;

          if (a.mergeProgress >= 1) {
            var smaller = a.w * a.h < b.w * b.h ? a : b;
            var larger = smaller === a ? b : a;
            smaller.absorbed = true;
            larger.w *= 1.15;
            larger.h *= 1.08;
            larger.merging = false;
            larger.mergePartner = null;
            larger.mergeProgress = 0;
          }
        } else {
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

    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      if (c.absorbed && c.opacity <= 0) {
        var ct = CLOUD_TYPES[activeCloudType];
        var wFrac = randomRange(ct.widthRange[0], ct.widthRange[1]);
        var hFrac = randomRange(ct.heightRange[0], ct.heightRange[1]);
        c.w = W * wFrac;
        c.h = cloudZoneH * hFrac;
        c.seed = Math.random() * 10000;
        assignDirection(c);
        var comingFromLeft = Math.cos(c.dirAngle) > 0;
        c.x = comingFromLeft ? -c.w * 0.5 - randomRange(50, 200) : W + c.w * 0.5 + randomRange(50, 200);
        c.y = cloudZoneH * randomRange(0.2, 0.7);
        c.zScale = 1.0;
        c.baseW = W * randomRange(c.ct.widthRange[0], c.ct.widthRange[1]);
        c.baseH = cloudZoneH * randomRange(c.ct.heightRange[0], c.ct.heightRange[1]);
        c.w = c.baseW;
        c.h = c.baseH;
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
      .getPropertyValue('--color-weather').trim()
      || getComputedStyle(document.documentElement)
        .getPropertyValue('--color-text').trim()
      || '#2a1f2d';

    /* Font setup removed — cloud characters are now drawn from
       pre-rendered sprite cache (cloudSprites) via drawImage(). */

    var windStretch = 1.0 + Math.abs(currentWind) * 0.08;

    if (cloudDensityMap) {
      for (var k = 0; k < cloudDensityMap.length; k++) cloudDensityMap[k] = 0;
    }

    for (var ci = 0; ci < clouds.length; ci++) {
      var c = clouds[ci];
      if (c.absorbed && c.opacity <= 0) continue;

      var depthOpacity = 0.4 + 0.6 * (c.depth / Math.max(c.ct.depthLayers - 1, 1));
      var zOpacity = 0.7 + 0.3 * ((c.zScale - Z_SCALE_MIN) / (Z_SCALE_MAX - Z_SCALE_MIN));
      var baseOpacity = activePreset.cloudOpacity * depthOpacity * zOpacity * c.opacity;

      var cw = c.w * windStretch;
      var ch = c.h;
      var left = Math.floor((c.x - cw * 0.5) / CLOUD_CELL);
      var right = Math.ceil((c.x + cw * 0.5) / CLOUD_CELL);
      var top = Math.floor((c.y - ch * 0.5) / CLOUD_CELL);
      var bottom = Math.ceil((c.y + ch * 0.5) / CLOUD_CELL);

      left = Math.max(0, left);
      right = Math.min(Math.ceil(W / CLOUD_CELL), right);
      top = Math.max(0, top);
      bottom = Math.min(Math.ceil(cloudZoneH / CLOUD_CELL), bottom);

      for (var row = top; row < bottom; row++) {
        for (var col = left; col < right; col++) {
          var px = col * CLOUD_CELL;
          var py = row * CLOUD_CELL;

          var nx = (px - (c.x - cw * 0.5)) / cw;
          var ny = (py - (c.y - ch * 0.5)) / ch;

          var ex = (nx - 0.5) * 2;
          var ey = (ny - 0.5) * 2;
          var ellipse = ex * ex + ey * ey;
          if (ellipse > 1.0) continue;

          var edgeFade = smoothstep(1.0, 0.5, ellipse);

          var warpExtra = c.warpDrift * timeAccum;
          var density = cloudEntityNoise(px, py, timeAccum, c.ct, c.seed, warpExtra);

          density *= edgeFade;

          if (c.ct === CLOUD_TYPES.cumulus || c.ct === CLOUD_TYPES.cumulonimbus) {
            if (ny > 0.65) {
              density *= smoothstep(1.0, 0.65, ny) * 1.3;
            }
          }

          if (density < c.ct.cutoff) continue;

          var norm = (density - c.ct.cutoff) / (1 - c.ct.cutoff);
          var charOpacity = baseOpacity * smoothstep(0, 0.3, norm);

          cloudCtx.globalAlpha = clamp(charOpacity, 0, 1);
          cloudCtx.fillStyle = textColor;

          var ch2 = charFromDensity(norm);
          var sprite = cloudSprites[ch2];
          if (sprite) {
            var halfSz = sprite.width * 0.5;
            cloudCtx.drawImage(sprite, px + CLOUD_CELL * 0.5 - halfSz, py + CLOUD_CELL * 0.5 - halfSz);
          }

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

    renderBridges(textColor, windStretch);

    cloudCtx.globalAlpha = 1;
  }

  function renderBridges(textColor, windStretch) {
    for (var i = 0; i < clouds.length; i++) {
      var a = clouds[i];
      if (!a.merging || !a.mergePartner || a.absorbed) continue;
      var b = a.mergePartner;
      if (b.absorbed) continue;

      if (clouds.indexOf(b) < i) continue;

      var progress = a.mergeProgress;
      if (progress <= 0) continue;

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

          var bx = (px - leftEdge) / Math.max(rightEdge - leftEdge, 1);
          var by = (py - (bridgeY - bridgeH * 0.5)) / Math.max(bridgeH, 1);

          var bridgeDensity = progress * 0.6 *
            (1 - Math.abs(by - 0.5) * 2) *
            (0.3 + 0.7 * (1 - 4 * (bx - 0.5) * (bx - 0.5)));

          bridgeDensity *= 0.5 + 0.5 * ((noise.noise2D(px * 0.03 + timeAccum, py * 0.03) + 1) * 0.5);

          if (bridgeDensity < 0.1) continue;

          cloudCtx.globalAlpha = clamp(bridgeDensity * activePreset.cloudOpacity * 0.7, 0, 1);
          cloudCtx.fillStyle = textColor;
          var bch = randomItem(CLOUD_CHARS_LIGHT);
          var bSprite = cloudSprites[bch];
          if (bSprite) {
            var bHalf = bSprite.width * 0.5;
            cloudCtx.drawImage(bSprite, px + CLOUD_CELL * 0.5 - bHalf, py + CLOUD_CELL * 0.5 - bHalf);
          }
        }
      }
    }
  }

  /* ============================================================
     10. PRE-RENDERED CHARACTER SPRITES (rain + splash + cloud)
     ============================================================ */

  var charSprites = {};
  var splashSprites = {};
  var iceSplashSprites = {};
  var mistSprites = {};
  var spriteReady = false;

  function buildCharSprites(fontSize, color) {
    charSprites = {};
    splashSprites = {};
    iceSplashSprites = {};
    mistSprites = {};

    /* Rain character sprites */
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

    /* Splash character sprites — smaller */
    var splashSize = Math.ceil(fontSize * 0.6);
    for (var i = 0; i < SPLASH_CHARS.length; i++) {
      var c = SPLASH_CHARS[i];
      var off = document.createElement('canvas');
      var sz = Math.ceil(splashSize * 1.4);
      off.width = sz; off.height = sz;
      var octx = off.getContext('2d');
      octx.font = splashSize + 'px "Cormorant Garamond", Georgia, serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = color;
      octx.fillText(c, sz / 2, sz / 2);
      splashSprites[c] = off;
    }

    /* Ice splash character sprites — sharp fragments */
    var iceSplashSize = Math.ceil(fontSize * 0.7);
    for (var i = 0; i < ICE_SPLASH_CHARS.length; i++) {
      var c = ICE_SPLASH_CHARS[i];
      var off = document.createElement('canvas');
      var sz = Math.ceil(iceSplashSize * 1.4);
      off.width = sz; off.height = sz;
      var octx = off.getContext('2d');
      octx.font = iceSplashSize + 'px "Cormorant Garamond", Georgia, serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = color;
      octx.fillText(c, sz / 2, sz / 2);
      iceSplashSprites[c] = off;
    }

    /* Mist character sprites — larger, very faint */
    var mistSize = Math.ceil(fontSize * 1.2);
    for (var i = 0; i < MIST_CHARS.length; i++) {
      var c = MIST_CHARS[i];
      var off = document.createElement('canvas');
      var sz = Math.ceil(mistSize * 1.4);
      off.width = sz; off.height = sz;
      var octx = off.getContext('2d');
      octx.font = mistSize + 'px "Cormorant Garamond", Georgia, serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = color;
      octx.fillText(c, sz / 2, sz / 2);
      mistSprites[c] = off;
    }

    spriteReady = true;
  }

  /* Cloud character sprites — cached to eliminate fillText() in the
     cloud render loop. Same pattern as rain/splash/mist sprites.
     Keyed by character so charFromDensity() output maps directly. */
  var cloudSprites = {};

  function buildCloudSprites(color) {
    cloudSprites = {};
    var fontSize = CLOUD_CELL - 1;
    var sz = Math.ceil(fontSize * 1.4);
    var allCloudChars = CLOUD_CHARS_DENSE.concat(CLOUD_CHARS_MEDIUM, CLOUD_CHARS_LIGHT);
    /* Deduplicate in case sets overlap */
    var seen = {};
    for (var i = 0; i < allCloudChars.length; i++) {
      var c = allCloudChars[i];
      if (seen[c]) continue;
      seen[c] = true;
      var off = document.createElement('canvas');
      off.width = sz; off.height = sz;
      var octx = off.getContext('2d');
      octx.font = fontSize + 'px "Cormorant Garamond", Georgia, serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = color;
      octx.fillText(c, sz / 2, sz / 2);
      cloudSprites[c] = off;
    }
  }

  /* ============================================================
     11. RAINDROP OBJECT POOL (with depth layers)
     ============================================================ */

  function Raindrop() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.char = '1'; this.opacity = 0; this.active = false;
    this.windFactor = 1; this.size = 13;
    this.virgaDrop = false; this.virgaFadeY = 0;
    this.zLayer = 2;          /* 0=far, 1=mid, 2=near */
    this.depthConfig = DEPTH_LAYERS[2];
  }

  Raindrop.prototype.reset = function (x, y, preset, zLayer) {
    this.x = x; this.y = y;
    this.zLayer = (zLayer !== undefined) ? zLayer : 2;
    this.depthConfig = DEPTH_LAYERS[this.zLayer];

    /* Speed scaled by depth — far drops fall slower */
    this.vy = (preset.fallSpeed + randomRange(-preset.fallSpeedVariance, preset.fallSpeedVariance))
              * this.depthConfig.speedMult;
    this.vx = 0;
    this.char = randomItem(RAIN_CHARS);
    /* Opacity scaled by depth — far drops are dimmer */
    this.opacity = preset.rainOpacity * randomRange(0.6, 1.0) * this.depthConfig.opacityMult;
    this.active = true;
    this.windFactor = randomRange(0.8, 1.2) * this.depthConfig.windMult;
    /* Size scaled by depth — far drops are smaller */
    this.size = Math.round((preset.charSize + randomInt(-1, 1)) * this.depthConfig.scale);
    this.virgaDrop = Math.random() < preset.virga;
    this.virgaFadeY = this.virgaDrop ? randomRange(H * 0.3, H * 0.7) : H;
  };

  /* ============================================================
     11b. SPLASH PARTICLE POOL
     Micro-particles that arc upward on raindrop impact.
     Inspired by Geoff Blair's canvas rain demo.
     ============================================================ */

  function SplashParticle() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.char = '.'; this.opacity = 0; this.active = false;
    this.life = 0; this.maxLife = SPLASH_LIFE;
    this.size = 8;
  }

  SplashParticle.prototype.reset = function (x, y) {
    this.x = x;
    this.y = y;
    /* Arc upward and outward — asymmetric spread influenced by wind */
    var angle = randomRange(-Math.PI * 0.85, -Math.PI * 0.15);  /* upward arc */
    var speed = randomRange(SPLASH_SPEED_MIN, SPLASH_SPEED_MAX);
    this.vx = Math.cos(angle) * speed + currentWind * 0.3;
    this.vy = Math.sin(angle) * speed;
    this.char = activePreset.iceSplash ? randomItem(ICE_SPLASH_CHARS) : randomItem(SPLASH_CHARS);
    this.opacity = activePreset.iceSplash ? randomRange(0.20, 0.45) : randomRange(0.15, 0.35);
    this.active = true;
    this.life = 0;
    this.maxLife = activePreset.iceSplash
      ? SPLASH_LIFE * randomRange(1.0, 1.8)  /* ice fragments linger longer */
      : SPLASH_LIFE * randomRange(0.7, 1.3);
    this.size = activePreset.iceSplash ? randomInt(7, 12) : randomInt(6, 10);
  };

  var splashPool = [];
  var splashPoolIndex = 0;

  function initSplashPool() {
    splashPool = [];
    splashPoolIndex = 0;
    for (var i = 0; i < SPLASH_POOL_SIZE; i++) {
      splashPool.push(new SplashParticle());
    }
  }

  function spawnSplash(x, y) {
    var count = randomInt(SPLASH_COUNT_MIN, SPLASH_COUNT_MAX);
    for (var i = 0; i < count; i++) {
      var sp = splashPool[splashPoolIndex];
      sp.reset(x, y);
      splashPoolIndex = (splashPoolIndex + 1) % SPLASH_POOL_SIZE;
    }
  }

  function updateSplashes(dtFactor, dtSec) {
    for (var i = 0; i < splashPool.length; i++) {
      var sp = splashPool[i];
      if (!sp.active) continue;

      sp.life += dtSec;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        continue;
      }

      /* Gravity pulls splash particles back down */
      sp.vy += SPLASH_ARC_GRAVITY * dtSec;
      sp.x += sp.vx * dtFactor;
      sp.y += sp.vy * dtFactor;

      /* Fade out over lifetime */
      var lifeFrac = sp.life / sp.maxLife;
      sp.opacity = (1 - lifeFrac * lifeFrac) * 0.30;  /* quadratic fade */

      /* Kill if off screen */
      if (sp.y > H + 10 || sp.x < -20 || sp.x > W + 20) {
        sp.active = false;
      }
    }
  }

  function drawSplashes() {
    if (!spriteReady) return;

    for (var i = 0; i < splashPool.length; i++) {
      var sp = splashPool[i];
      if (!sp.active || sp.opacity <= 0) continue;

      ctx.globalAlpha = clamp(sp.opacity, 0, 1);

      var sprite = iceSplashSprites[sp.char] || splashSprites[sp.char];
      if (sprite) {
        var halfSize = sp.size * 0.5;
        ctx.drawImage(sprite, ~~(sp.x - halfSize), ~~(sp.y - halfSize), sp.size, sp.size);
      }
    }
  }

  /* ============================================================
     11c. ATMOSPHERIC MIST POOL
     Slow-drifting ground fog for heavy presets.
     ============================================================ */

  function MistParticle() {
    this.x = 0; this.y = 0; this.vx = 0;
    this.char = '.'; this.opacity = 0; this.active = false;
    this.life = 0; this.maxLife = 4; this.size = 16;
  }

  MistParticle.prototype.reset = function () {
    /* Fog mode: mist fills a larger portion of the viewport */
    var zoneFrac = (activePreset.fogMode && activePreset.fogZoneFrac)
      ? activePreset.fogZoneFrac
      : MIST_ZONE_FRAC;
    this.x = randomRange(-50, W + 50);
    this.y = H - H * zoneFrac * randomRange(0, 1);
    this.vx = MIST_DRIFT_SPEED * (currentWind > 0 ? 1 : -1) * randomRange(0.5, 1.5);
    this.char = randomItem(MIST_CHARS);
    this.opacity = 0;
    this.active = true;
    this.life = 0;
    this.maxLife = activePreset.fogMode
      ? randomRange(MIST_LIFE_MIN * 1.5, MIST_LIFE_MAX * 2)  /* fog lingers longer */
      : randomRange(MIST_LIFE_MIN, MIST_LIFE_MAX);
    this.size = activePreset.fogMode ? randomInt(18, 30) : randomInt(14, 22);  /* fog particles larger */
  };

  var mistPool = [];
  var mistSpawnTimer = 0;

  function initMistPool() {
    mistPool = [];
    mistSpawnTimer = 0;
    for (var i = 0; i < MIST_POOL_SIZE; i++) {
      mistPool.push(new MistParticle());
    }
  }

  function updateMist(dtFactor, dtSec) {
    if (!activePreset.mistEnabled) return;

    /* Spawn new mist particles periodically */
    mistSpawnTimer += dtSec;
    var densityMult = activePreset.fogMode ? 12 : 5;  /* fog spawns much faster */
    var spawnInterval = 1.0 / (activePreset.mistDensity * densityMult + 0.5);
    if (mistSpawnTimer >= spawnInterval) {
      mistSpawnTimer = 0;
      /* Find an inactive particle */
      for (var i = 0; i < mistPool.length; i++) {
        if (!mistPool[i].active) {
          mistPool[i].reset();
          break;
        }
      }
    }

    for (var i = 0; i < mistPool.length; i++) {
      var mp = mistPool[i];
      if (!mp.active) continue;

      mp.life += dtSec;
      if (mp.life >= mp.maxLife) {
        mp.active = false;
        continue;
      }

      /* Drift with wind */
      mp.vx = lerp(mp.vx, currentWind * MIST_DRIFT_SPEED * 2, 0.01 * dtFactor);
      mp.x += mp.vx * dtFactor;

      /* Gentle vertical drift — mist rises slightly */
      mp.y -= 0.05 * dtFactor;

      /* Fade in, sustain, fade out */
      var lifeFrac = mp.life / mp.maxLife;
      if (lifeFrac < 0.15) {
        mp.opacity = smoothstep(0, 0.15, lifeFrac) * activePreset.mistDensity * 0.12;
      } else if (lifeFrac > 0.7) {
        mp.opacity = smoothstep(1, 0.7, lifeFrac) * activePreset.mistDensity * 0.12;
      } else {
        mp.opacity = activePreset.mistDensity * (activePreset.fogMode ? 0.18 : 0.12);
      }

      /* Kill if off screen */
      if (mp.x < -80 || mp.x > W + 80) {
        mp.active = false;
      }
    }
  }

  function drawMist() {
    if (!spriteReady || !activePreset.mistEnabled) return;

    for (var i = 0; i < mistPool.length; i++) {
      var mp = mistPool[i];
      if (!mp.active || mp.opacity <= 0) continue;

      ctx.globalAlpha = clamp(mp.opacity, 0, 1);

      var sprite = mistSprites[mp.char];
      if (sprite) {
        var halfSize = mp.size * 0.5;
        ctx.drawImage(sprite, ~~(mp.x - halfSize), ~~(mp.y - halfSize), mp.size, mp.size);
      }
    }
  }

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

  /* ---- AAA Wind state (Horizon Zero Dawn 3-layer model) ---- */
  var windBaseDirection = 1;           /* 1 = right, -1 = left */
  var windBaseShiftTimer = 0;          /* time until next direction shift */
  var windBaseShiftDuration = 0;       /* how long the current direction lasts */
  var gustPhase = 'lull';              /* 'lull' | 'onset' | 'peak' | 'decay' */
  var gustTimer = 0;                   /* time within current gust phase */
  var gustPhaseDuration = 0;           /* duration of current phase */
  var gustEnvelope = 0;                /* 0 to 1 — current gust strength multiplier */
  var gustDirection = 1;               /* gust can push in different direction from base */

  function initWindState() {
    windBaseDirection = Math.random() < 0.5 ? 1 : -1;
    windBaseShiftTimer = 0;
    windBaseShiftDuration = randomRange(25, 60);  /* 25-60 seconds per direction */
    gustPhase = 'lull';
    gustTimer = 0;
    gustPhaseDuration = randomRange(5, 15);       /* initial lull: 5-15 seconds */
    gustEnvelope = 0;
    gustDirection = windBaseDirection;
  }

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

    cloudDensityCols = Math.ceil(W / CLOUD_CELL);
    cloudDensityRows = Math.ceil(cloudZoneH / CLOUD_CELL);
    cloudDensityMap = new Float32Array(cloudDensityCols * cloudDensityRows);
  }

  function initDrops() {
    var count = activePreset.dropCount;
    drops = [];
    for (var i = 0; i < count; i++) {
      var drop = new Raindrop();
      /* Assign depth layer based on DEPTH_LAYERS fractions */
      var r = Math.random();
      var zLayer = 2;
      var cumFrac = 0;
      for (var z = 0; z < DEPTH_LAYERS.length; z++) {
        cumFrac += DEPTH_LAYERS[z].fraction;
        if (r < cumFrac) { zLayer = z; break; }
      }
      spawnDrop(drop, true, zLayer);
      drops.push(drop);
    }
  }

  function spawnDrop(drop, initialScatter, zLayer) {
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

    drop.reset(spawnX, spawnY, activePreset, zLayer);

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

  function onTouchStart(e) {
    updateTouchPoints(e);
    requestTiltPermission();
  }
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
     13. PHYSICS — DEFLECTION (umbrella + touch)

     Realistic umbrella collision with:
     - Surface normal reflection (v' = v - 2·dot(v,n)·n)
     - Energy-absorbing restitution (coefficient < 1)
     - Position-dependent deflection angle
     - Wind-influenced post-collision scatter
     - Impact splash particles at collision point
     - Edge drip particles from umbrella rim
     - Depth layer filtering (only foreground drops collide)

     References:
     - Surface normals: GameDev StackExchange #136073
     - Reflection formula: v_reflected = v - 2·dot(v,n)·n
     - Restitution: Cyanilux rain effects breakdown
     - Edge drips: Cyanilux umbrella rim particle system
     - Impact splashes: 80 Level "How Rain Works in Video Games"
     - Quality criteria: Rock Paper Shotgun rain grading
     ============================================================ */

  /**
   * spawnUmbrellaSplash — spawn micro-splash particles at the umbrella
   * collision point. Reuses the existing splash pool but with adjusted
   * parameters: smaller, shorter-lived, and angled along the surface normal.
   */
  function spawnUmbrellaSplash(cx, cy, nx, ny) {
    var count = randomInt(UMBRELLA_SPLASH_COUNT[0], UMBRELLA_SPLASH_COUNT[1]);
    for (var i = 0; i < count; i++) {
      var sp = splashPool[splashPoolIndex];
      sp.x = cx;
      sp.y = cy;
      /* Splash outward along the surface normal with spread */
      var spreadAngle = Math.atan2(ny, nx) + randomRange(-0.6, 0.6);
      var speed = randomRange(0.6, 1.4);
      sp.vx = Math.cos(spreadAngle) * speed + currentWind * 0.2;
      sp.vy = Math.sin(spreadAngle) * speed;
      sp.char = randomItem(SPLASH_CHARS);
      sp.opacity = randomRange(0.12, 0.28);
      sp.active = true;
      sp.life = 0;
      sp.maxLife = SPLASH_LIFE * randomRange(0.5, 0.9);  /* shorter than ground splash */
      sp.size = randomInt(5, 8);  /* smaller than ground splash */
      splashPoolIndex = (splashPoolIndex + 1) % SPLASH_POOL_SIZE;
    }
  }

  /**
   * spawnUmbrellaDrip — spawn a slow-falling drip particle from the
   * umbrella rim. Simulates water accumulating and dripping off the edge.
   * Uses the splash pool with drip-specific parameters.
   */
  function spawnUmbrellaDrip(edgeX, edgeY) {
    var sp = splashPool[splashPoolIndex];
    sp.x = edgeX;
    sp.y = edgeY;
    /* Drips fall nearly straight down with slight wind influence */
    sp.vx = currentWind * 0.15 + randomRange(-0.1, 0.1);
    sp.vy = UMBRELLA_DRIP_SPEED + randomRange(0, 0.3);
    sp.char = randomItem(SPLASH_CHARS);
    sp.opacity = randomRange(0.15, 0.30);
    sp.active = true;
    sp.life = 0;
    sp.maxLife = UMBRELLA_DRIP_LIFE * randomRange(0.8, 1.2);
    sp.size = randomInt(6, 9);
    splashPoolIndex = (splashPoolIndex + 1) % SPLASH_POOL_SIZE;
  }

  function applyUmbrellaDeflection(drop) {
    if (!mouseActive) return;

    /* Depth filtering — only foreground drops (zLayer 2) collide.
       Background/midground drops pass behind the umbrella for parallax. */
    if (drop.zLayer !== 2) return;

    var dx = drop.x - mouseX, dy = drop.y - mouseY;
    var distSq = dx * dx + dy * dy;
    var radiusSq = UMBRELLA_RADIUS * UMBRELLA_RADIUS;

    /* Early exit — squared distance check avoids sqrt for distant drops */
    if (distSq > (UMBRELLA_RADIUS + UMBRELLA_SOFT_EDGE) * (UMBRELLA_RADIUS + UMBRELLA_SOFT_EDGE)) return;
    if (distSq < 1) return;

    var dist = Math.sqrt(distSq);
    var angle = Math.atan2(dy, dx);

    /* Only the top arc deflects rain (angle between -π and 0) */
    if (angle >= UMBRELLA_ARC_END || angle <= UMBRELLA_ARC_START) return;

    /* Surface normal — for a circle, it's the normalized vector from center to point */
    var nx = dx / dist;
    var ny = dy / dist;

    /* Velocity component along the normal (negative = approaching) */
    var vDotN = drop.vx * nx + drop.vy * ny;
    if (vDotN >= 0) return;  /* moving away from center — no collision */

    /* ---- Soft edge transition ---- */
    /* Drops in the soft edge zone get partial deflection (gradual, not binary) */
    var deflectionStrength = 1.0;
    if (dist > UMBRELLA_RADIUS) {
      deflectionStrength = 1.0 - (dist - UMBRELLA_RADIUS) / UMBRELLA_SOFT_EDGE;
      if (deflectionStrength <= 0) return;
    }

    /* ---- Position-dependent restitution ---- */
    /* Center of arc (angle ≈ -π/2) = more bounce, edges = more slide */
    var centeredness = Math.abs(angle + Math.PI * 0.5) / (Math.PI * 0.5);  /* 0=center, 1=edge */
    var restitution = UMBRELLA_RESTITUTION * (1.0 - centeredness * 0.4);  /* edges absorb more */

    /* ---- Reflection: v' = v - (1 + e) * dot(v, n) * n ---- */
    var reflectFactor = (1 + restitution) * vDotN * deflectionStrength;
    drop.vx -= reflectFactor * nx;
    drop.vy -= reflectFactor * ny;

    /* ---- Wind-influenced scatter ---- */
    /* Post-collision scatter follows the prevailing wind direction */
    var windScatter = currentWind * 0.25 * deflectionStrength;
    drop.vx += windScatter + randomRange(-0.2, 0.2) * deflectionStrength;
    drop.vy += randomRange(-0.15, 0.1) * deflectionStrength;

    /* ---- Position correction — push drop outside the collision zone ---- */
    drop.x = mouseX + nx * (UMBRELLA_RADIUS + 3);
    drop.y = mouseY + ny * (UMBRELLA_RADIUS + 3);

    /* ---- Impact splash particles ---- */
    if (Math.random() < UMBRELLA_SPLASH_CHANCE * deflectionStrength) {
      var splashX = mouseX + nx * UMBRELLA_RADIUS;
      var splashY = mouseY + ny * UMBRELLA_RADIUS;
      spawnUmbrellaSplash(splashX, splashY, nx, ny);
    }

    /* ---- Edge drip accumulation ---- */
    umbrellaHitCount++;

    /* Drips only start after enough water has accumulated */
    if (umbrellaHitCount > UMBRELLA_DRIP_THRESHOLD) {
      /* Check if this hit is near the edge of the arc */
      var edgeDist = Math.min(Math.abs(angle - UMBRELLA_ARC_END), Math.abs(angle - UMBRELLA_ARC_START));
      if (edgeDist < UMBRELLA_EDGE_ANGLE && Math.random() < UMBRELLA_DRIP_CHANCE) {
        /* Spawn drip at the rim point */
        var dripX = mouseX + nx * (UMBRELLA_RADIUS + 1);
        var dripY = mouseY + ny * (UMBRELLA_RADIUS + 1);
        spawnUmbrellaDrip(dripX, dripY);
        /* Partially reset accumulation (water was released) */
        umbrellaHitCount = Math.max(0, umbrellaHitCount - 3);
      }
    }
  }

  function applyTouchDeflection(drop) {
    /* Touch deflection — enhanced with depth filtering and splash feedback */
    if (drop.zLayer !== 2) return;  /* only foreground drops */

    for (var i = 0; i < touchPoints.length; i++) {
      var tp = touchPoints[i];
      var dx = drop.x - tp.x, dy = drop.y - tp.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < TOUCH_RADIUS && dist > 1) {
        var nx = dx / dist, ny = dy / dist;
        var vDotN = drop.vx * nx + drop.vy * ny;

        if (vDotN < 0) {
          /* Reflection with energy absorption */
          var reflectFactor = (1 + UMBRELLA_RESTITUTION) * vDotN;
          drop.vx -= reflectFactor * nx;
          drop.vy -= reflectFactor * ny;

          /* Wind scatter */
          drop.vx += currentWind * 0.2;

          /* Push outside */
          drop.x = tp.x + nx * (TOUCH_RADIUS + 2);
          drop.y = tp.y + ny * (TOUCH_RADIUS + 2);

          /* Splash at touch collision point */
          if (Math.random() < UMBRELLA_SPLASH_CHANCE * 0.4) {
            var splashX = tp.x + nx * TOUCH_RADIUS;
            var splashY = tp.y + ny * TOUCH_RADIUS;
            spawnUmbrellaSplash(splashX, splashY, nx, ny);
          }
        }
      }
    }
  }

  /* ============================================================
     14. AAA WIND ENGINE
     Three-layer wind model inspired by Guerrilla Games'
     Horizon Zero Dawn wind system (Gilbert Sanders).

     Layer 1: Base wind — slow directional drift that shifts over minutes
     Layer 2: Gust envelope — asymmetric build/peak/decay cycle with lulls
     Layer 3: Turbulence — Perlin noise micro-variation (Bandi 2017 Δt^2/3)

     References:
     - Gajatix Studios: gajatixstudios.co.uk/news/bright-life-devlog-...
     - APS Physics: physics.aps.org/articles/v10/s5
     - FESSTVaL: fesstval.de/en/campaign/wind-gusts
     - Michael Bromley: michaelbromley.co.uk/blog/simple-1d-noise
     ============================================================ */

  function updateWind(dtFactor, dtSec) {
    if (!activePreset.gustEnabled) {
      /* Non-gust presets: gentle constant wind with subtle noise variation */
      var turbulence = windNoise.noise2D(timeAccum * 0.5, 0) * 0.15;
      targetWind = activePreset.windSpeed * windBaseDirection + turbulence;
      currentWind = lerp(currentWind, targetWind, 0.02 * dtFactor);
      return;
    }

    /* ---- Layer 1: Base wind direction shift ---- */
    windBaseShiftTimer += dtSec;
    if (windBaseShiftTimer >= windBaseShiftDuration) {
      /* Shift direction — not always a full reversal, sometimes just a reduction */
      var shiftRoll = Math.random();
      if (shiftRoll < 0.4) {
        windBaseDirection *= -1;  /* full reversal */
      } else if (shiftRoll < 0.7) {
        windBaseDirection *= 0.3;  /* significant weakening */
      }
      /* Normalize back to -1 or 1 range */
      if (Math.abs(windBaseDirection) < 0.5) {
        windBaseDirection = Math.random() < 0.5 ? 1 : -1;
      } else {
        windBaseDirection = windBaseDirection > 0 ? 1 : -1;
      }
      windBaseShiftTimer = 0;
      windBaseShiftDuration = randomRange(20, 50);
    }

    var baseWind = activePreset.windSpeed * windBaseDirection;

    /* ---- Layer 2: Asymmetric gust envelope ---- */
    /* Real gusts: 3-20s duration, build fast, decay slow, then lull (FESSTVaL) */
    gustTimer += dtSec;

    if (gustPhase === 'lull') {
      gustEnvelope = lerp(gustEnvelope, 0, 0.03 * dtFactor);
      if (gustTimer >= gustPhaseDuration) {
        gustPhase = 'onset';
        gustTimer = 0;
        gustPhaseDuration = randomRange(1.0, 3.0);  /* onset: 1-3 seconds (fast build) */
        /* Gust direction: usually same as base, occasionally cross-wind */
        gustDirection = (Math.random() < 0.8) ? windBaseDirection : -windBaseDirection;
      }
    } else if (gustPhase === 'onset') {
      /* Fast build — asymmetric: gusts build faster than they decay */
      var onsetProgress = gustTimer / gustPhaseDuration;
      gustEnvelope = smoothstep(0, 1, onsetProgress);
      if (gustTimer >= gustPhaseDuration) {
        gustPhase = 'peak';
        gustTimer = 0;
        gustPhaseDuration = randomRange(2.0, 5.0);  /* peak: 2-5 seconds */
      }
    } else if (gustPhase === 'peak') {
      /* Sustained peak with slight turbulent variation */
      gustEnvelope = 0.85 + windNoise.noise2D(timeAccum * 2, 5.0) * 0.15;
      if (gustTimer >= gustPhaseDuration) {
        gustPhase = 'decay';
        gustTimer = 0;
        gustPhaseDuration = randomRange(3.0, 7.0);  /* decay: 3-7 seconds (slow fade) */
      }
    } else if (gustPhase === 'decay') {
      /* Slow decay — takes longer than onset */
      var decayProgress = gustTimer / gustPhaseDuration;
      gustEnvelope = smoothstep(1, 0, decayProgress);
      if (gustTimer >= gustPhaseDuration) {
        gustPhase = 'lull';
        gustTimer = 0;
        gustPhaseDuration = randomRange(4, 15);  /* lull: 4-15 seconds */
      }
    }

    var gustWind = gustEnvelope * activePreset.gustStrength * gustDirection;

    /* ---- Layer 3: Perlin noise turbulence ---- */
    /* High-frequency micro-variation that prevents mechanical feel.
       Uses Simplex noise which has spectral properties similar to the
       Δt^(2/3) turbulence model (Bandi 2017). */
    var turb1 = windNoise.noise2D(timeAccum * 0.8, 0) * 0.3;
    var turb2 = windNoise.noise2D(timeAccum * 2.5, 10.0) * 0.12;
    var turbulence = (turb1 + turb2) * activePreset.gustStrength * 0.5;

    /* ---- Combine all three layers ---- */
    targetWind = baseWind + gustWind + turbulence;

    /* Smooth transition — wind doesn't snap instantly */
    currentWind = lerp(currentWind, targetWind, 0.04 * dtFactor);
  }

  /* ============================================================
     14b. PROCEDURAL LIGHTNING SYSTEM
     Midpoint Displacement algorithm for branching bolts.
     Rendered with ASCII line-drawing characters.
     Reference: GameDev StackExchange #71397
     ============================================================ */

  var lightningBolts = [];     /* array of active bolt objects */
  var lightningTimer = 0;      /* countdown to next strike */
  var lightningNextAt = 0;     /* seconds until next strike */
  var lightningFlashAlpha = 0; /* screen flash overlay */

  function initLightning() {
    lightningBolts = [];
    lightningFlashAlpha = 0;
    if (activePreset.lightningEnabled) {
      var interval = activePreset.lightningInterval || [4, 12];
      lightningNextAt = randomRange(interval[0], interval[1]);
      lightningTimer = 0;
    }
  }

  /* Midpoint displacement: recursively bisect a line segment,
     displacing the midpoint perpendicular to the segment.
     Returns an array of {x, y} points forming the bolt path. */
  function generateBoltPath(x1, y1, x2, y2, displacement, depth, maxDepth) {
    if (depth >= maxDepth || displacement < 2) {
      return [{x: x1, y: y1}, {x: x2, y: y2}];
    }

    var midX = (x1 + x2) * 0.5;
    var midY = (y1 + y2) * 0.5;

    /* Perpendicular displacement */
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return [{x: x1, y: y1}, {x: x2, y: y2}];

    /* Perpendicular unit vector */
    var px = -dy / len;
    var py = dx / len;

    var offset = (Math.random() - 0.5) * displacement;
    midX += px * offset;
    midY += py * offset;

    var left = generateBoltPath(x1, y1, midX, midY, displacement * 0.55, depth + 1, maxDepth);
    var right = generateBoltPath(midX, midY, x2, y2, displacement * 0.55, depth + 1, maxDepth);

    /* Merge, removing duplicate midpoint */
    return left.concat(right.slice(1));
  }

  /* Generate branches that fork off the main bolt */
  function generateBranches(mainPath, maxBranches) {
    var branches = [];
    var branchCount = randomInt(1, maxBranches);

    for (var b = 0; b < branchCount; b++) {
      /* Pick a random point along the main bolt (top 70% — branches don't start near ground) */
      var idx = randomInt(Math.floor(mainPath.length * 0.1), Math.floor(mainPath.length * 0.7));
      var origin = mainPath[idx];

      /* Branch direction: roughly downward with horizontal spread */
      var branchAngle = randomRange(-Math.PI * 0.6, Math.PI * 0.6) + Math.PI * 0.5;
      var branchLen = randomRange(40, 150);
      var endX = origin.x + Math.cos(branchAngle) * branchLen;
      var endY = origin.y + Math.sin(branchAngle) * branchLen;

      var branchPath = generateBoltPath(origin.x, origin.y, endX, endY, branchLen * 0.3, 0, 4);
      branches.push({
        path: branchPath,
        opacity: randomRange(0.3, 0.6),
        width: randomRange(0.5, 1.5)
      });
    }
    return branches;
  }

  function spawnLightningBolt() {
    /* Start point: random position in the cloud zone */
    var startX = randomRange(W * 0.15, W * 0.85);
    var startY = randomRange(10, cloudZoneH * 0.5);

    /* End point: ground level with some horizontal drift */
    var endX = startX + randomRange(-W * 0.15, W * 0.15);
    var endY = H - randomRange(5, 30);

    /* Initial displacement proportional to bolt length */
    var boltLen = Math.sqrt((endX - startX) * (endX - startX) + (endY - startY) * (endY - startY));
    var displacement = boltLen * 0.25;

    var mainPath = generateBoltPath(startX, startY, endX, endY, displacement, 0, 7);
    var maxBranches = (activePreset.lightningBranches || 3);
    var branches = generateBranches(mainPath, maxBranches);

    lightningBolts.push({
      main: mainPath,
      branches: branches,
      life: 0,
      maxLife: randomRange(0.12, 0.25),  /* 120-250ms visible */
      flickerPhase: 0,
      opacity: 1.0,
      width: randomRange(1.5, 3.0)
    });

    /* Screen flash */
    lightningFlashAlpha = randomRange(0.08, 0.18);
  }

  function updateLightning(dtSec) {
    if (!activePreset.lightningEnabled) return;

    /* Timer for next strike */
    lightningTimer += dtSec;
    if (lightningTimer >= lightningNextAt) {
      spawnLightningBolt();
      lightningTimer = 0;
      var interval = activePreset.lightningInterval || [4, 12];
      lightningNextAt = randomRange(interval[0], interval[1]);

      /* Occasionally double-strike (rapid follow-up) */
      if (Math.random() < 0.25) {
        setTimeout(function () {
          if (activePreset.lightningEnabled) spawnLightningBolt();
        }, randomRange(50, 150));
      }
    }

    /* Update active bolts */
    for (var i = lightningBolts.length - 1; i >= 0; i--) {
      var bolt = lightningBolts[i];
      bolt.life += dtSec;
      bolt.flickerPhase += dtSec;

      if (bolt.life >= bolt.maxLife) {
        lightningBolts.splice(i, 1);
        continue;
      }

      /* Rapid flickering — lightning doesn't glow steadily */
      var lifeFrac = bolt.life / bolt.maxLife;
      var flicker = Math.sin(bolt.flickerPhase * 80) * 0.3 + 0.7;
      bolt.opacity = (1 - lifeFrac * lifeFrac) * flicker;
    }

    /* Decay screen flash */
    if (lightningFlashAlpha > 0) {
      lightningFlashAlpha *= 0.88;  /* fast exponential decay */
      if (lightningFlashAlpha < 0.005) lightningFlashAlpha = 0;
    }
  }

  function drawLightning() {
    if (lightningBolts.length === 0 && lightningFlashAlpha <= 0) return;

    /* Screen flash overlay */
    if (lightningFlashAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = lightningFlashAlpha;
      ctx.fillStyle = '#f0e8ff';  /* pale violet-white flash */
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    /* Draw bolts */
    for (var b = 0; b < lightningBolts.length; b++) {
      var bolt = lightningBolts[b];
      if (bolt.opacity <= 0) continue;

      /* Main bolt — bright core */
      ctx.save();
      ctx.globalAlpha = clamp(bolt.opacity, 0, 1);
      ctx.strokeStyle = '#f8f0ff';
      ctx.lineWidth = bolt.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#d4c0ff';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(bolt.main[0].x, bolt.main[0].y);
      for (var p = 1; p < bolt.main.length; p++) {
        ctx.lineTo(bolt.main[p].x, bolt.main[p].y);
      }
      ctx.stroke();

      /* Glow pass — wider, dimmer */
      ctx.globalAlpha = clamp(bolt.opacity * 0.4, 0, 1);
      ctx.strokeStyle = '#c8b0e8';
      ctx.lineWidth = bolt.width * 3;
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.moveTo(bolt.main[0].x, bolt.main[0].y);
      for (var p = 1; p < bolt.main.length; p++) {
        ctx.lineTo(bolt.main[p].x, bolt.main[p].y);
      }
      ctx.stroke();

      /* Branches — thinner, dimmer */
      for (var br = 0; br < bolt.branches.length; br++) {
        var branch = bolt.branches[br];
        ctx.globalAlpha = clamp(bolt.opacity * branch.opacity, 0, 1);
        ctx.strokeStyle = '#e0d4f0';
        ctx.lineWidth = branch.width;
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(branch.path[0].x, branch.path[0].y);
        for (var p = 1; p < branch.path.length; p++) {
          ctx.lineTo(branch.path[p].x, branch.path[p].y);
        }
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  /* ============================================================
     15. ANIMATION LOOP
     ============================================================ */

  function loop(timestamp) {
    if (!running || paused) {
      if (paused) animId = requestAnimationFrame(loop);
      return;
    }

    var dt = timestamp - lastTime;
    lastTime = timestamp;
    if (dt > MAX_DELTA) dt = MAX_DELTA;

    var dtFactor = dt / 16.667;
    var dtSec = dt * 0.001;
    timeAccum += dtSec;

    ctx.clearRect(0, 0, W, H);

    /* Wind */
    updateWind(dtFactor, dtSec);

    /* Clouds — update entities every frame, render periodically */
    updateClouds(dt);
    cloudFieldTimer += dt;
    if (cloudFieldTimer >= CLOUD_FIELD_INTERVAL) {
      renderClouds();
      cloudFieldTimer = 0;
    }
    ctx.drawImage(cloudCanvas, 0, 0, W * dpi, cloudZoneH * dpi, 0, 0, W, cloudZoneH);

    /* Mist (behind rain for depth) */
    updateMist(dtFactor, dtSec);
    drawMist();

    /* Rain */
    updateDrops(dtFactor, dtSec);
    drawDrops();

    /* Splashes (on top of rain) */
    updateSplashes(dtFactor, dtSec);
    drawSplashes();

    /* Lightning (on top of everything) */
    updateLightning(dtSec);
    drawLightning();

    ctx.globalAlpha = 1;

    animId = requestAnimationFrame(loop);
  }

  function updateDrops(dtFactor, dtSec) {
    for (var i = 0; i < drops.length; i++) {
      var drop = drops[i];
      if (!drop.active) { spawnDrop(drop, false, drop.zLayer); continue; }

      drop.vy += 0.02 * dtFactor;

      var heightFactor = 0.3 + 0.7 * clamp(1 - drop.y / H, 0, 1);
      var effectiveWind = currentWind * drop.windFactor * heightFactor;

      /* Tilt influence on rain (mobile only) */
      if (tiltPermissionGranted && !isDesktop) {
        effectiveWind += tiltGamma * TILT_WIND_INFLUENCE;
      }

      drop.vx = lerp(drop.vx, effectiveWind, 0.05 * dtFactor);

      if (isDesktop) applyUmbrellaDeflection(drop);
      else applyTouchDeflection(drop);

      drop.vx *= 0.995;
      drop.x += drop.vx * dtFactor;
      drop.y += drop.vy * dtFactor;

      if (drop.virgaDrop && drop.y > drop.virgaFadeY) {
        var vp = (drop.y - drop.virgaFadeY) / (H * 0.15);
        drop.opacity = activePreset.rainOpacity * drop.depthConfig.opacityMult * (1 - vp);
        if (drop.opacity <= 0) { drop.active = false; continue; }
      }

      var fadeStart = H * (1 - BOTTOM_FADE_ZONE);
      if (drop.y > fadeStart && !drop.virgaDrop) {
        var fp = (drop.y - fadeStart) / (H * BOTTOM_FADE_ZONE);
        drop.opacity = activePreset.rainOpacity * drop.depthConfig.opacityMult * (1 - fp) * randomRange(0.6, 1.0);
      }

      /* Check if drop has reached the ground — spawn splash for foreground drops */
      if (drop.y > H - 10 && drop.zLayer === 2 && !drop.virgaDrop) {
        if (Math.random() < SPLASH_SPAWN_CHANCE) {
          spawnSplash(drop.x, H - randomRange(2, 8));
        }
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

        /* Per-drop rotation variance — slight randomization around wind angle */
        var dropAngle = windAngle * 0.5 + (drop.windFactor - 1) * 0.3;

        ctx.save();
        ctx.translate(~~drop.x, ~~drop.y);
        ctx.rotate(dropAngle);
        ctx.drawImage(sprite, -halfSize, -halfSize, drop.size, drop.size);
        ctx.restore();
      }
    }
  }

  /* ============================================================
     16. DEVICE TILT (mobile only)
     ============================================================ */

  function handleOrientation(e) {
    tiltGamma = clamp(e.gamma || 0, -45, 45);
    tiltBeta  = clamp(e.beta  || 0, -45, 45);
  }

  var tiltPermRequested = false;

  function requestTiltPermission() {
    if (tiltPermissionGranted || tiltPermRequested) return;
    if (typeof DeviceOrientationEvent === 'undefined') return;
    if (typeof DeviceOrientationEvent.requestPermission !== 'function') return;

    tiltPermRequested = true;
    DeviceOrientationEvent.requestPermission()
      .then(function (state) {
        if (state === 'granted') {
          tiltPermissionGranted = true;
          window.addEventListener('deviceorientation', handleOrientation, { passive: true });
        }
      })
      .catch(function (err) {
        if (typeof console !== 'undefined') {
          console.log('[Rain] Tilt permission denied:', err);
        }
      });
  }

  function setupTilt() {
    if (isDesktop) return;

    if (typeof DeviceOrientationEvent === 'undefined') return;

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      /* iOS 13+ — permission will be requested on first touch
         via requestTiltPermission(), which is called from
         onTouchStart in setupInteraction(). */
    } else {
      tiltPermissionGranted = true;
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
    }
  }

  /* ============================================================
     17. LIFECYCLE
     ============================================================ */

  function init() {
    selectPreset();
    setupCanvas();

    var weatherColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-weather').trim()
      || getComputedStyle(document.documentElement)
        .getPropertyValue('--color-text').trim()
      || '#2a1f2d';
    buildCharSprites(activePreset.charSize, weatherColor);
    buildCloudSprites(weatherColor);

    spawnClouds();
    initDrops();
    initSplashPool();
    initMistPool();
    initWindState();
    initLightning();
    setupInteraction();
    setupTilt();

    /* Respect prefers-reduced-motion */
    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      paused = true;
    }

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
        var resizeColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--color-weather').trim()
          || getComputedStyle(document.documentElement)
            .getPropertyValue('--color-text').trim()
          || '#2a1f2d';
        buildCharSprites(activePreset.charSize, resizeColor);
        buildCloudSprites(resizeColor);
      }

      for (var i = 0; i < drops.length; i++) {
        if (drops[i].x > W || drops[i].y > H) drops[i].active = false;
      }
    }, RESIZE_DEBOUNCE);
  });

  /* ============================================================
     THEME CHANGE DETECTION
     Watch for data-time-theme attribute changes on <html>.
     When the theme changes, rebuild rain/splash/mist/cloud sprites
     with the new --color-weather value so they always contrast
     with the background.
     ============================================================ */

  var lastWeatherColor = '';

  function onThemeChange() {
    var style = getComputedStyle(document.documentElement);
    var newColor = style.getPropertyValue('--color-weather').trim()
      || style.getPropertyValue('--color-text').trim()
      || '#2a1f2d';

    if (newColor !== lastWeatherColor) {
      lastWeatherColor = newColor;
      buildCharSprites(activePreset.charSize, newColor);
      buildCloudSprites(newColor);
    }
  }

  /* MutationObserver on <html> to detect data-time-theme changes */
  if (typeof MutationObserver !== 'undefined') {
    var themeObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === 'data-time-theme') {
          /* Small delay to let CSS variables propagate */
          setTimeout(onThemeChange, 50);
          break;
        }
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true });
  }

  /* Expose read-only weather state for other modules (e.g. wet text effect) */
  window.rainWeather = {
    get activePreset() { return activePreset; },
    set activePreset(p) { activePreset = p; activeCloudType = p.cloudType; },
    presets: WEATHER_PRESETS,
    getPreset: function () { return activePreset; },
    getPresets: function () { return WEATHER_PRESETS; },
    getWind: function () { return currentWind; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
