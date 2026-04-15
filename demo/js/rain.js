/* ============================================================
   RAIN.JS — Procedural Weather System v5
   Individual cloud entities with depth, drift, collision/merging,
   continuous Unicode rain, AAA wind physics, splash particles,
   volumetric rain depth, atmospheric mist, and celestial bodies
   (sun + moon with real lunar calendar sync).

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
   - Unicode sun with 5-zone rendering (core/inner/rays/corona/glow)
   - Unicode moon with 3-zone rendering (core/surface/glow)
   - Real lunar phase calculation synced to calendar date
   - Theme-aware Rayleigh scattering colors with contrast enforcement
   - Weather interactions: cloud occlusion, rain curtain, fog halos,
     snow whiteout, dust color shift, wind-shifted cloud gaps
   - Weather presets randomly selected per visit
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
   - Lunar phase: voidware.com/moon_phase.htm, gist.github.com/endel
   - Moon rise/set by phase: itu.physics.uiowa.edu/labs/observational
   - Rayleigh scattering: hyperphysics.phy-astr.gsu.edu/hbase/atmos
   - WCAG contrast: w3.org/TR/WCAG21/#contrast-minimum
   - Cloud types: NOAA NESDIS
   - Weather phenomena: NOAA JetStream
   - Moon through clouds: earthsky.org
   - Halo/corona optics: fullmoon.info, naturalnavigator.com
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
  var ICE_SPLASH_CHARS = ['*', '+', '\u2022', '\u00D7', '\u2219', '\u2716\uFE0E'];

  /* ============================================================
     2b. CELESTIAL BODY CONFIGURATION
     Sun and moon character sets, sizes, and timing constants.
     ============================================================ */

  var SUNRISE_HOUR = 5.0;
  var SUNSET_HOUR  = 20.0;
  var SUN_CELL = 10;           /* px per character cell for celestial rendering */

  /* Sun character sets — 5 concentric zones
     VS15 (\uFE0E) appended to chars with emoji variants to force text presentation.
     This prevents iOS/Android from rendering color emoji that ignore fillStyle.
     Ref: https://jeffkreeftmeijer.com/unicode-variation-selectors/
     Ref: https://character.construction/emoji-vs-text                          */
  var SUN_CORE   = ['\u2739','\u2609\uFE0E','\u25C9','\u25CF','\u2299','\u25CE','\u2600\uFE0E'];
  var SUN_INNER  = ['\u2726','\u2727','\u2736','\u2737','\u2738','\u274B','\u274A','\u2749','\u273A','\u273B','\u273C','\u203B','\u2055'];
  var SUN_RAYS   = ['/','\\','|','\u2014','\u2571','\u2572','\u2502','\u2500','*','+','\u00B7','\u2022\uFE0E','\u2219'];
  var SUN_CORONA = ['\u00B7','\u2022\uFE0E','\u2219','\u22C5','\u02D9','\u00B0','\u204E','\u2055','*','\'',',','.','`'];
  var SUN_GLOW   = ['.',',','\'','`','\u00B7',' ','\u02D9','\u00B0'];

  /* Moon character sets — 3 concentric zones + phase-specific cores
     VS15 appended to crescent/quarter chars that have emoji variants.       */
  var MOON_CORE_NEW      = ['\u25CF','\u25CB','\u25C9'];
  var MOON_CORE_CRESCENT = ['\u263D\uFE0E','\u263E\uFE0E','\u25D1','\u25D0'];
  var MOON_CORE_QUARTER  = ['\u25D1','\u25D0','\u25D5','\u25D4'];
  var MOON_CORE_GIBBOUS  = ['\u25D5','\u25D4','\u25CE','\u25CB'];
  var MOON_CORE_FULL     = ['\u25CB','\u25CE','\u25EF','\u25CB','\u263D\uFE0E'];
  var MOON_SURFACE       = ['\u2218','\u25E6','\u2299','\u229A','\u25CC','\u25CD','\u00B7','\u2219'];
  var MOON_GLOW          = ['\u00B7','\u2022\uFE0E','\u2219','\u22C5','\u02D9','\u00B0','.',',','\'','`'];

  /* Font size multipliers (relative to SUN_CELL) */
  var SUN_SIZES  = { glow: 0.8, corona: 0.9, rays: 0.9, inner: 1.1, core: 1.4 };
  var MOON_SIZES = { glow: 0.7, surface: 0.9, core: 1.2 };

  /* Weather-specific cursor characters
     Each weather preset maps to a cursor category that determines
     the character shown as the custom cursor on desktop.
     - rain:        U+2602 Umbrella (with deflection physics)
     - snow:        ❆ U+2746 Heavy Chevron Snowflake
     - atmospheric: ✧ U+2727 White Four Pointed Star
     - clear:       ✦ U+2726 Black Four Pointed Star
     All characters are emoji-safe (not in Unicode Emoji Variation Sequences).
     Ref: unicode.org/emoji/charts/emoji-variants.html */
  var CURSOR_CHARS = {
    rain:        '\u2602\uFE0E',  /* U+2602 umbrella — needs VS15 (in emoji VS list) */
    snow:        '\u2746',         /* ❆ heavy chevron snowflake */
    atmospheric: '\u2727',         /* ✧ white four pointed star */
    clear:       '\u2726'          /* ✦ black four pointed star */
  };

  /* Map each preset key to a cursor category */
  var CURSOR_CATEGORY = {
    /* Rain presets — umbrella with deflection physics */
    gentleMist:    'rain',
    lightDrizzle:  'rain',
    steadyRain:    'rain',
    windyShower:   'rain',
    downpour:      'rain',
    stormFront:    'rain',
    typhoon:       'rain',
    monsoon:       'rain',
    squallLine:    'rain',
    thunderstorm:  'rain',
    freezingRain:  'rain',
    petrichor:     'rain',
    /* Snow presets — snowflake */
    lightSnow:     'snow',
    blizzard:      'snow',
    /* Atmospheric presets — subtle star */
    haze:          'atmospheric',
    dustStorm:     'atmospheric',
    iceFog:        'atmospheric',
    radiationFog:  'atmospheric',
    /* Clear / cloudy presets — four pointed star */
    clearSky:      'clear',
    partlyCloudy:  'clear',
    overcast:      'clear',
    starryNight:   'clear'
  };

  var activeCursorCategory = 'rain';  /* default until preset is selected */
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
      mistDensity: 0,
      /* Celestial visibility */
      sunVis: 0.7, moonVis: 0.75, starVis: 0.6, hazeFactor: 0.5,
      celestialCloudCoverage: 0.2, rainCurtain: 0.0,
      snowScatter: 0.0, fogHalo: 0.6, celestialCategory: 'fog'
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
      mistDensity: 0,
      sunVis: 0.35, moonVis: 0.4, starVis: 0.2, hazeFactor: 0.6,
      celestialCloudCoverage: 0.5, rainCurtain: 0.15,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
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
      mistDensity: 0.3,
      sunVis: 0.0, moonVis: 0.0, starVis: 0.0, hazeFactor: 1.0,
      celestialCloudCoverage: 0.95, rainCurtain: 0.6,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
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
      mistDensity: 0.4,
      sunVis: 0.25, moonVis: 0.3, starVis: 0.15, hazeFactor: 0.4,
      celestialCloudCoverage: 0.6, rainCurtain: 0.3,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
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
      mistDensity: 0.6,
      sunVis: 0.0, moonVis: 0.0, starVis: 0.0, hazeFactor: 1.0,
      celestialCloudCoverage: 0.98, rainCurtain: 0.85,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
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
      mistDensity: 0.75,
      sunVis: 0.0, moonVis: 0.0, starVis: 0.0, hazeFactor: 1.0,
      celestialCloudCoverage: 0.95, rainCurtain: 0.7,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
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
      mistDensity: 0.9,
      sunVis: 0.0, moonVis: 0.0, starVis: 0.0, hazeFactor: 1.0,
      celestialCloudCoverage: 1.0, rainCurtain: 0.9,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
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
      mistDensity: 1.0,
      sunVis: 0.0, moonVis: 0.0, starVis: 0.0, hazeFactor: 1.0,
      celestialCloudCoverage: 1.0, rainCurtain: 0.95,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
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
      lightningInterval: [8, 20],
      lightningBranches: 2,
      sunVis: 0.0, moonVis: 0.0, starVis: 0.0, hazeFactor: 1.0,
      celestialCloudCoverage: 0.95, rainCurtain: 0.8,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
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
      lightningInterval: [4, 12],
      lightningBranches: 3,
      sunVis: 0.0, moonVis: 0.0, starVis: 0.0, hazeFactor: 1.0,
      celestialCloudCoverage: 0.9, rainCurtain: 0.7,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
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
      iceSplash: true,
      sunVis: 0.0, moonVis: 0.0, starVis: 0.0, hazeFactor: 1.0,
      celestialCloudCoverage: 0.9, rainCurtain: 0.5,
      snowScatter: 0.1, fogHalo: 0.0, celestialCategory: 'rain'
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
      fogMode: true,
      fogZoneFrac: 0.70,
      sunVis: 0.3, moonVis: 0.35, starVis: 0.1, hazeFactor: 0.85,
      celestialCloudCoverage: 0.3, rainCurtain: 0.0,
      snowScatter: 0.0, fogHalo: 0.9, celestialCategory: 'fog'
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
      virga: 0.25,
      mistEnabled: true,
      mistDensity: 0.2,
      sunVis: 0.85, moonVis: 0.9, starVis: 0.8, hazeFactor: 0.2,
      celestialCloudCoverage: 0.25, rainCurtain: 0.05,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'clear'
    },

    /* ---- NON-RAIN PRESETS ---- */

    clearSky: {
      name: 'Clear Sky',
      cloudType: 'cirrus',
      dropCount: 0,
      fallSpeed: 0,
      fallSpeedVariance: 0,
      windSpeed: 0.08,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.08,
      rainOpacity: 0,
      charSize: 12,
      cloudDriftSpeed: 3,
      virga: 0,
      mistEnabled: false,
      mistDensity: 0,
      sunVis: 1.0, moonVis: 1.0, starVis: 1.0, hazeFactor: 0.0,
      celestialCloudCoverage: 0.0, rainCurtain: 0.0,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'clear'
    },
    partlyCloudy: {
      name: 'Partly Cloudy',
      cloudType: 'cumulus',
      dropCount: 0,
      fallSpeed: 0,
      fallSpeedVariance: 0,
      windSpeed: 0.3,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.35,
      rainOpacity: 0,
      charSize: 12,
      cloudDriftSpeed: 10,
      virga: 0,
      mistEnabled: false,
      mistDensity: 0,
      sunVis: 0.6, moonVis: 0.65, starVis: 0.4, hazeFactor: 0.1,
      celestialCloudCoverage: 0.4, rainCurtain: 0.0,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'clear'
    },
    overcast: {
      name: 'Overcast',
      cloudType: 'stratus',
      dropCount: 0,
      fallSpeed: 0,
      fallSpeedVariance: 0,
      windSpeed: 0.2,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.55,
      rainOpacity: 0,
      charSize: 13,
      cloudDriftSpeed: 8,
      virga: 0,
      mistEnabled: false,
      mistDensity: 0,
      sunVis: 0.15, moonVis: 0.2, starVis: 0.05, hazeFactor: 0.7,
      celestialCloudCoverage: 0.85, rainCurtain: 0.0,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'rain'
    },
    haze: {
      name: 'Haze',
      cloudType: 'cirrus',
      dropCount: 0,
      fallSpeed: 0,
      fallSpeedVariance: 0,
      windSpeed: 0.05,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.15,
      rainOpacity: 0,
      charSize: 12,
      cloudDriftSpeed: 2,
      virga: 0,
      mistEnabled: true,
      mistDensity: 0.5,
      sunVis: 0.5, moonVis: 0.55, starVis: 0.25, hazeFactor: 0.6,
      celestialCloudCoverage: 0.1, rainCurtain: 0.0,
      snowScatter: 0.0, fogHalo: 0.4, celestialCategory: 'fog'
    },
    dustStorm: {
      name: 'Dust Storm',
      cloudType: 'stratus',
      dropCount: 0,
      fallSpeed: 0,
      fallSpeedVariance: 0,
      windSpeed: 3.0,
      gustEnabled: true,
      gustStrength: 2.0,
      gustFrequency: 1.5,
      cloudOpacity: 0.50,
      rainOpacity: 0,
      charSize: 13,
      cloudDriftSpeed: 45,
      virga: 0,
      mistEnabled: true,
      mistDensity: 0.8,
      sunVis: 0.2, moonVis: 0.15, starVis: 0.05, hazeFactor: 0.9,
      celestialCloudCoverage: 0.7, rainCurtain: 0.0,
      snowScatter: 0.0, fogHalo: 0.3, celestialCategory: 'dust'
    },
    lightSnow: {
      name: 'Light Snow',
      cloudType: 'stratus',
      dropCount: 100,
      fallSpeed: 0.8,              /* slow, drifting snowflakes */
      fallSpeedVariance: 0.3,
      windSpeed: 0.4,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.40,
      rainOpacity: 0.25,
      charSize: 14,
      cloudDriftSpeed: 10,
      virga: 0.1,
      mistEnabled: false,
      mistDensity: 0,
      snowMode: true,
      sunVis: 0.4, moonVis: 0.45, starVis: 0.2, hazeFactor: 0.4,
      celestialCloudCoverage: 0.5, rainCurtain: 0.0,
      snowScatter: 0.3, fogHalo: 0.0, celestialCategory: 'snow'
    },
    blizzard: {
      name: 'Blizzard',
      cloudType: 'nimbostratus',
      dropCount: 400,
      fallSpeed: 1.5,
      fallSpeedVariance: 0.8,
      windSpeed: 3.5,
      gustEnabled: true,
      gustStrength: 2.5,
      gustFrequency: 2.0,
      cloudOpacity: 0.60,
      rainOpacity: 0.35,
      charSize: 15,
      cloudDriftSpeed: 50,
      virga: 0,
      mistEnabled: true,
      mistDensity: 0.9,
      snowMode: true,
      sunVis: 0.0, moonVis: 0.0, starVis: 0.0, hazeFactor: 1.0,
      celestialCloudCoverage: 1.0, rainCurtain: 0.0,
      snowScatter: 0.9, fogHalo: 0.0, celestialCategory: 'snow'
    },
    iceFog: {
      name: 'Ice Fog',
      cloudType: 'stratus',
      dropCount: 0,
      fallSpeed: 0,
      fallSpeedVariance: 0,
      windSpeed: 0.03,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.20,
      rainOpacity: 0,
      charSize: 12,
      cloudDriftSpeed: 2,
      virga: 0,
      mistEnabled: true,
      mistDensity: 1.0,
      fogMode: true,
      fogZoneFrac: 0.80,
      sunVis: 0.15, moonVis: 0.2, starVis: 0.05, hazeFactor: 0.9,
      celestialCloudCoverage: 0.4, rainCurtain: 0.0,
      snowScatter: 0.1, fogHalo: 0.95, celestialCategory: 'fog'
    },
    starryNight: {
      name: 'Starry Night',
      cloudType: 'cirrus',
      dropCount: 0,
      fallSpeed: 0,
      fallSpeedVariance: 0,
      windSpeed: 0.05,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudOpacity: 0.05,
      rainOpacity: 0,
      charSize: 12,
      cloudDriftSpeed: 2,
      virga: 0,
      mistEnabled: false,
      mistDensity: 0,
      sunVis: 1.0, moonVis: 1.0, starVis: 1.0, hazeFactor: 0.0,
      celestialCloudCoverage: 0.0, rainCurtain: 0.0,
      snowScatter: 0.0, fogHalo: 0.0, celestialCategory: 'clear'
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

  /* --- Emoji Prevention Utility ---
     Appends VS15 (U+FE0E) to any character in an array that has an emoji
     presentation variant. Call this on any new character array to future-proof
     against mobile emoji rendering.
     Reference: https://www.unicode.org/Public/16.0.0/ucd/emoji/emoji-variation-sequences.txt
     Reference: https://jeffkreeftmeijer.com/unicode-variation-selectors/
     Reference: https://character.construction/emoji-vs-text                    */
  var EMOJI_CAPABLE = (function() {
    var set = {};
    /* All 182 BMP code points with emoji presentation (Unicode 16.0) */
    var cps = [
      0x00A9,0x00AE,0x203C,0x2049,0x2122,0x2139,0x2194,0x2195,0x2196,0x2197,
      0x2198,0x2199,0x21A9,0x21AA,0x231A,0x231B,0x2328,0x23CF,0x23E9,0x23EA,
      0x23EB,0x23EC,0x23ED,0x23EE,0x23EF,0x23F0,0x23F1,0x23F2,0x23F3,0x23F8,
      0x23F9,0x23FA,0x24C2,0x25AA,0x25AB,0x25B6,0x25C0,0x25FB,0x25FC,0x25FD,
      0x25FE,0x2600,0x2601,0x2602,0x2603,0x2604,0x260E,0x2611,0x2614,0x2615,
      0x2618,0x261D,0x2620,0x2622,0x2623,0x2626,0x262A,0x262E,0x262F,0x2638,
      0x2639,0x263A,0x2640,0x2642,0x2648,0x2649,0x264A,0x264B,0x264C,0x264D,
      0x264E,0x264F,0x2650,0x2651,0x2652,0x2653,0x265F,0x2660,0x2663,0x2665,
      0x2666,0x2668,0x267B,0x267E,0x267F,0x2692,0x2693,0x2694,0x2695,0x2696,
      0x2697,0x2699,0x269B,0x269C,0x26A0,0x26A1,0x26A7,0x26AA,0x26AB,0x26B0,
      0x26B1,0x26BD,0x26BE,0x26C4,0x26C5,0x26C8,0x26CE,0x26CF,0x26D1,0x26D3,
      0x26D4,0x26E9,0x26EA,0x26F0,0x26F1,0x26F2,0x26F3,0x26F4,0x26F5,0x26F7,
      0x26F8,0x26F9,0x26FA,0x26FD,0x2702,0x2705,0x2708,0x2709,0x270A,0x270B,
      0x270C,0x270D,0x270F,0x2712,0x2714,0x2716,0x271D,0x2721,0x2728,0x2733,
      0x2734,0x2744,0x2747,0x274C,0x274E,0x2753,0x2754,0x2755,0x2757,0x2763,
      0x2764,0x2795,0x2796,0x2797,0x27A1,0x27B0,0x27BF,0x2934,0x2935,0x2B05,
      0x2B06,0x2B07,0x2B1B,0x2B1C,0x2B50,0x2B55,0x3030,0x303D,0x3297,0x3299
    ];
    /* Also include non-standard but commonly emoji-rendered chars */
    cps.push(0x2609, 0x263D, 0x263E);
    for (var i = 0; i < cps.length; i++) set[cps[i]] = true;
    return set;
  })();

  /**
   * sanitizeChars(arr) — Append VS15 (\uFE0E) to any character in the array
   * that has an emoji presentation variant. Returns a new array.
   * Usage: var SAFE_CHARS = sanitizeChars(['\u2600', '\u2602', '*']);
   * MUST be called on any new character array added to the weather system.
   */
  function sanitizeChars(arr) {
    var VS15 = '\uFE0E';
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var ch = arr[i];
      /* Strip any existing VS15 to avoid double-appending */
      var base = ch.replace(/\uFE0E/g, '');
      var cp = base.codePointAt(0);
      if (cp && EMOJI_CAPABLE[cp]) {
        out.push(base + VS15);
      } else {
        out.push(ch);
      }
    }
    return out;
  }

  /** Font stack that prioritizes monochrome symbol fonts over emoji fonts.
   *  Use as the font-family for all canvas fillText / sprite rendering.
   *
   *  Defense-in-depth strategy against emoji rendering on mobile:
   *  1. Use only characters NOT in Unicode emoji variation sequences (primary)
   *  2. Append VS15 (\uFE0E) to any remaining emoji-capable chars (secondary)
   *  3. CSS font-variant-emoji: text on canvas elements (tertiary)
   *  4. Font stack ordering: text-glyph fonts before system fallback (quaternary)
   *
   *  Font stack rationale:
   *  - "Apple Symbols": macOS/iOS monochrome symbol font (has dingbats as text)
   *  - "Segoe UI Symbol": Windows monochrome symbol font
   *  - "Noto Sans Symbols 2": Android/Linux monochrome symbol font
   *  - "DejaVu Sans": Widely available, has dingbats as text glyphs
   *  - "Cormorant Garamond": Site's primary font (for non-symbol chars)
   *  - Georgia, serif: Final fallback
   *
   *  Ref: twbs/bootstrap#31860 (Apple Color Emoji overrides unicode)
   *  Ref: css-tricks.com/text-that-sometimes-turns-to-emojis/
   *  Ref: unicode.org/emoji/charts/emoji-variants.html (v17.0)              */
  var EMOJI_SAFE_FONT = '"Apple Symbols", "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", "Cormorant Garamond", Georgia, serif';

  /* ============================================================
     6. NOISE HELPERS
     ============================================================ */

  var noise = new SimplexNoise(Math.random() * 65536);

  /* Secondary noise instance for wind turbulence — independent seed */
  var windNoise = new SimplexNoise(Math.random() * 65536);

  /* Noise instances for celestial body rendering */
  var moonNoise = new SimplexNoise(137);
  var cloudOcclusionNoise = new SimplexNoise(256);

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
      octx.font = iceSplashSize + 'px ' + EMOJI_SAFE_FONT;  /* U+2716 needs emoji-safe font */
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
     10b. CELESTIAL BODY SPRITE CACHE
     ============================================================ */

  var celestialSprites = {};
  var lastSunColorStr = '';
  var lastMoonColorStr = '';

  function buildCelestialSprites(colorStr, chars, sizes) {
    var seen = {}, uniq = [];
    for (var i = 0; i < chars.length; i++) {
      if (chars[i] !== ' ' && !seen[chars[i]]) { seen[chars[i]] = true; uniq.push(chars[i]); }
    }
    var sSet = {}, uSizes = [];
    for (var i = 0; i < sizes.length; i++) {
      if (!sSet[sizes[i]]) { sSet[sizes[i]] = true; uSizes.push(sizes[i]); }
    }
    for (var si = 0; si < uSizes.length; si++) {
      var fs = uSizes[si], sz = Math.ceil(fs * 1.6);
      for (var ci = 0; ci < uniq.length; ci++) {
        var key = uniq[ci] + '@' + fs + '@' + colorStr;
        if (celestialSprites[key]) continue;
        var off = document.createElement('canvas');
        off.width = sz; off.height = sz;
        var o = off.getContext('2d');
        o.font = fs + 'px ' + EMOJI_SAFE_FONT;
        o.textAlign = 'center'; o.textBaseline = 'middle';
        o.fillStyle = colorStr;
        o.fillText(uniq[ci], sz/2, sz/2);
        celestialSprites[key] = off;
      }
    }
  }

  function rebuildSunSprites(colorStr) {
    if (colorStr === lastSunColorStr) return;
    lastSunColorStr = colorStr;
    celestialSprites = {}; /* Clear old sprites to prevent memory growth */
    lastMoonColorStr = ''; /* Force moon rebuild too since cache was cleared */
    var all = [].concat(SUN_CORE, SUN_INNER, SUN_RAYS, SUN_CORONA, SUN_GLOW);
    var sizes = [];
    for (var k in SUN_SIZES) sizes.push(Math.round(SUN_CELL * SUN_SIZES[k]));
    for (var s = 9; s <= 14; s++) sizes.push(s); /* ray dynamic sizes */
    buildCelestialSprites(colorStr, all, sizes);
  }

  function rebuildMoonSprites(colorStr) {
    if (colorStr === lastMoonColorStr) return;
    lastMoonColorStr = colorStr;
    /* Only clear if sun sprites haven't just been rebuilt (avoid double-clear) */
    if (lastSunColorStr === '') celestialSprites = {};
    var all = [].concat(MOON_CORE_NEW, MOON_CORE_CRESCENT, MOON_CORE_QUARTER, MOON_CORE_GIBBOUS, MOON_CORE_FULL, MOON_SURFACE, MOON_GLOW);
    var sizes = [];
    for (var k in MOON_SIZES) sizes.push(Math.round(SUN_CELL * MOON_SIZES[k]));
    buildCelestialSprites(colorStr, all, sizes);
  }

  function drawCelestialSprite(ch, fs, px, py, colorStr) {
    var key = ch + '@' + fs + '@' + colorStr;
    var s = celestialSprites[key];
    if (s) { ctx.drawImage(s, px - s.width*0.5, py - s.height*0.5); }
    else {
      ctx.font = fs + 'px ' + EMOJI_SAFE_FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = colorStr; ctx.fillText(ch, px, py);
    }
  }

  /* ============================================================
     10c. CELESTIAL GLOW SPRITE CACHE
     Cached radial gradient sprites drawn BEHIND the character
     zones to create a soft glow/aura without altering fillStyle.
     Uses the same color as the body but at reduced alpha via
     radial gradient falloff.

     Technique: Offscreen canvas with createRadialGradient.
     Cached per (radius, color) pair. Hundreds of times faster
     than per-frame shadowBlur (SO #15706856).

     References:
     - MDN: CanvasRenderingContext2D.shadowBlur (performance warning)
     - web.dev/articles/canvas-texteffects (cached shadow technique)
     - SO #15706856 (benchmark: cached 100x faster than live shadow)
     ============================================================ */

  var glowSpriteCache = {};
  var lastSunGlowKey = '';
  var lastMoonGlowKey = '';

  /**
   * Build a cached radial gradient glow sprite.
   * @param {number} radius - Glow radius in pixels
   * @param {object} color - {r, g, b} object
   * @param {number} peakAlpha - Alpha at center (0-1)
   * @param {number} softness - How quickly the glow fades (0.3=hard, 0.8=soft)
   * @returns {HTMLCanvasElement} Offscreen canvas with the glow
   */
  function buildGlowSprite(radius, color, peakAlpha, softness) {
    var key = Math.round(radius) + '@' + color.r + ',' + color.g + ',' + color.b + '@' + Math.round(peakAlpha*100) + '@' + Math.round(softness*100);
    if (glowSpriteCache[key]) return glowSpriteCache[key];

    var size = Math.ceil(radius * 2) + 4; /* +4 for anti-aliasing margin */
    var off = document.createElement('canvas');
    off.width = size; off.height = size;
    var o = off.getContext('2d');
    var cx = size / 2, cy = size / 2;

    /* Inner radius: where the glow starts to fade from peak */
    var innerR = radius * (1.0 - softness);

    var grad = o.createRadialGradient(cx, cy, innerR, cx, cy, radius);
    var r = color.r, g = color.g, b = color.b;
    grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + peakAlpha + ')');
    grad.addColorStop(0.4, 'rgba(' + r + ',' + g + ',' + b + ',' + (peakAlpha * 0.5) + ')');
    grad.addColorStop(0.7, 'rgba(' + r + ',' + g + ',' + b + ',' + (peakAlpha * 0.15) + ')');
    grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');

    /* Fill the inner core with peak alpha too */
    if (innerR > 0) {
      o.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + peakAlpha + ')';
      o.beginPath();
      o.arc(cx, cy, innerR, 0, Math.PI * 2);
      o.fill();
    }

    o.fillStyle = grad;
    o.fillRect(0, 0, size, size);

    glowSpriteCache[key] = off;
    return off;
  }

  /**
   * Draw a cached glow sprite at the given position.
   * @param {number} radius - Glow radius
   * @param {object} color - {r, g, b}
   * @param {number} peakAlpha - Center alpha
   * @param {number} softness - Fade rate
   * @param {number} px - Center x
   * @param {number} py - Center y
   * @param {number} alpha - Global alpha multiplier
   */
  function drawGlow(radius, color, peakAlpha, softness, px, py, alpha) {
    if (alpha < 0.005 || radius < 2) return;
    var sprite = buildGlowSprite(radius, color, peakAlpha, softness);
    var prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, px - sprite.width * 0.5, py - sprite.height * 0.5);
    ctx.globalAlpha = prevAlpha;
  }

  function invalidateGlowCache() {
    glowSpriteCache = {};
    lastSunGlowKey = '';
    lastMoonGlowKey = '';
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

    /* Determine cursor category from preset key */
    activeCursorCategory = CURSOR_CATEGORY[key] || 'clear';
    updateCursorChar();

    if (isMobile()) {
      activePreset = Object.assign({}, activePreset);
      activePreset.dropCount = Math.floor(activePreset.dropCount * MOBILE_DROP_FACTOR);
    }

    if (typeof console !== 'undefined') {
      console.log('[Rain] Weather: ' + activePreset.name +
                  ' | Cloud: ' + activeCloudType +
                  ' | Wind: ' + activePreset.windSpeed +
                  ' | Cursor: ' + activeCursorCategory);
    }
  }

  /**
   * updateCursorChar — update the custom cursor element's character
   * to match the active weather preset's cursor category.
   */
  function updateCursorChar() {
    if (umbrellaEl) {
      umbrellaEl.textContent = CURSOR_CHARS[activeCursorCategory] || CURSOR_CHARS.clear;
    }
  }

  /* ---- Canvas setup ---- */

  function setupCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.className = 'rain-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      /* Force text presentation for all Unicode symbols on the canvas.
         font-variant-emoji: text is supported in Chrome 131+, Firefox 141+,
         Safari 17.5+. Older browsers ignore it and fall back to the
         emoji-safe font stack + VS15 protection.
         Ref: caniuse.com/mdn-css_properties_font-variant-emoji */
      canvas.style.fontVariantEmoji = 'text';
      canvas.style.fontFamily = EMOJI_SAFE_FONT;
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
        umbrellaEl.className = 'weather-cursor';
        umbrellaEl.textContent = CURSOR_CHARS[activeCursorCategory] || CURSOR_CHARS.clear;
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

    /* --- Click handler for door knocks --- */
    /* Canvas has pointer-events:none, so listen on document instead */
    if (doorEnabled) {
      document.addEventListener('click', function(e) {
        if (isDoorHit(e.clientX, e.clientY)) {
          onDoorKnock();
        }
      });
    }
  }

  function isClickable(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' ||
        tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'LABEL') return true;
    if (el.getAttribute('role') === 'button' || el.getAttribute('tabindex')) return true;
    if (el.classList && (el.classList.contains('btn') || el.classList.contains('clickable'))) return true;
    /* Walk up to check if a parent anchor/button wraps this element */
    if (el.closest && el.closest('a, button, [role="button"]')) return true;
    return false;
  }

  function onMouseMove(e) {
    mouseX = e.clientX; mouseY = e.clientY; mouseActive = true;
    if (umbrellaEl) {
      umbrellaEl.style.left = mouseX + 'px';
      umbrellaEl.style.top = mouseY + 'px';

      /* Hide custom cursor over clickable elements so the default pointer shows */
      if (isClickable(e.target)) {
        umbrellaEl.classList.remove('visible');
        document.body.classList.remove('rain-active');
      } else {
        umbrellaEl.classList.add('visible');
        document.body.classList.add('rain-active');
      }
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

    /* Deflection physics only apply when the umbrella cursor is active */
    if (activeCursorCategory !== 'rain') return;

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
     14c. CELESTIAL BODY SYSTEM
     Sun and moon rendering with real lunar calendar sync,
     theme-aware Rayleigh scattering colors, and weather
     interaction engine.

     Sources:
     - Lunar phase: voidware.com/moon_phase.htm
     - Moon rise/set by phase: itu.physics.uiowa.edu
     - Rayleigh scattering: hyperphysics.phy-astr.gsu.edu
     - WCAG contrast: w3.org/TR/WCAG21
     - Cloud occlusion: adapted from cloudEntityNoise() pattern
     - Fog halos: fullmoon.info, naturalnavigator.com
     ============================================================ */

  /* --- Utility: pick character deterministically from seed --- */
  function pickCelestialChar(chars, seed) {
    return chars[Math.abs(Math.floor(seed * 1000)) % chars.length];
  }

  /* --- Parse CSS color string to {r,g,b} (hex or rgb()) --- */
  function parseColor(str) {
    str = str.trim();
    var rgbMatch = str.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) return { r: parseInt(rgbMatch[1],10), g: parseInt(rgbMatch[2],10), b: parseInt(rgbMatch[3],10) };
    var hex = str.replace('#', '');
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return { r: parseInt(hex.substr(0,2),16), g: parseInt(hex.substr(2,2),16), b: parseInt(hex.substr(4,2),16) };
  }

  /* --- WCAG relative luminance --- */
  function wcagLuminance(r, g, b) {
    var rs = r/255, gs = g/255, bs = b/255;
    rs = rs <= 0.03928 ? rs/12.92 : Math.pow((rs+0.055)/1.055, 2.4);
    gs = gs <= 0.03928 ? gs/12.92 : Math.pow((gs+0.055)/1.055, 2.4);
    bs = bs <= 0.03928 ? bs/12.92 : Math.pow((bs+0.055)/1.055, 2.4);
    return 0.2126*rs + 0.7152*gs + 0.0722*bs;
  }

  /* --- Lunar phase calculator (synced to real calendar) ---
     Algorithm: voidware.com/moon_phase.htm
     Returns continuous fraction 0-1 through the synodic month.
     0 = new moon, 0.5 = full moon. */
  function getLunarPhase(year, month, day) {
    year = Math.floor(year); month = Math.floor(month); day = Math.floor(day);
    var y = year, m = month;
    if (m < 3) { y--; m += 12; }
    m++;
    var c = 365.25 * y;
    var e = 30.6 * m;
    var jd = c + e + day - 694039.09;
    jd /= 29.5305882;
    return jd - Math.floor(jd);
  }

  function getPhaseIndex(f) { return Math.round(f * 8) % 8; }
  function getIllumination(f) { return (1 - Math.cos(f * 2 * Math.PI)) / 2; }

  /* --- Moon rise/set (phase-dependent) ---
     Source: itu.physics.uiowa.edu/labs/observational */
  function getMoonRiseSet(f) {
    return { rise: (6 + f * 24) % 24, set: (18 + f * 24) % 24 };
  }

  function getMoonPosition(hour, f, cW, cH) {
    var rs = getMoonRiseSet(f);
    var rise = rs.rise, set = rs.set;
    var duration, dayFrac;
    if (set > rise) {
      if (hour < rise || hour > set) return null;
      duration = set - rise;
      dayFrac = (hour - rise) / duration;
    } else {
      if (hour >= rise) {
        duration = (24 - rise) + set;
        dayFrac = (hour - rise) / duration;
      } else if (hour <= set) {
        duration = (24 - rise) + set;
        dayFrac = ((24 - rise) + hour) / duration;
      } else { return null; }
    }
    var x = cW * (0.10 + dayFrac * 0.80);
    /* Power curve (^0.55) flattens the top of the arc so the moon
       spends more time in the upper viewport. Horizon at 65%, peak at 7%. */
    var elevation = Math.pow(Math.sin(dayFrac * Math.PI), 0.55);
    var y = cH * (0.65 - elevation * 0.58);
    return { x: x, y: y, elevation: elevation, dayFrac: dayFrac };
  }

  /* --- Sun position --- */
  function getSunPosition(hour, cW, cH) {
    if (hour < SUNRISE_HOUR || hour > SUNSET_HOUR) return null;
    var dayFrac = (hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR);
    var x = cW * (0.10 + dayFrac * 0.80);
    /* Power curve (^0.55) flattens the top of the arc so the sun
       spends more time in the upper viewport. Horizon at 65%, peak at 7%. */
    var elevation = Math.pow(Math.sin(dayFrac * Math.PI), 0.55);
    var y = cH * (0.65 - elevation * 0.58);
    return { x: x, y: y, elevation: elevation, dayFrac: dayFrac };
  }

  function getBodyRadius(elevation, baseRadius) {
    return baseRadius * (1.35 - 0.35 * elevation);
  }

  /* --- Theme-aware color model ---
     Reads --color-weather and --color-bg CSS variables (cached, not per-frame).
     Blends Rayleigh physics colors with theme for guaranteed contrast. */
  var cachedWeatherColor = null;
  var cachedBgColor = null;
  var celestialThemeDirty = true;

  function refreshCelestialThemeColors() {
    if (!celestialThemeDirty) return;
    var raw1 = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-weather').trim() || '#2a1f2d';
    cachedWeatherColor = parseColor(raw1);
    var raw2 = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-bg').trim() || '#f2d4d7';
    cachedBgColor = parseColor(raw2);
    celestialThemeDirty = false;
  }

  function themeBlendColor(physicsColor, themeColor, blendT) {
    return {
      r: Math.round(lerp(physicsColor.r, themeColor.r, blendT)),
      g: Math.round(lerp(physicsColor.g, themeColor.g, blendT)),
      b: Math.round(lerp(physicsColor.b, themeColor.b, blendT))
    };
  }

  function ensureCelestialContrast(bodyColor, bgColor, weatherColor) {
    var bgLum = wcagLuminance(bgColor.r, bgColor.g, bgColor.b);
    var bodyLum = wcagLuminance(bodyColor.r, bodyColor.g, bodyColor.b);
    var lighter = Math.max(bgLum, bodyLum);
    var darker = Math.min(bgLum, bodyLum);
    var ratio = (lighter + 0.05) / (darker + 0.05);
    if (ratio < 2.0) {
      return themeBlendColor(bodyColor, weatherColor, 0.6);
    }
    return bodyColor;
  }

  /* Rayleigh scattering color for sun */
  function getSunPhysicsColor(hour) {
    var elevation = Math.max(0, Math.sin((hour - SUNRISE_HOUR) / (SUNSET_HOUR - SUNRISE_HOUR) * Math.PI));
    var r, g, b;
    if (elevation < 0.15) { r = 220; g = 80 + elevation * 400; b = 40; }
    else if (elevation < 0.4) { var t = (elevation-0.15)/0.25; r = 220+t*35; g = 140+t*80; b = 40+t*60; }
    else if (elevation < 0.7) { var t = (elevation-0.4)/0.3; r = 255; g = 220+t*25; b = 100+t*80; }
    else { var t = (elevation-0.7)/0.3; r = 255; g = 245+t*10; b = 180+t*50; }
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  }

  /* Rayleigh scattering color for moon.
     Computes physical elevation from hour and lunar fraction (like
     getSunPhysicsColor) so the color depends on the true atmospheric
     path length, not the power-curved display position. */
  function getMoonPhysicsColor(hour, f) {
    var rs = getMoonRiseSet(f);
    var rise = rs.rise, set = rs.set;
    var dayFrac;
    if (set > rise) {
      dayFrac = (hour - rise) / (set - rise);
    } else {
      var duration = (24 - rise) + set;
      dayFrac = (hour >= rise)
        ? (hour - rise) / duration
        : ((24 - rise) + hour) / duration;
    }
    dayFrac = Math.max(0, Math.min(1, dayFrac));
    var elevation = Math.sin(dayFrac * Math.PI); /* true physical elevation */
    var r, g, b;
    if (elevation < 0.15) { r = 200; g = 160+elevation*300; b = 100; }
    else if (elevation < 0.4) { var t = (elevation-0.15)/0.25; r = 200+t*20; g = 205+t*25; b = 145+t*40; }
    else if (elevation < 0.7) { var t = (elevation-0.4)/0.3; r = 220-t*10; g = 230-t*5; b = 185+t*30; }
    else { var t = (elevation-0.7)/0.3; r = 210-t*10; g = 225-t*5; b = 215+t*25; }
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  }

  function getSunColor(hour) {
    refreshCelestialThemeColors();
    var physics = getSunPhysicsColor(hour);
    var bgLum = wcagLuminance(cachedBgColor.r, cachedBgColor.g, cachedBgColor.b);
    var blendT = bgLum > 0.3 ? 0.25 : 0.10;
    var blended = themeBlendColor(physics, cachedWeatherColor, blendT);
    return ensureCelestialContrast(blended, cachedBgColor, cachedWeatherColor);
  }

  function getMoonColor(hour, f) {
    refreshCelestialThemeColors();
    var physics = getMoonPhysicsColor(hour, f);
    var bgLum = wcagLuminance(cachedBgColor.r, cachedBgColor.g, cachedBgColor.b);
    var blendT = bgLum > 0.3 ? 0.35 : 0.15;
    var blended = themeBlendColor(physics, cachedWeatherColor, blendT);
    return ensureCelestialContrast(blended, cachedBgColor, cachedWeatherColor);
  }

  /* --- Weather interaction engine ---
     Computes per-frame visibility modifications based on the active
     preset's celestial parameters. */
  function computeCelestialWeather(time, preset, bodyX, bodyY) {
    var result = {
      visMult: 1.0,
      haloExpand: 0.0,
      coreDim: 0.0,
      colorShift: null
    };

    /* Cloud occlusion — noise field simulating cloud coverage */
    var cc = preset.celestialCloudCoverage || 0;
    if (cc > 0) {
      var ws = preset.windSpeed || 0.1;
      var cloudDrift = time * ws * 0.5;
      var cx = bodyX / W * 4 + cloudDrift;
      var cy = bodyY / H * 2;
      var cloudDensity = (cloudOcclusionNoise.noise2D(cx, cy) + 1) * 0.5;
      cloudDensity = cloudDensity * cc;
      var gapNoise = windNoise.noise2D(time * ws * 0.3, bodyX * 0.01);
      var gapFactor = ws > 0.5 ? (gapNoise * 0.5 + 0.5) * 0.3 : 0;
      cloudDensity = Math.max(0, cloudDensity - gapFactor);
      result.visMult *= (1.0 - cloudDensity * 0.8);
      result.coreDim += cloudDensity * 0.4;
    }

    /* Rain curtain dimming */
    var rc = preset.rainCurtain || 0;
    if (rc > 0) {
      var rainFlicker = noise.noise2D(time * 0.2, 3.7) * 0.15;
      var curtainDim = rc * (0.85 + rainFlicker);
      result.visMult *= (1.0 - curtainDim * 0.6);
      result.coreDim += curtainDim * 0.3;
    }

    /* Fog halo expansion */
    var fh = preset.fogHalo || 0;
    if (fh > 0) {
      result.haloExpand = fh * 0.5;
      result.coreDim += fh * 0.2;
    }

    /* Snow whiteout scatter */
    var ss = preset.snowScatter || 0;
    if (ss > 0) {
      var snowFlicker = noise.noise2D(time * 0.15, 7.3) * 0.2;
      var scatter = ss * (0.8 + snowFlicker);
      result.visMult *= (1.0 - scatter * 0.5);
      result.coreDim += scatter * 0.5;
      result.haloExpand += scatter * 0.3;
    }

    /* Dust color shift — pushes toward red/amber */
    var cat = preset.celestialCategory || 'rain';
    var hf = preset.hazeFactor || 0;
    if (cat === 'dust' && hf > 0.5) {
      result.colorShift = { r: 180, g: 100, b: 50 };
    }

    result.visMult = clamp(result.visMult, 0, 1);
    result.coreDim = clamp(result.coreDim, 0, 1);
    return result;
  }

  /* --- Celestial state (initialized in init()) --- */
  var celestialHour = 12;
  var lunarFraction = 0;
  var celestialTimeAccum = 0;

  function initCelestial() {
    var now = new Date();
    celestialHour = now.getHours() + now.getMinutes() / 60;
    lunarFraction = getLunarPhase(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  /* Update celestial hour from real clock (called once per minute) */
  var celestialUpdateTimer = 0;
  function updateCelestialTime(dtSec) {
    celestialUpdateTimer += dtSec;
    if (celestialUpdateTimer > 60) {
      celestialUpdateTimer = 0;
      var now = new Date();
      celestialHour = now.getHours() + now.getMinutes() / 60;
      /* Recalculate lunar phase at midnight */
      if (celestialHour < 0.02) {
        lunarFraction = getLunarPhase(now.getFullYear(), now.getMonth() + 1, now.getDate());
      }
    }
  }

  /* --- Render Sun (5 zones) --- */
  function renderSun(time) {
    var preset = activePreset;
    var sunVis = preset.sunVis;
    if (typeof sunVis === 'undefined') sunVis = 0.5; /* fallback for presets without celestial params */
    if (sunVis <= 0) return;

    var pos = getSunPosition(celestialHour, W, H);
    if (!pos) return;

    var wx = computeCelestialWeather(time, preset, pos.x, pos.y);
    var effectiveVis = sunVis * wx.visMult;
    if (effectiveVis < 0.01) return;

    var elevation = pos.elevation;
    var sunColor = getSunColor(celestialHour);
    if (wx.colorShift) {
      var hf = preset.hazeFactor || 0;
      sunColor = themeBlendColor(sunColor, wx.colorShift, hf * 0.4);
    }
    var colorStr = 'rgb(' + sunColor.r + ',' + sunColor.g + ',' + sunColor.b + ')';
    rebuildSunSprites(colorStr);

    var hazeFactor = preset.hazeFactor || 0;
    var baseRadius = Math.min(W, H) * 0.08;
    var radius = getBodyRadius(elevation, baseRadius);
    var glowMult = 1.0 + hazeFactor * 0.6 + wx.haloExpand;
    var coreSharp = Math.max(0.1, 1.0 - hazeFactor * 0.5 - wx.coreDim * 0.3);
    var rayLenMult = 1.0 + (1.0 - elevation) * 0.8;

    /* Flickering for partial visibility */
    var flickerVis = effectiveVis;
    if (effectiveVis > 0.05 && effectiveVis < 0.6) {
      var wf = windNoise.noise2D(time * (preset.windSpeed || 0.1) * 0.4, 0.5);
      flickerVis = effectiveVis * (0.6 + wf * 0.4);
    }
    flickerVis = clamp(flickerVis, 0, 1);

    var cx = pos.x, cy = pos.y;
    var fsGlow = Math.round(SUN_CELL * SUN_SIZES.glow);
    var fsCorona = Math.round(SUN_CELL * SUN_SIZES.corona);
    var fsInner = Math.round(SUN_CELL * SUN_SIZES.inner);
    var fsCore = Math.round(SUN_CELL * SUN_SIZES.core);

    /* Radial gradient glow — drawn BEHIND all character zones.
       Uses the same theme-aware color at reduced alpha.
       Glow radius is 1.8x the outermost character zone.
       Intensity modulated by elevation, weather, and haze.
       Cached via buildGlowSprite for zero per-frame cost. */
    var sunGlowR = radius * 1.8 * glowMult;
    var sunGlowPeak = 0.18 + hazeFactor * 0.12 + wx.haloExpand * 0.15;
    var sunGlowSoft = 0.65 + hazeFactor * 0.15;
    var sunGlowAlpha = flickerVis * (0.6 + elevation * 0.4);
    /* Breathing: slow noise-driven pulsation */
    var sunBreath = noise.noise2D(time * 0.03, 0.77) * 0.08 + 1.0;
    sunGlowAlpha *= sunBreath;
    drawGlow(sunGlowR, sunColor, sunGlowPeak, sunGlowSoft, cx, cy, sunGlowAlpha);

    /* Zone 5: GLOW */
    var glowR = radius * 1.3 * glowMult;
    var glowC = Math.ceil(glowR * 2 / SUN_CELL);
    for (var gy = -glowC; gy <= glowC; gy++) {
      for (var gx = -glowC; gx <= glowC; gx++) {
        var px = cx + gx * SUN_CELL, py = cy + gy * SUN_CELL;
        var dx = px - cx, dy = py - cy, dist = Math.sqrt(dx*dx+dy*dy);
        var nd = dist / glowR;
        if (nd < 0.85 || nd > 1.2) continue;
        var fade = 1.0 - (nd - 0.85) / 0.35;
        var shim = noise.noise2D(gx*0.3+time*0.08, gy*0.3+time*0.05) * 0.3 + 0.7;
        var a = fade * shim * flickerVis * 0.15 * (0.5 + hazeFactor*0.5 + wx.haloExpand*0.5);
        if (a < 0.01) continue;
        ctx.globalAlpha = a;
        drawCelestialSprite(pickCelestialChar(SUN_GLOW, gx*7+gy*13+Math.floor(time*0.3)), fsGlow, px, py, colorStr);
      }
    }

    /* Zone 4: CORONA */
    var corR = radius * 0.95 * glowMult;
    var corC = Math.ceil(corR * 2 / SUN_CELL);
    for (var gy = -corC; gy <= corC; gy++) {
      for (var gx = -corC; gx <= corC; gx++) {
        var px = cx + gx * SUN_CELL, py = cy + gy * SUN_CELL;
        var dx = px-cx, dy = py-cy, dist = Math.sqrt(dx*dx+dy*dy);
        var nd = dist / corR;
        if (nd < 0.65 || nd > 0.90) continue;
        var fade = 1.0 - (nd-0.65)/0.25;
        var pulse = noise.noise2D(gx*0.5+time*0.12, gy*0.5-time*0.08) * 0.4 + 0.6;
        var a = fade * pulse * flickerVis * 0.35;
        if (a < 0.01) continue;
        ctx.globalAlpha = a;
        drawCelestialSprite(pickCelestialChar(SUN_CORONA, gx*11+gy*17+Math.floor(time*0.4)), fsCorona, px, py, colorStr);
      }
    }

    /* Zone 3: RAYS */
    var rayR = radius * 0.75 * rayLenMult;
    var rayC = Math.ceil(rayR * 2 / SUN_CELL);
    var NUM_RAYS = 16, rayAngles = [];
    for (var ri = 0; ri < NUM_RAYS; ri++) rayAngles.push(ri*Math.PI*2/NUM_RAYS + time*0.02);
    for (var gy = -rayC; gy <= rayC; gy++) {
      for (var gx = -rayC; gx <= rayC; gx++) {
        var px = cx+gx*SUN_CELL, py = cy+gy*SUN_CELL;
        var dx = px-cx, dy = py-cy, dist = Math.sqrt(dx*dx+dy*dy);
        var nd = dist / rayR;
        if (nd < 0.35 || nd > 0.70) continue;
        var angle = Math.atan2(dy, dx), bestAlign = 0;
        for (var ri = 0; ri < NUM_RAYS; ri++) {
          var diff = Math.abs(angle - rayAngles[ri]);
          diff = Math.min(diff, Math.PI*2-diff);
          bestAlign = Math.max(bestAlign, Math.max(0, 1.0-diff/((ri%2===0)?0.18:0.10)));
        }
        if (bestAlign < 0.1) continue;
        var radFade = 1.0-(nd-0.35)/0.35;
        var rn = noise.noise2D(gx*0.8+time*0.1, gy*0.8+time*0.06)*0.3+0.7;
        var a = bestAlign * radFade * rn * flickerVis * coreSharp * 0.55;
        if (a < 0.01) continue;
        var absA = ((angle%(Math.PI*2))+Math.PI*2)%(Math.PI*2);
        var oct = Math.floor(absA/(Math.PI/4)+0.5)%8;
        var ch = ['\u2014','\u2572','|','\u2571','\u2014','\u2572','|','\u2571'][oct];
        if (nd > 0.55) ch = pickCelestialChar(SUN_INNER, gx*3+gy*7+Math.floor(time*0.5));
        var rfs = clamp(Math.round(SUN_CELL*(0.9+bestAlign*0.3)), 9, 14);
        ctx.globalAlpha = a;
        drawCelestialSprite(ch, rfs, px, py, colorStr);
      }
    }

    /* Zone 2: INNER */
    var innR = radius * 0.40;
    var innC = Math.ceil(innR * 2 / SUN_CELL);
    for (var gy = -innC; gy <= innC; gy++) {
      for (var gx = -innC; gx <= innC; gx++) {
        var px = cx+gx*SUN_CELL, py = cy+gy*SUN_CELL;
        var dx = px-cx, dy = py-cy, dist = Math.sqrt(dx*dx+dy*dy);
        var nd = dist / innR;
        if (nd < 0.15 || nd > 1.0) continue;
        var oA = Math.atan2(dy,dx)+time*0.03;
        var oN = noise.noise2D(Math.cos(oA)*2+time*0.05, Math.sin(oA)*2+time*0.05)*0.3+0.7;
        var iFade = nd < 0.5 ? 1.0 : 1.0-(nd-0.5)/0.5;
        var a = iFade * oN * flickerVis * coreSharp * 0.65;
        if (a < 0.01) continue;
        ctx.globalAlpha = a;
        drawCelestialSprite(pickCelestialChar(SUN_INNER, gx*5+gy*9+Math.floor(time*0.6)), fsInner, px, py, colorStr);
      }
    }

    /* Zone 1: CORE */
    var coreR = radius * 0.18;
    var coreC = Math.ceil(coreR * 2 / SUN_CELL);
    for (var gy = -coreC; gy <= coreC; gy++) {
      for (var gx = -coreC; gx <= coreC; gx++) {
        var px = cx+gx*SUN_CELL, py = cy+gy*SUN_CELL;
        var dx = px-cx, dy = py-cy;
        if (Math.sqrt(dx*dx+dy*dy)/coreR > 1.0) continue;
        var cp = noise.noise2D(time*0.2, gx*0.5+gy*0.5)*0.1+0.9;
        ctx.globalAlpha = cp * flickerVis * coreSharp * 0.9;
        drawCelestialSprite(pickCelestialChar(SUN_CORE, gx*3+gy*5+Math.floor(time*0.8)), fsCore, px, py, colorStr);
      }
    }

    ctx.globalAlpha = 1;
  }

  /* --- Render Moon (3 zones) --- */
  function renderMoon(time) {
    var preset = activePreset;
    var moonVis = preset.moonVis;
    if (typeof moonVis === 'undefined') moonVis = 0.5;
    if (moonVis <= 0) return;

    var pos = getMoonPosition(celestialHour, lunarFraction, W, H);
    if (!pos) return;

    var illumination = getIllumination(lunarFraction);
    if (illumination < 0.02) return; /* New moon — not visible */

    var wx = computeCelestialWeather(time, preset, pos.x, pos.y);
    var effectiveVis = moonVis * wx.visMult;
    if (effectiveVis < 0.01) return;

    var elevation = pos.elevation;
    var moonColor = getMoonColor(celestialHour, lunarFraction);
    if (wx.colorShift) {
      var hf = preset.hazeFactor || 0;
      moonColor = themeBlendColor(moonColor, wx.colorShift, hf * 0.3);
    }
    var colorStr = 'rgb(' + moonColor.r + ',' + moonColor.g + ',' + moonColor.b + ')';
    rebuildMoonSprites(colorStr);

    var hazeFactor = preset.hazeFactor || 0;
    var baseRadius = Math.min(W, H) * 0.055;
    var radius = getBodyRadius(elevation, baseRadius);
    var glowMult = 1.0 + hazeFactor * 0.8 + wx.haloExpand;
    var coreSharp = Math.max(0.1, 1.0 - hazeFactor * 0.4 - wx.coreDim * 0.3);

    var flickerVis = effectiveVis;
    if (effectiveVis > 0.05 && effectiveVis < 0.6) {
      var wf = windNoise.noise2D(time * (preset.windSpeed || 0.1) * 0.35, 2.5);
      flickerVis = effectiveVis * (0.6 + wf * 0.4);
    }
    flickerVis = clamp(flickerVis, 0, 1);

    var cx = pos.x, cy = pos.y;
    var fsGlow = Math.round(SUN_CELL * MOON_SIZES.glow);
    var fsSurf = Math.round(SUN_CELL * MOON_SIZES.surface);
    var fsCore = Math.round(SUN_CELL * MOON_SIZES.core);

    /* Radial gradient glow — drawn BEHIND all character zones.
       Moon glow is softer and dimmer than sun, scaled by illumination.
       Fog/haze expands the glow (lunar corona effect). */
    var moonGlowR = radius * 2.0 * glowMult;
    var moonGlowPeak = (0.12 + hazeFactor * 0.15 + wx.haloExpand * 0.2) * illumination;
    var moonGlowSoft = 0.7 + hazeFactor * 0.15;
    var moonGlowAlpha = flickerVis * illumination * (0.5 + elevation * 0.5);
    /* Breathing: slow noise-driven pulsation */
    var moonBreath = moonNoise.noise2D(time * 0.025, 1.33) * 0.06 + 1.0;
    moonGlowAlpha *= moonBreath;
    drawGlow(moonGlowR, moonColor, moonGlowPeak, moonGlowSoft, cx, cy, moonGlowAlpha);

    /* Zone 3: GLOW */
    var glowR = radius * 1.4 * glowMult;
    var glowC = Math.ceil(glowR * 2 / SUN_CELL);
    for (var gy = -glowC; gy <= glowC; gy++) {
      for (var gx = -glowC; gx <= glowC; gx++) {
        var px = cx + gx * SUN_CELL, py = cy + gy * SUN_CELL;
        var dx = px-cx, dy = py-cy, dist = Math.sqrt(dx*dx+dy*dy);
        var nd = dist / glowR;
        if (nd < 0.7 || nd > 1.15) continue;
        var fade = 1.0-(nd-0.7)/0.45;
        var shim = moonNoise.noise2D(gx*0.25+time*0.06, gy*0.25+time*0.04)*0.3+0.7;
        var a = fade * shim * flickerVis * illumination * 0.12 * (0.3+hazeFactor*0.7+wx.haloExpand*0.5);
        if (a < 0.01) continue;
        ctx.globalAlpha = a;
        drawCelestialSprite(pickCelestialChar(MOON_GLOW, gx*7+gy*11+Math.floor(time*0.25)), fsGlow, px, py, colorStr);
      }
    }

    /* Zone 2: SURFACE */
    var surfR = radius * 0.55;
    var surfC = Math.ceil(surfR * 2 / SUN_CELL);
    for (var gy = -surfC; gy <= surfC; gy++) {
      for (var gx = -surfC; gx <= surfC; gx++) {
        var px = cx+gx*SUN_CELL, py = cy+gy*SUN_CELL;
        var dx = px-cx, dy = py-cy, dist = Math.sqrt(dx*dx+dy*dy);
        var nd = dist / surfR;
        if (nd < 0.2 || nd > 1.0) continue;
        var cellAngle = Math.atan2(dy, dx);
        var phaseMask = 1.0;
        if (lunarFraction < 0.5) {
          phaseMask = clamp(0.5 + Math.cos(cellAngle) * illumination, 0, 1);
        } else {
          phaseMask = clamp(0.5 + Math.cos(cellAngle - Math.PI) * illumination, 0, 1);
        }
        var sf = nd < 0.5 ? 1.0 : 1.0-(nd-0.5)/0.5;
        var sn = moonNoise.noise2D(gx*0.6+time*0.04, gy*0.6+time*0.03)*0.2+0.8;
        var a = sf * sn * phaseMask * flickerVis * coreSharp * illumination * 0.5;
        if (a < 0.01) continue;
        ctx.globalAlpha = a;
        drawCelestialSprite(pickCelestialChar(MOON_SURFACE, gx*5+gy*7+Math.floor(time*0.15)), fsSurf, px, py, colorStr);
      }
    }

    /* Zone 1: CORE */
    var coreR = radius * 0.22;
    var coreC = Math.ceil(coreR * 2 / SUN_CELL);
    var phaseIdx = getPhaseIndex(lunarFraction);
    var coreChars;
    switch (phaseIdx) {
      case 0: coreChars = MOON_CORE_NEW; break;
      case 1: case 7: coreChars = MOON_CORE_CRESCENT; break;
      case 2: case 6: coreChars = MOON_CORE_QUARTER; break;
      case 3: case 5: coreChars = MOON_CORE_GIBBOUS; break;
      default: coreChars = MOON_CORE_FULL;
    }
    for (var gy = -coreC; gy <= coreC; gy++) {
      for (var gx = -coreC; gx <= coreC; gx++) {
        var px = cx+gx*SUN_CELL, py = cy+gy*SUN_CELL;
        var dx = px-cx, dy = py-cy;
        if (Math.sqrt(dx*dx+dy*dy)/coreR > 1.0) continue;
        var cp = moonNoise.noise2D(time*0.15, gx*0.4+gy*0.4)*0.08+0.92;
        ctx.globalAlpha = cp * flickerVis * coreSharp * illumination * 0.85;
        drawCelestialSprite(pickCelestialChar(coreChars, gx*3+gy*5+Math.floor(time*0.3)), fsCore, px, py, colorStr);
      }
    }

    ctx.globalAlpha = 1;
  }

  /* ============================================================
     14d. STARRY SKY SYSTEM
     Real star data from the Hipparcos catalog, filtered for
     visibility from Tokyo (latitude 35.68°N). Stars rendered
     with noise-driven Unicode character cycling and multi-layer
     scintillation. Constellation cohesion via shared breathing
     noise and faint centroid glow fields.

     References:
     - Hipparcos catalog (ESA, 1997)
     - Atlas of the Universe: atlasoftheuniverse.com/stars.html
     - Scintillation physics: en.wikipedia.org/wiki/Twinkling
     - US Naval Observatory twilight definitions
     ============================================================ */

  /* --- Tokyo observer --- */
  var TOKYO_LAT = 35.6762;
  var TOKYO_LON = 139.6503;
  var TOKYO_LAT_RAD = TOKYO_LAT * Math.PI / 180;

  /* --- Star character sets (VS15 for emoji prevention) --- */
  /* Star character sets — ONLY emoji-safe characters.
     U+2734 (EIGHT POINTED BLACK STAR) and U+2605 (BLACK STAR) are in the
     Unicode emoji variation sequences and render as colored emoji on iOS/Android
     even with VS15. Replaced with U+2726, U+2736, U+2739, U+2738, U+2737
     which are Dingbats block characters without emoji variation sequences.
     Ref: unicode.org/emoji/charts/emoji-variants.html (v17.0)                */
  var STAR_CHARS_BRILLIANT = ['\u2726','\u2736','\u2738','\u2739','\u2737','\u2726','\u2736','\u2738'];
  var STAR_CHARS_BRIGHT    = ['\u2726','\u2727','\u2736','\u2738','\u2726','\u2727'];
  var STAR_CHARS_MEDIUM    = ['\u2727','\u2726','\u2219','\u2022\uFE0E','\u2727','\u00B7'];
  var STAR_CHARS_DIM       = ['\u00B7','\u2219','\u2027','\u2022\uFE0E','\u00B7','\u2219'];
  var STAR_CHARS_FAINT     = ['\u2027','\u002E','\u00B7','\u2219','\u002E','\u2027'];

  /* --- Spectral type to RGB color --- */
  var SPECTRAL_COLORS = {
    'O': { r: 155, g: 176, b: 255 },
    'B': { r: 170, g: 191, b: 255 },
    'A': { r: 202, g: 215, b: 255 },
    'F': { r: 248, g: 247, b: 255 },
    'G': { r: 255, g: 244, b: 234 },
    'K': { r: 255, g: 210, b: 161 },
    'M': { r: 255, g: 204, b: 111 }
  };

  /* --- Star catalog: [name, RA_hours, Dec_degrees, magnitude, spectralClass, constellationIdx]
     constellationIdx: -1 = no constellation, 0+ = index into STAR_CONSTELLATIONS --- */
  var STAR_CONSTELLATIONS = [
    'Ursa Major','Ursa Minor','Cassiopeia','Orion','Cygnus',
    'Lyra','Aquila','Scorpius','Leo','Gemini',
    'Bootes','Pegasus','Andromeda','Perseus','Auriga'
  ];

  var STAR_CATALOG = [
    ['Sirius',6.752,-16.72,-1.46,'A',3],['Canopus',6.399,-52.70,-0.73,'F',-1],
    ['Arcturus',14.261,19.18,-0.05,'K',10],['Vega',18.616,38.78,0.03,'A',5],
    ['Capella',5.278,46.00,0.07,'G',14],['Rigel',5.242,-8.20,0.15,'B',3],
    ['Procyon',7.655,5.22,0.36,'F',-1],['Betelgeuse',5.919,7.41,0.55,'M',3],
    ['Altair',19.846,8.87,0.77,'A',6],['Aldebaran',4.599,16.51,0.86,'K',-1],
    ['Antares',16.490,-26.43,0.95,'M',7],['Spica',13.420,-11.16,0.97,'B',-1],
    ['Pollux',7.755,28.03,1.14,'K',9],['Fomalhaut',22.961,-29.62,1.15,'A',-1],
    ['Deneb',20.690,45.28,1.24,'A',4],['Regulus',10.140,11.97,1.36,'B',8],
    ['Adhara',6.977,-28.97,1.50,'B',-1],['Castor',7.577,31.89,1.58,'A',9],
    ['Shaula',17.560,-37.10,1.62,'B',7],['Bellatrix',5.419,6.35,1.64,'B',3],
    ['Elnath',5.438,28.61,1.66,'B',14],['Alnilam',5.603,-1.20,1.69,'B',3],
    ['Alnitak',5.679,-1.94,1.75,'O',3],['Alioth',12.900,55.96,1.77,'A',0],
    ['Mirfak',3.405,49.86,1.80,'F',13],['Dubhe',11.062,61.75,1.80,'K',0],
    ['Kaus Australis',18.403,-34.38,1.84,'B',7],['Alkaid',13.793,49.31,1.86,'B',0],
    ['Menkalinan',5.992,44.95,1.90,'A',14],['Alhena',6.628,16.40,1.93,'A',9],
    ['Polaris',2.530,89.26,1.99,'F',1],['Alphard',9.460,-8.66,1.98,'K',-1],
    ['Mirzam',6.378,-17.96,1.98,'B',-1],['Algieba',10.333,19.84,2.00,'K',8],
    ['Hamal',2.120,23.46,2.01,'K',-1],['Diphda',0.726,-17.99,2.04,'K',-1],
    ['Nunki',18.921,-26.30,2.05,'B',7],['Alpheratz',0.140,29.09,2.07,'B',12],
    ['Mirach',1.163,35.62,2.07,'M',12],['Saiph',5.796,-9.67,2.07,'B',3],
    ['Kochab',14.845,74.16,2.07,'K',1],['Rasalhague',17.582,12.56,2.08,'A',-1],
    ['Algol',3.136,40.96,2.09,'B',13],['Almach',2.065,42.33,2.10,'K',12],
    ['Denebola',11.818,14.57,2.14,'A',8],['Sadr',20.370,40.26,2.23,'F',4],
    ['Wezen',7.140,-26.39,1.83,'F',-1],['Naos',8.059,-40.00,2.21,'O',-1],
    ['Mizar',13.399,54.93,2.23,'A',0],['Schedar',0.675,56.54,2.24,'K',2],
    ['Eltanin',17.944,51.49,2.24,'K',-1],['Mintaka',5.533,-0.30,2.25,'O',3],
    ['Caph',0.153,59.15,2.28,'F',2],['Merak',11.031,56.38,2.34,'A',0],
    ['Izar',14.750,27.07,2.35,'K',10],['Enif',21.736,9.88,2.38,'K',11],
    ['Phecda',11.897,53.69,2.41,'A',0],['Scheat',23.063,28.08,2.44,'M',11],
    ['Alderamin',21.310,62.59,2.45,'A',-1],['Markab',23.079,15.21,2.49,'B',11],
    ['Navi',0.945,60.72,2.47,'B',2],['Gienah',12.263,-17.54,2.58,'B',-1],
    ['Zubeneschamali',15.283,-9.38,2.61,'B',-1],['Albireo',19.512,27.96,3.05,'K',4],
    ['Ruchbah',1.358,60.24,2.66,'A',2],['Tarazed',19.771,10.61,2.72,'K',6],
    ['Pherkad',15.346,71.83,3.00,'A',1],['Megrez',12.257,57.03,3.31,'A',0],
    ['Algenib',0.220,15.18,2.83,'B',11],['Gienah Cygni',20.770,33.97,2.48,'K',4],
    ['Mebsuta',6.383,25.13,3.06,'G',9],['Tejat',6.383,22.51,3.06,'M',9],
    ['Wasat',7.335,21.98,3.53,'F',9],['Propus',6.248,22.51,3.31,'M',9],
    ['Zosma',11.235,20.52,2.56,'A',8],['Chertan',11.237,15.43,3.33,'A',8],
    ['Graffias',16.091,-19.81,2.56,'B',7],['Dschubba',16.005,-22.62,2.29,'B',7],
    ['Sargas',17.622,-42.99,1.86,'F',7],['Lesath',17.530,-37.29,2.69,'B',7],
    ['Girtab',17.793,-37.04,2.41,'B',7],['Delta Cyg',19.749,45.13,2.87,'B',4],
    ['Sheliak',18.835,33.36,3.52,'B',5],['Sulafat',18.982,32.69,3.25,'B',5],
    ['Eta Aql',19.874,1.01,3.87,'F',6],['Delta Aql',19.425,3.11,3.36,'F',6],
    ['HD 4628',0.813,5.37,3.74,'K',-1],['HD 10700',1.735,-15.94,3.50,'G',-1],
    ['HD 16895',2.720,5.99,4.11,'F',-1],['HD 22049',3.549,-9.46,3.73,'K',-1],
    ['HD 30652',4.830,5.60,3.19,'F',-1],['HD 34411',5.335,40.51,4.69,'G',-1],
    ['HD 39587',5.943,20.28,4.39,'G',-1],['HD 71155',8.427,-3.90,3.90,'A',-1],
    ['HD 82328',9.548,51.68,3.17,'F',0],['HD 102870',11.845,1.76,3.61,'F',-1],
    ['HD 109358',12.562,38.32,4.26,'G',-1],['HD 114710',13.197,27.88,4.24,'F',10],
    ['HD 120136',13.793,17.46,4.50,'F',-1],['HD 126660',14.418,46.09,4.04,'F',10],
    ['HD 131156',14.852,19.10,4.55,'G',10],['HD 142860',15.961,15.66,3.85,'F',-1],
    ['HD 150680',16.688,31.60,2.81,'G',-1],['HD 157214',17.380,14.39,5.38,'G',-1],
    ['HD 168913',18.350,39.67,5.00,'A',5],['HD 173667',18.746,20.55,4.19,'F',-1],
    ['HD 182572',19.370,11.85,5.17,'G',6],['HD 185144',19.632,50.22,4.68,'K',4],
    ['HD 203280',21.310,62.59,2.45,'A',-1],['HD 215648',22.780,-4.39,4.20,'F',-1],
    ['HD 219134',23.222,57.17,5.57,'K',2],['Mu Gem',6.383,22.51,2.87,'M',9],
    ['Xi UMa',11.303,31.53,3.79,'F',0],['Nu UMa',11.530,33.09,3.49,'K',0],
    ['Psi UMa',11.161,44.50,3.01,'K',0],['Theta Boo',14.420,51.85,4.05,'F',10],
    ['Rho Boo',14.530,30.37,3.58,'K',10],['Eta Cas',0.817,57.82,3.44,'F',2],
    ['Zeta Cas',0.614,53.90,3.66,'B',2],['Epsilon Per',3.964,40.01,2.90,'B',13],
    ['Zeta Per',3.902,31.88,2.86,'B',13],['Delta Per',3.715,47.79,3.01,'B',13],
    ['Theta Aur',5.995,37.21,2.62,'A',14],['Beta Aur',5.992,44.95,1.90,'A',14],
    ['Iota Aur',4.950,33.17,2.69,'K',14],['Epsilon Sco',16.836,-34.29,2.29,'K',7],
    ['Mu Sco',16.864,-38.05,3.04,'B',7],['Zeta Sco',16.897,-42.36,3.62,'B',7],
    ['Lambda Sco',17.560,-37.10,1.62,'B',7],['Theta Sco',17.622,-42.99,1.86,'F',7],
    /* ── Hipparcos catalog expansion (370 stars, ESA 1997) ──
       Source: Hipparcos catalog J2000 via gmiller123456/hip2000
       Observer: Tokyo 35.68°N, 139.65°E
       Selection: spatially balanced, magnitude-prioritized
       Format: [name, RA_hours, Dec_deg, Vmag, SpType, constellation_id] */
    ['HIP 183',0.039,-29.72,5.04,'O',-1],
    ['HIP 765',0.157,-45.75,3.88,'K',-1],
    ['HIP 841',0.172,46.07,5.01,'F',-1],
    ['HIP 1562',0.324,-8.82,3.56,'M',-1],
    ['HIP 2081',0.438,-42.31,2.4,'K',-1],
    ['HIP 3092',0.655,30.86,3.27,'M',12],
    ['HIP 3693',0.789,24.27,4.08,'K',12],
    ['HIP 3810',0.816,16.94,5.07,'F',12],
    ['HIP 4436',0.946,38.5,3.86,'A',-1],
    ['HIP 5165',1.101,-46.72,3.32,'K',-1],
    ['HIP 5317',1.134,43.94,5.04,'A',-1],
    ['HIP 5364',1.143,-10.18,3.46,'K',-1],
    ['HIP 6686',1.43,60.24,2.66,'A',2],
    ['HIP 6867',1.473,-43.32,3.41,'M',-1],
    ['HIP 7083',1.521,-49.07,3.93,'K',-1],
    ['HIP 7607',1.633,48.63,3.59,'M',13],
    ['HIP 7719',1.656,44.39,5.01,'K',-1],
    ['HIP 8068',1.728,50.69,4.01,'B',13],
    ['HIP 8241',1.768,-53.52,5.04,'A',-1],
    ['HIP 8645',1.858,-10.34,3.74,'K',-1],
    ['HIP 8796',1.885,29.58,3.42,'F',12],
    ['HIP 8886',1.907,63.67,3.35,'O',-1],
    ['HIP 8903',1.911,20.81,2.64,'A',12],
    ['HIP 9007',1.933,-51.61,3.69,'K',-1],
    ['HIP 9347',2.0,-21.08,3.99,'M',-1],
    ['HIP 9487',2.034,2.76,3.82,'A',-1],
    ['HIP 9598',2.057,72.42,3.95,'B',-1],
    ['HIP 10064',2.159,34.99,3.0,'A',-1],
    ['HIP 10602',2.275,-51.51,3.56,'O',-1],
    ['HIP 12706',2.722,3.24,3.47,'A',-1],
    ['HIP 13209',2.833,27.26,3.61,'B',-1],
    ['HIP 13268',2.845,55.9,3.77,'M',13],
    ['HIP 13531',2.904,52.76,3.93,'G',13],
    ['HIP 13701',2.94,-8.9,3.89,'K',-1],
    ['HIP 13847',2.971,-40.3,2.88,'A',-1],
    ['HIP 14135',3.038,4.09,2.54,'M',-1],
    ['HIP 14146',3.04,-23.62,4.08,'A',-1],
    ['HIP 14328',3.08,53.51,2.91,'G',13],
    ['HIP 14354',3.086,38.84,3.32,'M',-1],
    ['HIP 14879',3.201,-28.99,3.8,'F',-1],
    ['HIP 14954',3.213,-1.2,5.07,'F',-1],
    ['HIP 15474',3.325,-21.76,3.7,'M',-1],
    ['HIP 15900',3.414,9.03,3.61,'K',-1],
    ['HIP 16083',3.453,9.73,3.73,'B',-1],
    ['HIP 17296',3.703,63.22,5.06,'M',-1],
    ['HIP 17702',3.791,24.11,2.85,'B',14],
    ['HIP 18543',3.967,-13.51,2.97,'M',-1],
    ['HIP 18724',4.011,12.49,3.41,'B',14],
    ['HIP 18907',4.053,5.99,3.91,'A',14],
    ['HIP 19018',4.074,59.16,5.0,'F',-1],
    ['HIP 19343',4.144,47.71,3.96,'B',-1],
    ['HIP 19587',4.198,-6.84,4.04,'F',3],
    ['HIP 19747',4.233,-42.29,3.85,'K',-1],
    ['HIP 20042',4.298,-33.8,3.55,'O',-1],
    ['HIP 20535',4.401,-34.02,3.97,'M',-1],
    ['HIP 20894',4.478,15.87,3.4,'A',14],
    ['HIP 21060',4.514,-44.95,5.07,'O',-1],
    ['HIP 21393',4.593,-30.56,3.81,'K',-1],
    ['HIP 21444',4.605,-3.35,3.93,'O',14],
    ['HIP 21594',4.636,-14.3,3.86,'K',3],
    ['HIP 21727',4.665,53.08,5.07,'K',-1],
    ['HIP 22109',4.758,-3.25,4.01,'O',14],
    ['HIP 22449',4.831,6.96,3.19,'F',14],
    ['HIP 22479',4.837,-16.22,5.03,'K',3],
    ['HIP 22957',4.94,13.51,4.06,'K',14],
    ['HIP 23416',5.033,43.82,3.03,'F',-1],
    ['HIP 23430',5.036,-26.28,5.01,'K',3],
    ['HIP 23522',5.057,60.44,4.03,'K',-1],
    ['HIP 23649',5.083,-49.58,5.05,'M',-1],
    ['HIP 23685',5.091,-22.37,3.19,'M',3],
    ['HIP 23767',5.109,41.23,3.18,'O',-1],
    ['HIP 23875',5.131,-5.09,2.78,'A',3],
    ['HIP 24305',5.216,-16.21,3.29,'O',3],
    ['HIP 24505',5.257,-26.94,5.06,'B',3],
    ['HIP 24504',5.257,32.69,5.01,'A',-1],
    ['HIP 24879',5.334,33.96,5.05,'A',-1],
    ['HIP 25045',5.363,-24.77,5.06,'G',3],
    ['HIP 25278',5.407,17.38,5.0,'F',14],
    ['HIP 25281',5.408,-2.4,3.35,'O',14],
    ['HIP 25292',5.411,37.39,5.02,'M',-1],
    ['HIP 25606',5.471,-20.76,2.81,'K',3],
    ['HIP 25985',5.546,-17.82,2.58,'A',3],
    ['HIP 26207',5.586,9.93,3.39,'O',14],
    ['HIP 26241',5.591,-5.91,2.75,'O',3],
    ['HIP 26451',5.627,21.14,2.97,'O',14],
    ['HIP 26634',5.661,-34.07,2.65,'O',-1],
    ['HIP 27321',5.788,-51.07,3.85,'A',-1],
    ['HIP 27628',5.849,-35.77,3.12,'K',-1],
    ['HIP 28328',5.986,-42.82,3.96,'K',-1],
    ['HIP 28358',5.992,54.28,3.72,'K',-1],
    ['HIP 28675',6.054,-26.28,5.03,'M',3],
    ['HIP 29651',6.248,-6.27,3.99,'M',3],
    ['HIP 29735',6.262,-13.72,5.0,'B',3],
    ['HIP 29800',6.274,12.27,5.04,'F',9],
    ['HIP 29919',6.299,61.52,5.01,'M',-1],
    ['HIP 30122',6.339,-30.06,3.02,'O',-1],
    ['HIP 30867',6.48,-7.03,3.76,'O',3],
    ['HIP 31685',6.629,-43.2,3.17,'O',-1],
    ['HIP 32173',6.718,44.52,5.04,'M',-1],
    ['HIP 32246',6.732,25.13,3.06,'M',9],
    ['HIP 32362',6.755,12.9,3.35,'F',9],
    ['HIP 32759',6.831,-32.51,3.5,'O',-1],
    ['HIP 32768',6.832,-50.61,2.94,'M',-1],
    ['HIP 33018',6.88,33.96,3.6,'A',9],
    ['HIP 33160',6.903,-12.04,4.08,'M',-1],
    ['HIP 33856',7.029,-27.93,3.49,'M',-1],
    ['HIP 33977',7.05,-23.83,3.02,'B',-1],
    ['HIP 35264',7.286,-37.1,2.71,'M',-1],
    ['HIP 35384',7.309,49.46,5.0,'A',-1],
    ['HIP 35904',7.402,-29.3,2.45,'B',-1],
    ['HIP 36046',7.429,27.8,3.78,'K',9],
    ['HIP 36188',7.453,8.29,2.89,'B',9],
    ['HIP 36377',7.487,-43.3,3.25,'M',-1],
    ['HIP 37300',7.658,17.67,5.04,'M',9],
    ['HIP 37391',7.675,87.02,5.05,'M',-1],
    ['HIP 37447',7.687,-9.55,3.94,'K',-1],
    ['HIP 37606',7.716,-45.17,5.04,'G',-1],
    ['HIP 37819',7.754,-37.97,3.62,'M',-1],
    ['HIP 38170',7.822,-24.86,3.34,'M',-1],
    ['HIP 38414',7.87,-40.58,3.71,'K',-1],
    ['HIP 38423',7.871,-34.71,5.01,'F',-1],
    ['HIP 38827',7.946,-52.98,3.46,'O',-1],
    ['HIP 39757',8.126,-24.3,2.83,'F',-1],
    ['HIP 39953',8.159,-47.34,1.75,'O',-1],
    ['HIP 40526',8.275,9.19,3.53,'M',-1],
    ['HIP 41704',8.504,60.72,3.35,'K',-1],
    ['HIP 42515',8.668,-35.31,3.97,'K',-1],
    ['HIP 42536',8.672,-52.92,3.6,'O',-1],
    ['HIP 42570',8.677,-46.65,3.77,'G',-1],
    ['HIP 42828',8.727,-33.19,3.68,'O',-1],
    ['HIP 42884',8.74,-42.65,4.05,'K',-1],
    ['HIP 42911',8.745,18.15,3.94,'K',-1],
    ['HIP 43023',8.767,-46.04,3.87,'A',-1],
    ['HIP 43103',8.778,28.76,4.03,'K',-1],
    ['HIP 43109',8.78,6.42,3.38,'G',-1],
    ['HIP 43409',8.842,-27.71,4.02,'M',-1],
    ['HIP 43813',8.923,5.95,3.11,'K',-1],
    ['HIP 44127',8.987,48.04,3.12,'A',-1],
    ['HIP 44248',9.011,41.78,3.96,'F',-1],
    ['HIP 44471',9.06,47.16,3.57,'A',-1],
    ['HIP 44511',9.069,-47.1,3.75,'K',-1],
    ['HIP 44816',9.133,-43.43,2.23,'M',-1],
    ['HIP 45336',9.239,2.31,3.89,'B',-1],
    ['HIP 45860',9.351,34.39,3.14,'M',-1],
    ['HIP 46651',9.512,-40.47,3.6,'F',-1],
    ['HIP 46733',9.525,63.06,3.65,'F',-1],
    ['HIP 46880',9.553,-21.12,5.02,'K',-1],
    ['HIP 46950',9.569,-51.26,5.01,'O',-1],
    ['HIP 47205',9.62,6.84,5.0,'K',-1],
    ['HIP 47431',9.664,-1.14,3.9,'M',-1],
    ['HIP 47452',9.672,-14.33,5.07,'O',-1],
    ['HIP 47508',9.686,9.89,3.52,'F',-1],
    ['HIP 47908',9.764,23.77,2.97,'K',8],
    ['HIP 48319',9.85,59.04,3.78,'A',-1],
    ['HIP 48437',9.875,-8.11,5.07,'A',-1],
    ['HIP 49485',10.103,-47.37,5.06,'K',-1],
    ['HIP 49583',10.122,16.76,3.48,'B',8],
    ['HIP 49841',10.176,-12.35,3.61,'K',-1],
    ['HIP 50191',10.246,-42.12,3.85,'A',-1],
    ['HIP 50335',10.278,23.42,3.43,'F',8],
    ['HIP 50372',10.285,42.91,3.45,'A',-1],
    ['HIP 50801',10.372,41.5,3.06,'M',-1],
    ['HIP 51069',10.435,-16.84,3.83,'M',-1],
    ['HIP 51624',10.547,9.31,3.84,'O',-1],
    ['HIP 52425',10.718,69.08,5.01,'M',-1],
    ['HIP 52727',10.779,-49.42,2.69,'K',-1],
    ['HIP 52943',10.827,-16.19,3.11,'M',-1],
    ['HIP 53229',10.889,34.21,3.79,'K',-1],
    ['HIP 53721',10.991,40.43,5.03,'G',-1],
    ['HIP 55219',11.308,33.09,3.49,'M',-1],
    ['HIP 55282',11.322,-14.78,3.56,'K',-1],
    ['HIP 55434',11.352,6.03,4.05,'B',-1],
    ['HIP 55588',11.387,-36.16,5.0,'M',-1],
    ['HIP 55642',11.399,10.53,4.0,'F',8],
    ['HIP 55705',11.415,-17.68,4.06,'A',-1],
    ['HIP 56211',11.523,69.33,3.82,'M',-1],
    ['HIP 56343',11.55,-31.86,3.54,'K',-1],
    ['HIP 57399',11.768,47.78,3.69,'K',0],
    ['HIP 59196',12.139,-50.72,2.58,'O',-1],
    ['HIP 59316',12.169,-22.62,3.02,'M',-1],
    ['HIP 60129',12.332,-0.67,3.89,'A',-1],
    ['HIP 60646',12.431,39.02,5.01,'K',-1],
    ['HIP 60965',12.498,-16.52,2.94,'B',-1],
    ['HIP 61281',12.558,69.79,3.85,'O',-1],
    ['HIP 61359',12.573,-23.4,2.65,'K',-1],
    ['HIP 61418',12.585,18.38,5.03,'K',10],
    ['HIP 61932',12.692,-48.96,2.2,'B',-1],
    ['HIP 61941',12.694,-1.45,2.74,'F',-1],
    ['HIP 63090',12.927,3.4,3.39,'M',-1],
    ['HIP 63125',12.934,38.32,2.89,'O',10],
    ['HIP 63608',13.036,10.96,2.85,'K',-1],
    ['HIP 64407',13.201,-16.2,5.04,'F',-1],
    ['HIP 64962',13.315,-23.17,2.99,'K',-1],
    ['HIP 65109',13.343,-36.71,2.75,'A',-1],
    ['HIP 65810',13.49,-51.17,5.04,'A',-1],
    ['HIP 66249',13.578,-0.6,3.38,'A',-1],
    ['HIP 66657',13.665,-53.47,2.29,'O',-1],
    ['HIP 66803',13.694,-8.7,5.03,'M',-1],
    ['HIP 67464',13.825,-41.69,3.41,'O',-1],
    ['HIP 67472',13.827,-42.47,3.47,'O',-1],
    ['HIP 67927',13.911,18.4,2.68,'F',10],
    ['HIP 68002',13.926,-47.29,2.55,'O',-1],
    ['HIP 68103',13.943,27.49,5.02,'M',10],
    ['HIP 68756',14.073,64.38,3.67,'B',1],
    ['HIP 68895',14.106,-26.68,3.25,'K',-1],
    ['HIP 68933',14.111,-36.37,2.06,'K',-1],
    ['HIP 69701',14.267,-6.0,4.07,'F',-1],
    ['HIP 69996',14.323,-46.06,3.55,'O',-1],
    ['HIP 70090',14.343,-37.89,4.05,'B',-1],
    ['HIP 71075',14.535,38.31,3.04,'A',10],
    ['HIP 71352',14.592,-42.16,2.33,'O',-1],
    ['HIP 71795',14.686,13.73,3.78,'A',-1],
    ['HIP 71860',14.699,-47.39,2.3,'O',-1],
    ['HIP 71957',14.718,-5.66,3.87,'F',-1],
    ['HIP 72010',14.728,-35.17,4.06,'M',-1],
    ['HIP 72220',14.771,1.89,3.73,'B',-1],
    ['HIP 72622',14.848,-16.04,2.75,'A',-1],
    ['HIP 73273',14.976,-43.13,2.68,'O',-1],
    ['HIP 73334',14.986,-42.1,3.13,'O',-1],
    ['HIP 73555',15.032,40.39,3.49,'K',-1],
    ['HIP 73714',15.068,-25.28,3.25,'M',-1],
    ['HIP 74395',15.205,-52.1,3.41,'K',-1],
    ['HIP 74666',15.258,33.31,3.46,'K',-1],
    ['HIP 74975',15.322,1.77,5.04,'F',-1],
    ['HIP 75141',15.356,-40.65,3.22,'O',-1],
    ['HIP 75177',15.363,-36.26,3.57,'M',-1],
    ['HIP 75264',15.378,-44.69,3.37,'O',-1],
    ['HIP 75458',15.415,58.97,3.29,'K',-1],
    ['HIP 75695',15.464,29.11,3.66,'F',-1],
    ['HIP 75973',15.515,40.83,5.04,'M',-1],
    ['HIP 76008',15.524,77.35,5.0,'M',1],
    ['HIP 76267',15.578,26.71,2.22,'A',-1],
    ['HIP 76276',15.58,10.54,3.8,'A',-1],
    ['HIP 76297',15.586,-41.17,2.8,'O',7],
    ['HIP 76333',15.592,-14.79,3.91,'K',-1],
    ['HIP 77070',15.738,6.43,2.63,'K',-1],
    ['HIP 77516',15.827,-3.43,3.54,'B',-1],
    ['HIP 77634',15.849,-33.63,3.97,'B',7],
    ['HIP 77811',15.889,-20.17,5.04,'B',7],
    ['HIP 78265',15.981,-26.11,2.89,'O',7],
    ['HIP 78384',16.002,-38.4,3.42,'O',7],
    ['HIP 78527',16.031,58.57,4.01,'F',-1],
    ['HIP 79593',16.239,-3.69,2.73,'M',-1],
    ['HIP 79882',16.305,-4.69,3.23,'K',-1],
    ['HIP 79992',16.329,46.31,3.91,'O',-1],
    ['HIP 80000',16.331,-50.16,4.01,'K',-1],
    ['HIP 80112',16.353,-25.59,2.9,'A',7],
    ['HIP 80170',16.365,19.15,3.74,'A',-1],
    ['HIP 80331',16.4,61.51,2.73,'K',-1],
    ['HIP 80816',16.504,21.49,2.78,'K',-1],
    ['HIP 80883',16.515,1.98,3.82,'A',-1],
    ['HIP 81266',16.598,-28.22,2.82,'O',7],
    ['HIP 81377',16.619,-10.57,2.54,'A',-1],
    ['HIP 81833',16.715,38.92,3.48,'K',-1],
    ['HIP 82504',16.863,24.66,5.03,'M',-1],
    ['HIP 83000',16.961,9.38,3.19,'K',-1],
    ['HIP 83153',16.993,-53.16,4.06,'M',-1],
    ['HIP 83336',17.031,-32.14,5.03,'B',7],
    ['HIP 83895',17.146,65.71,3.17,'O',-1],
    ['HIP 84012',17.173,-15.72,2.43,'A',7],
    ['HIP 84143',17.203,-43.24,3.32,'F',7],
    ['HIP 84345',17.244,14.39,2.78,'K',-1],
    ['HIP 84379',17.251,24.84,3.12,'A',-1],
    ['HIP 84380',17.251,36.81,3.16,'M',-1],
    ['HIP 84833',17.339,18.06,5.01,'M',-1],
    ['HIP 84970',17.367,-25.0,3.27,'O',7],
    ['HIP 85670',17.507,52.3,2.79,'K',-1],
    ['HIP 85792',17.531,-49.88,2.84,'O',-1],
    ['HIP 86263',17.626,-15.4,3.54,'A',7],
    ['HIP 86670',17.708,-39.03,2.39,'O',7],
    ['HIP 86742',17.725,4.57,2.76,'K',-1],
    ['HIP 86974',17.774,27.72,3.42,'G',-1],
    ['HIP 87073',17.793,-40.13,2.99,'F',7],
    ['HIP 87234',17.824,76.96,5.02,'F',-1],
    ['HIP 87261',17.831,-37.04,3.19,'K',7],
    ['HIP 87585',17.892,56.87,3.73,'K',-1],
    ['HIP 87808',17.938,37.25,3.86,'M',-1],
    ['HIP 88048',17.984,-9.77,3.32,'K',-1],
    ['HIP 88192',18.011,2.93,3.93,'A',-1],
    ['HIP 88601',18.091,2.5,4.03,'K',-1],
    ['HIP 88635',18.097,-30.42,2.98,'K',-1],
    ['HIP 88745',18.117,30.56,5.05,'F',5],
    ['HIP 88771',18.122,9.56,3.71,'A',-1],
    ['HIP 88794',18.126,28.76,3.84,'B',5],
    ['HIP 89341',18.229,-21.06,3.84,'A',-1],
    ['HIP 89642',18.294,-36.76,3.1,'M',-1],
    ['HIP 89931',18.35,-29.83,2.72,'M',-1],
    ['HIP 89937',18.351,72.73,3.55,'F',-1],
    ['HIP 89962',18.355,-2.9,3.23,'K',-1],
    ['HIP 89981',18.359,49.12,5.02,'M',-1],
    ['HIP 90139',18.395,21.77,3.85,'K',-1],
    ['HIP 90422',18.45,-45.97,3.49,'O',-1],
    ['HIP 90496',18.466,-25.42,2.82,'K',-1],
    ['HIP 91117',18.587,-8.24,3.85,'M',-1],
    ['HIP 91755',18.711,55.54,5.03,'B',-1],
    ['HIP 91975',18.747,2.06,5.02,'B',6],
    ['HIP 92041',18.761,-26.99,3.17,'O',-1],
    ['HIP 93085',18.962,-21.11,3.52,'K',-1],
    ['HIP 93506',19.044,-29.88,2.6,'A',-1],
    ['HIP 93747',19.09,13.86,2.99,'A',6],
    ['HIP 93805',19.104,-4.88,3.43,'B',6],
    ['HIP 93864',19.116,-27.67,3.32,'K',-1],
    ['HIP 94141',19.163,-21.02,2.88,'F',-1],
    ['HIP 94376',19.209,67.66,3.07,'K',-1],
    ['HIP 94779',19.285,53.37,3.8,'K',-1],
    ['HIP 95241',19.377,-44.46,3.96,'B',-1],
    ['HIP 95347',19.398,-40.62,3.96,'O',-1],
    ['HIP 95853',19.495,51.73,3.76,'A',-1],
    ['HIP 95937',19.511,-2.79,5.03,'M',6],
    ['HIP 96950',19.709,-16.12,5.06,'F',-1],
    ['HIP 97365',19.79,18.53,3.68,'M',-1],
    ['HIP 97433',19.803,70.27,3.84,'K',-1],
    ['HIP 97635',19.844,52.99,5.03,'M',-1],
    ['HIP 98110',19.938,35.08,3.89,'K',4],
    ['HIP 98258',19.966,-15.49,5.01,'A',-1],
    ['HIP 98337',19.979,19.49,3.51,'M',-1],
    ['HIP 99473',20.188,-0.82,3.24,'B',6],
    ['HIP 99675',20.227,46.74,3.8,'M',4],
    ['HIP 99848',20.258,47.71,3.96,'M',4],
    ['HIP 100345',20.35,-14.78,3.05,'G',-1],
    ['HIP 101076',20.49,30.37,4.01,'F',4],
    ['HIP 101421',20.554,11.3,4.03,'O',-1],
    ['HIP 101772',20.626,-47.29,3.11,'K',-1],
    ['HIP 101769',20.626,14.6,3.64,'F',-1],
    ['HIP 101868',20.642,24.12,5.06,'O',-1],
    ['HIP 101958',20.661,15.91,3.77,'B',-1],
    ['HIP 102422',20.755,61.84,3.41,'K',-1],
    ['HIP 102618',20.795,-9.5,3.78,'A',-1],
    ['HIP 103200',20.909,28.06,5.03,'M',4],
    ['HIP 103413',20.953,41.17,3.94,'A',4],
    ['HIP 104060',21.082,43.93,3.72,'M',4],
    ['HIP 104732',21.216,30.23,3.21,'K',4],
    ['HIP 104887',21.247,38.05,3.74,'F',4],
    ['HIP 104987',21.264,5.25,3.92,'F',11],
    ['HIP 105881',21.444,-22.41,3.77,'K',-1],
    ['HIP 106032',21.478,70.56,3.23,'O',-1],
    ['HIP 106278',21.526,-5.57,2.9,'K',-1],
    ['HIP 106481',21.566,45.59,3.98,'K',-1],
    ['HIP 106711',21.616,40.41,5.04,'A',-1],
    ['HIP 107556',21.784,-16.13,2.85,'A',-1],
    ['HIP 108085',21.899,-37.36,3.0,'B',-1],
    ['HIP 108535',21.987,73.18,5.04,'F',-1],
    ['HIP 109074',22.096,-0.32,2.95,'K',-1],
    ['HIP 109176',22.117,25.35,3.77,'F',11],
    ['HIP 109268',22.137,-46.96,1.73,'B',-1],
    ['HIP 109427',22.17,6.2,3.52,'A',11],
    ['HIP 109492',22.181,58.2,3.39,'M',-1],
    ['HIP 110997',22.488,-43.5,3.97,'K',-1],
    ['HIP 111169',22.522,50.28,3.76,'A',-1],
    ['HIP 112029',22.691,10.83,3.41,'B',11],
    ['HIP 112122',22.711,-46.88,2.07,'M',-1],
    ['HIP 112158',22.717,30.22,2.93,'K',11],
    ['HIP 112440',22.776,23.57,3.97,'K',11],
    ['HIP 112623',22.809,-51.32,3.49,'A',-1],
    ['HIP 112716',22.827,-13.59,4.05,'M',-1],
    ['HIP 112724',22.828,66.2,3.5,'K',-1],
    ['HIP 112748',22.833,24.6,3.51,'K',11],
    ['HIP 112961',22.877,-7.58,3.73,'M',-1],
    ['HIP 113136',22.911,-15.82,3.27,'A',-1],
    ['HIP 113726',23.032,42.33,3.62,'B',-1],
    ['HIP 114341',23.157,-21.17,3.68,'M',-1],
    ['HIP 114347',23.159,8.68,5.05,'M',11],
    ['HIP 114421',23.173,-45.25,3.88,'K',-1],
    ['HIP 114971',23.286,3.28,3.7,'K',-1],
    ['HIP 115438',23.383,-20.1,3.96,'K',-1],
    ['HIP 116584',23.626,46.46,3.81,'K',-1],
    ['HIP 116727',23.656,77.63,3.21,'K',-1],
    ['HIP 117371',23.799,67.81,5.05,'A',-1],
    ['HIP 117718',23.875,19.12,5.06,'M',11],
    ['HIP 118268',23.989,6.86,4.03,'F',11]
  ];

  /* --- Noise instances for stars --- */
  var starTwinkleNoise = new SimplexNoise(42);
  var starCharNoise    = new SimplexNoise(137);
  var starCloudNoise   = new SimplexNoise(256);
  var starGlowNoise    = new SimplexNoise(389);
  var starConstNoise   = new SimplexNoise(512);

  /* --- Star sprite cache (separate from celestial body sprites) --- */
  var starSprites = {};
  var lastStarThemeKey = '';

  function getStarSprite(ch, size, colorStr) {
    var key = ch + '|' + size + '|' + colorStr;
    if (starSprites[key]) return starSprites[key];
    var pad = 4;
    var sc = document.createElement('canvas');
    sc.width = size + pad * 2;
    sc.height = size + pad * 2;
    var sctx = sc.getContext('2d');
    sctx.font = size + 'px ' + EMOJI_SAFE_FONT;
    sctx.fillStyle = colorStr;
    sctx.textAlign = 'center';
    sctx.textBaseline = 'middle';
    sctx.fillText(ch, sc.width / 2, sc.height / 2);
    starSprites[key] = sc;
    return sc;
  }

  function invalidateStarSprites() {
    starSprites = {};
    lastStarThemeKey = '';
  }

  /* --- Coordinate transforms --- */
  function getLocalSiderealTime(hour) {
    return (hour + TOKYO_LON / 15.0 + 12.0) % 24.0;
  }

  function equatorialToHorizontal(raHours, decDeg, lstHours) {
    var ha = (lstHours - raHours) * 15.0 * Math.PI / 180.0;
    var dec = decDeg * Math.PI / 180.0;
    var lat = TOKYO_LAT_RAD;
    var sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha);
    var alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
    var cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat));
    cosAz = Math.max(-1, Math.min(1, cosAz));
    var az = Math.acos(cosAz);
    if (Math.sin(ha) > 0) az = 2 * Math.PI - az;
    return { alt: alt, az: az };
  }

  function horizontalToScreen(alt, az, cW, cH) {
    if (alt < 0) return null;
    var zenithDist = Math.PI / 2 - alt;
    var r = zenithDist / (Math.PI / 2);
    var maxR = Math.max(cW, cH) * 0.55;
    var screenR = r * maxR;
    var x = cW / 2 - screenR * Math.sin(az);
    var y = cH / 2 - screenR * Math.cos(az);
    return { x: x, y: y, r: r };
  }

  /* --- Solar altitude & twilight model --- */
  var SOLAR_NOON = (SUNRISE_HOUR + SUNSET_HOUR) / 2;
  var DAY_LENGTH = SUNSET_HOUR - SUNRISE_HOUR;

  function getSunAltitude(hour) {
    var maxAlt = 70; /* Tokyo latitude */
    var dayFrac = (hour - SUNRISE_HOUR) / DAY_LENGTH;
    if (hour >= SUNRISE_HOUR && hour <= SUNSET_HOUR) {
      return maxAlt * Math.sin(dayFrac * Math.PI);
    }
    if (hour < SUNRISE_HOUR) {
      var nightFrac = (SUNRISE_HOUR - hour) / (24 - DAY_LENGTH);
      return -maxAlt * Math.sin(nightFrac * Math.PI);
    }
    var nightFrac = (hour - SUNSET_HOUR) / (24 - DAY_LENGTH);
    return -maxAlt * Math.sin(nightFrac * Math.PI);
  }

  function getTwilightMagLimit(sunAlt) {
    if (sunAlt >= 0) return -99;
    if (sunAlt > -6) { var t = -sunAlt / 6; return -1.5 + t * 2.5; }
    if (sunAlt > -12) { var t = (-sunAlt - 6) / 6; return 1.0 + t * 2.0; }
    if (sunAlt > -18) { var t = (-sunAlt - 12) / 6; return 3.0 + t * 2.5; }
    return 6.5;
  }

  function getTwilightDimming(sunAlt) {
    if (sunAlt >= 0) return 0;
    if (sunAlt > -6) return 0.15 + (-sunAlt / 6) * 0.35;
    if (sunAlt > -12) return 0.50 + ((-sunAlt - 6) / 6) * 0.30;
    if (sunAlt > -18) return 0.80 + ((-sunAlt - 12) / 6) * 0.20;
    return 1.0;
  }

  /* --- Scintillation (multi-layer noise twinkling) --- */
  function getStarScintillation(starIdx, time, zenithDist, magnitude, constIdx) {
    var ampBase = 0.08 + zenithDist * zenithDist * 0.50;
    var magFactor = 1.0 - Math.max(0, (2.0 - magnitude) * 0.04);
    ampBase *= magFactor;
    var fast   = starTwinkleNoise.noise2D(starIdx * 7.3 + time * 8.0, starIdx * 3.1) * 0.55;
    var medium = starTwinkleNoise.noise2D(starIdx * 11.7 + time * 3.0, starIdx * 5.9 + 100) * 0.30;
    var slow   = starTwinkleNoise.noise2D(starIdx * 2.1 + time * 0.5, starIdx * 8.7 + 200) * 0.15;
    var brightness = 1.0 + (fast + medium + slow) * ampBase;
    if (constIdx >= 0) {
      var constBreath = starConstNoise.noise2D(constIdx * 17.3 + time * 0.25, constIdx * 7.1);
      brightness += constBreath * 0.08;
    }
    var colorShift = { r: 0, g: 0, b: 0 };
    if (magnitude < 2.0 && zenithDist > 0.3) {
      var chromAmp = zenithDist * 0.12;
      colorShift.r = starTwinkleNoise.noise2D(starIdx * 13.3 + time * 12.0, 300) * chromAmp * 25;
      colorShift.g = starTwinkleNoise.noise2D(starIdx * 17.7 + time * 11.0, 400) * chromAmp * 15;
      colorShift.b = starTwinkleNoise.noise2D(starIdx * 19.1 + time * 13.0, 500) * chromAmp * 35;
    }
    return { brightness: Math.max(0.1, brightness), colorShift: colorShift };
  }

  /* --- Noise-driven character selection --- */
  function getStarChar(starIdx, time, magClass) {
    var chars;
    if (magClass === 0) chars = STAR_CHARS_BRILLIANT;
    else if (magClass === 1) chars = STAR_CHARS_BRIGHT;
    else if (magClass === 2) chars = STAR_CHARS_MEDIUM;
    else if (magClass === 3) chars = STAR_CHARS_DIM;
    else chars = STAR_CHARS_FAINT;
    var n = starCharNoise.noise2D(starIdx * 5.7 + time * 0.4, starIdx * 3.3 + 50);
    var idx = Math.floor(((n + 1) * 0.5) * chars.length) % chars.length;
    return chars[idx];
  }

  function getStarMagClass(mag) {
    if (mag < 0.5) return 0;
    if (mag < 1.5) return 1;
    if (mag < 2.5) return 2;
    if (mag < 3.5) return 3;
    return 4;
  }

  function getStarSize(mag) {
    if (mag < -0.5) return 16;
    if (mag < 0.5) return 14;
    if (mag < 1.5) return 11;
    if (mag < 2.5) return 9;
    if (mag < 3.5) return 7;
    if (mag < 4.5) return 5;
    return 4;
  }

  function getStarAlpha(mag) {
    if (mag < 0) return 1.0;
    if (mag < 1) return 0.92;
    if (mag < 2) return 0.80;
    if (mag < 3) return 0.62;
    if (mag < 4) return 0.42;
    if (mag < 5) return 0.28;
    return 0.16;
  }

  /* --- Cloud occlusion for stars --- */
  function getStarCloudOcclusion(x, y, time, cloudCover) {
    if (cloudCover <= 0) return 1.0;
    var cx = x / W * 6 + time * 0.02;
    var cy = y / H * 4;
    var density = (starCloudNoise.noise2D(cx, cy) + 1) * 0.5;
    density += (starCloudNoise.noise2D(cx * 2.5, cy * 2.5) + 1) * 0.25;
    density /= 1.5;
    var threshold = 1.0 - cloudCover;
    if (density > threshold) {
      var occlude = (density - threshold) / (1.0 - threshold);
      return Math.max(0, 1.0 - occlude * 0.95);
    }
    return 1.0;
  }

  /* --- Constellation glow field --- */
  var starConstCentroids = {};

  function computeStarConstellationCentroids(visibleStars) {
    starConstCentroids = {};
    for (var i = 0; i < visibleStars.length; i++) {
      var ci = visibleStars[i].constIdx;
      if (ci < 0) continue;
      if (!starConstCentroids[ci]) starConstCentroids[ci] = { x: 0, y: 0, count: 0, minAlpha: 1 };
      starConstCentroids[ci].x += visibleStars[i].x;
      starConstCentroids[ci].y += visibleStars[i].y;
      starConstCentroids[ci].count++;
      starConstCentroids[ci].minAlpha = Math.min(starConstCentroids[ci].minAlpha, visibleStars[i].alpha);
    }
    for (var ci in starConstCentroids) {
      starConstCentroids[ci].x /= starConstCentroids[ci].count;
      starConstCentroids[ci].y /= starConstCentroids[ci].count;
    }
  }

  function renderConstellationGlow(time, bgLum) {
    for (var ci in starConstCentroids) {
      var c = starConstCentroids[ci];
      if (c.count < 2 || c.minAlpha < 0.05) continue;
      var breath = starConstNoise.noise2D(ci * 17.3 + time * 0.25, ci * 7.1);
      var glowAlpha = c.minAlpha * 0.025 * (1.0 + breath * 0.4);
      if (glowAlpha < 0.003) continue;
      var radius = Math.min(W, H) * 0.08 * (1.0 + c.count * 0.02);
      var grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, radius);
      var glowColor = bgLum < 0.3 ? '180,170,210' : '60,50,80';
      grad.addColorStop(0, 'rgba(' + glowColor + ',' + glowAlpha + ')');
      grad.addColorStop(0.6, 'rgba(' + glowColor + ',' + (glowAlpha * 0.3) + ')');
      grad.addColorStop(1, 'rgba(' + glowColor + ',0)');
      ctx.fillStyle = grad;
      ctx.fillRect(c.x - radius, c.y - radius, radius * 2, radius * 2);
    }
  }

  /* --- Main star rendering function --- */
  function renderStars(time) {
    var preset = activePreset;
    var starVis = typeof preset.starVis !== 'undefined' ? preset.starVis : 0.5;
    if (starVis <= 0) return;

    /* Twilight model */
    var sunAlt = getSunAltitude(celestialHour);
    var twilightMagLimit = getTwilightMagLimit(sunAlt);
    var twilightDim = getTwilightDimming(sunAlt);
    if (twilightDim <= 0) return; /* Daytime — no stars */

    var lst = getLocalSiderealTime(celestialHour);
    var cloudCover = preset.celestialCloudCoverage || 0;
    var fogDim = 1.0 - (preset.fogHalo || 0) * 0.6;
    var hazeDim = 1.0 - (preset.hazeFactor || 0) * 0.4;

    /* Theme-aware color setup */
    refreshCelestialThemeColors();
    var bgLum = wcagLuminance(cachedBgColor.r, cachedBgColor.g, cachedBgColor.b);
    var blendT = bgLum > 0.3 ? 0.45 : 0.08;

    var visibleStars = [];

    for (var i = 0; i < STAR_CATALOG.length; i++) {
      var star = STAR_CATALOG[i];
      var ra = star[1], dec = star[2], mag = star[3], spec = star[4], constIdx = star[5];

      if (mag > twilightMagLimit) continue;

      var horiz = equatorialToHorizontal(ra, dec, lst);
      if (horiz.alt <= 0) continue;

      var screen = horizontalToScreen(horiz.alt, horiz.az, W, H);
      if (!screen) continue;
      if (screen.x < -20 || screen.x > W + 20 || screen.y < -20 || screen.y > H + 20) continue;

      /* Weather visibility */
      var cloudOcc = getStarCloudOcclusion(screen.x, screen.y, time, cloudCover);
      var totalVis = starVis * cloudOcc * fogDim * hazeDim;
      if (totalVis < 0.01) continue;

      /* Scintillation */
      var zenithDist = screen.r;
      var scint = getStarScintillation(i, time, zenithDist, mag, constIdx);

      /* Star color with chromatic scintillation */
      var baseColor = SPECTRAL_COLORS[spec] || SPECTRAL_COLORS['A'];
      var r = clamp(Math.round(baseColor.r + scint.colorShift.r), 0, 255);
      var g = clamp(Math.round(baseColor.g + scint.colorShift.g), 0, 255);
      var b = clamp(Math.round(baseColor.b + scint.colorShift.b), 0, 255);

      /* Theme-aware color blending */
      var rawColor = { r: r, g: g, b: b };
      var blended = themeBlendColor(rawColor, cachedWeatherColor, blendT);
      var finalColor = ensureCelestialContrast(blended, cachedBgColor, cachedWeatherColor);
      r = finalColor.r; g = finalColor.g; b = finalColor.b;

      var colorStr = 'rgb(' + r + ',' + g + ',' + b + ')';
      var alpha = getStarAlpha(mag) * scint.brightness * totalVis * twilightDim;
      alpha = clamp(alpha, 0, 1);
      if (alpha < 0.02) continue;

      /* Noise-driven character selection */
      var magClass = getStarMagClass(mag);
      var ch = getStarChar(i, time, magClass);
      var size = getStarSize(mag);

      /* Draw via sprite cache */
      ctx.globalAlpha = alpha;
      var sprite = getStarSprite(ch, size, colorStr);
      ctx.drawImage(sprite, screen.x - sprite.width / 2, screen.y - sprite.height / 2);

      /* Glow halo for bright stars */
      if (mag < 1.5 && alpha > 0.25) {
        var glowPulse = starGlowNoise.noise2D(i * 4.3 + time * 0.6, i * 2.7);
        var glowAlpha = alpha * 0.12 * (1.5 - mag) / 2.0 * (0.8 + glowPulse * 0.2);
        if (glowAlpha > 0.005) {
          ctx.globalAlpha = glowAlpha;
          var glowSize = Math.round(size * (2.2 + glowPulse * 0.5));
          var glowSprite = getStarSprite('\u2727', glowSize, colorStr);
          ctx.drawImage(glowSprite, screen.x - glowSprite.width / 2, screen.y - glowSprite.height / 2);
        }
      }

      /* Diffraction spikes for the very brightest (mag < 0) */
      if (mag < 0 && alpha > 0.4) {
        var spikeGate = starGlowNoise.noise2D(i * 9.1 + time * 1.5, 700);
        if (spikeGate > 0.15) {
          var spikeAlpha = alpha * 0.15 * (spikeGate - 0.15) / 0.85;
          ctx.globalAlpha = spikeAlpha;
          ctx.strokeStyle = colorStr;
          ctx.lineWidth = 0.5;
          var spikeLen = size * 1.2 * scint.brightness;
          ctx.beginPath();
          ctx.moveTo(screen.x - spikeLen, screen.y);
          ctx.lineTo(screen.x + spikeLen, screen.y);
          ctx.moveTo(screen.x, screen.y - spikeLen);
          ctx.lineTo(screen.x, screen.y + spikeLen);
          ctx.stroke();
        }
      }

      visibleStars.push({ x: screen.x, y: screen.y, alpha: alpha, constIdx: constIdx });
    }

    /* Constellation glow fields */
    computeStarConstellationCentroids(visibleStars);
    renderConstellationGlow(time, bgLum);

    ctx.globalAlpha = 1;
  }

  /* ============================================================
     14b. ARCH DOOR (DEMO ONLY)
     Medieval pointed-arch door traced from Freepik reference image
     using image-to-unicode-art halfblock converter.
     Theme-aware: colors remapped from luminance to site palette.
     Interactive: triple-click triggers center-move + dissolve + page nav.
     Reference: freepik.com/premium-psd/old-wooden-arch-door-medieval-fantasy-entrance_412394059
     ============================================================ */

  // Door pixel art — luminance-only data extracted from the traced image.
  // Each cell: luminance 0-255 (0=transparent), or [fgLum, bgLum] for halfblock.
  // We store pre-computed luminance so theme remapping is fast at render time.
  var DOOR_ART_COLS = 50;
  var DOOR_ART_ROWS = 16;

  // Pre-computed luminance for each cell: [fgLuminance, bgLuminance] or 0 (transparent)
  // Luminance = 0.299*R + 0.587*G + 0.114*B (standard perceptual)
  var DOOR_LUM; // populated by parseDoorLuminance() at init

  // Original door art data (fg/bg hex pairs) — kept for luminance extraction
  var DOOR_ART = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,['#2d222c',0],['#624e46',0],['#906e55',0],['#865d43',0],['#bc884f','#6c584e'],['#ffe493','#b18f68'],['#e7ad6d','#c39464'],['#edaf70','#ad825b'],['#b7854f','#8e7058'],['#614029','#1d121f'],['#a47f5e',0],['#8b6d59',0],['#544443',0],['#150e20',0],0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,['#261a27',0],['#bb976d',0],['#ffe69f','#150c20'],['#f9c687','#53403b'],['#ebb779','#9d7f60'],['#dbad72','#e0b37b'],['#ba9067','#ffcd86'],['#e1b27c','#f3b56d'],['#dca870','#e5a562'],['#d9a26b','#c18c5a'],['#b9804d','#734927'],['#764726','#ac774e'],['#c0834d','#e3a96e'],['#6f4120','#e7ae6d'],['#805530','#5e3a1d'],['#ffc47d','#ae8359'],['#f4ba7a','#dda56b'],['#fbc987','#fdc179'],['#f3c98c','#ffd188'],['#e9c188','#ffe2a3'],['#f2c68a','#caa882'],['#ffd696','#897362'],['#ffdf9f','#44373a'],['#ffe3a0','#0e091f'],['#765d46',0],0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,['#4b3e40',0],['#d2ae85',0],['#ffcb8f','#665550'],['#e4b57b','#ebc58c'],['#ca9e71','#f0c285'],['#dbb081','#9a6c45'],['#aa7e53','#be8d53'],['#8e5d36','#d4a979'],['#c78f56','#cfa577'],['#754c27','#d1a478'],['#2f1100','#bb8d65'],['#000000','#926643'],['#000000','#533018'],['#2d1300','#351403'],['#482a12',0],['#492a14',0],['#452913',0],['#4f321f',0],['#603a20',0],['#694124','#341502'],['#321506','#623a19'],['#522b13','#96653b'],['#401a05','#cb9a64'],['#653919','#e8b880'],['#9b6a3b','#f1c48a'],['#b68350','#d4a878'],['#613b21','#c99e6d'],['#967355','#734d27'],['#e8be8f','#7e5d3c'],['#e2b985','#ffd599'],['#e1b27a','#d4b284'],['#d7a978','#43343a'],['#a48469',0],['#2d202b',0],0,0,0,0,0,0,0,0],
  [0,0,0,0,0,['#796759',0],['#ffe7a6','#2c2531'],['#c99563','#d4ae82'],['#d0a16f','#e2ab70'],['#d8af7a','#c49763'],['#b48b5e','#bf9668'],['#d2a370','#cea176'],['#c2905b','#ffd997'],['#3c1a05','#efbd7b'],['#000000','#8b623a'],['#2e1808',0],['#51321d',0],['#4a2e1a',0],['#6e4629','#381e0b'],['#704a31','#3f2516'],['#744d2b','#4b2a16'],['#825635','#654123'],['#a76e3e','#865733'],['#9c6a3d','#9d673d'],['#543d28','#794f2e'],['#855838','#865b3b'],['#ba814f','#93613a'],['#b37b49','#a97041'],['#794b2b','#724826'],['#9d693d','#8e5f37'],['#a26c3d','#82542d'],['#b27844','#86572b'],['#7e5129','#4c2609'],['#9b6639','#512a0f'],['#7b4b25','#48230b'],['#4d2509','#bd8957'],['#7f4d23','#ffd08d'],['#c9965e','#f3cb91'],['#b68f61','#b78e66'],['#b28e69','#a98157'],['#d9b385','#b78a5a'],['#e9c089','#f7c789'],['#e0af78','#bb9b7b'],['#f1c894','#120b20'],['#403138',0],0,0,0,0,0],
  [0,0,0,['#77655a',0],['#fac786','#927f6e'],['#d4a571','#ffffc2'],['#d7ab79','#ffd494'],['#e3b980','#d8ac76'],['#e1b07b','#d2a774'],['#f8c88e','#d5ab7d'],['#ae7c4c','#f0c089'],['#331500','#906437'],['#492c15',0],['#684123',0],['#593720','#402614'],['#66462f','#69442a'],['#774e30','#714c2e'],['#855c36','#5e3b23'],['#d2995e','#af7b4b'],['#bd8651','#a26f46'],['#90643c','#97673a'],['#724e31','#9d673e'],['#825834','#ab7345'],['#523921','#61472a'],['#493623','#2a1f13'],['#543a24','#4b3220'],['#734d2e','#aa764a'],['#7b5432','#c98c54'],['#885c36','#855630'],['#b47c4c','#ad7648'],['#be854f','#c0874f'],['#b37f4c','#b67f48'],['#7e512f','#815230'],['#b8804f','#9d693d'],['#aa7343','#b17644'],['#9a663e','#9d6c3c'],['#8b5730','#502c16'],['#94643d','#5e3216'],['#6e3713','#b07b49'],['#cf9961','#ecc28d'],['#eac18f','#c9a076'],['#c49968','#cda372'],['#e4b880','#edc48d'],['#d4ac79','#ffdf9e'],['#c79b66','#ffd898'],['#d2a774','#5a4a49'],['#403238',0],0,0,0],
  [0,0,['#c2a785','#3a2f39'],['#ffdf99','#ffe3a2'],['#dfb07e','#d9ac7d'],['#d8ad7e','#d3a87a'],['#edc28d','#ca9d6e'],['#f4c894','#cfa26d'],['#ffcf8f','#cc9f6b'],['#623a19','#b78854'],['#270d00','#451e06'],['#633f23','#44270f'],['#5b3619','#643e20'],['#5e3d25','#623b1f'],['#4a3121','#543522'],['#603e2d','#5d3c2b'],['#65422b','#64422a'],['#93643a','#8d6037'],['#d49c61','#dba264'],['#c58c54','#c78d54'],['#a67349','#855a3a'],['#bc8450','#684b2a'],['#815130','#a37041'],['#422918','#714d2c'],['#1a140c','#2f2117'],['#402c1a','#835938'],['#8a5e3a','#845936'],['#b57a4d','#5c3d26'],['#8f6137','#8d6138'],['#bc8652','#b07a4b'],['#be864f','#b27d4d'],['#be8953','#b98453'],['#653f25','#5c381e'],['#a06f48','#84593a'],['#a06b41','#794f33'],['#bc804a','#97643f'],['#935c30','#8c572d'],['#9b673f','#ab7244'],['#b27544','#9f6738'],['#905b36','#875125'],['#865026','#b68656'],['#ffd996','#bb9565'],['#c19a70','#cc9e6a'],['#c99e73','#b88e60'],['#ad8462','#b38a66'],['#cfa474','#c3996d'],['#fcca8a','#d1a677'],['#705a51','#120c21'],0,0],
  [0,['#191428',0],['#e5b278','#fedea6'],['#b5804c','#f8c787'],['#a87648','#cfa075'],['#9e6e41','#e7ba89'],['#9a683a','#f4cc92'],['#9d6c3f','#f8ce94'],['#8d5c32','#dca870'],['#000000','#3f1d07'],['#5f3c1c','#513016'],['#674026','#634026'],['#512c13','#4f2d17'],['#7e512e','#71492c'],['#6b4530','#573a27'],['#815438','#5c3e2c'],['#815337','#5d3d2a'],['#96653b','#8f5e34'],['#d69c60','#c18b56'],['#c08953','#ba834e'],['#a26d43','#a06b42'],['#c68b54','#d49a5f'],['#ba7c49','#c7844d'],['#b27848','#93613a'],['#845932','#2b2217'],['#a47148','#865c3a'],['#af7649','#c68656'],['#b0784b','#b67b4c'],['#885733','#885a34'],['#b27d4f','#b98552'],['#a36f45','#b77f4e'],['#b88251','#bb8652'],['#906034','#7d532f'],['#a26e47','#ac7849'],['#ad7449','#b37846'],['#cf8e53','#cb8d53'],['#936030','#996535'],['#9d6640','#95623d'],['#b47747','#a16a40'],['#c08045','#b17442'],['#674120','#6c3d1b'],['#9c673a','#dcab71'],['#a77342','#d3ab7f'],['#996437','#d8a979'],['#95643a','#ad8563'],['#96653e','#a9805e'],['#ad7748','#d6a570'],['#b78c65','#8f7259'],0,0],
  [0,['#000000','#3a2c34'],['#dcb281','#ca8f56'],['#a97c50','#976235'],['#a4744c','#a47144'],['#926546','#9a6940'],['#a57752','#7e4e2d'],['#b37e56','#8d5e39'],['#6e4224','#8f6038'],0,['#623c1d','#5e381a'],['#674226','#623d25'],['#623a1b','#5e3718'],['#815432','#7b4f2d'],['#795034','#65412f'],['#98623d','#925e3b'],['#905f3d','#94603a'],['#764f2e','#906139'],['#cf935c','#d69c60'],['#b2784a','#ba834f'],['#895a33','#9c6942'],['#bd7f4c','#d19258'],['#ae7446','#c1834b'],['#8f5f3b','#c38753'],['#70482d','#96653f'],['#a6744d','#b17a50'],['#a46a43','#a96f47'],['#aa6e46','#aa6f45'],['#875532','#8c5c36'],['#c08955','#c78f58'],['#9c6943','#986842'],['#996e47','#aa784d'],['#6a4727','#875730'],['#9a653e','#92623e'],['#ae7144','#a66c43'],['#be7f4c','#c7884e'],['#8c562a','#91592f'],['#be874e','#ae7746'],['#b07748','#b87b49'],['#ca8f54','#c7874e'],['#3b1a05','#5d3617'],['#865a31','#9b6639'],['#c48e60','#96663d'],['#895d41','#77492a'],['#704b33','#8a5b37'],['#704c32','#7f5633'],['#724b31','#875930'],['#6c503f','#986e46'],[0,'#100a1d'],0],
  [0,['#0e0922','#120b21'],['#ffcf91','#ffe49e'],['#b27f51','#dda972'],['#b0815d','#d0a173'],['#bf8f60','#edbd80'],['#a97b55','#fdcb83'],['#ab774f','#efb678'],['#754526','#9a653a'],0,['#1f180a','#3f2712'],['#32281d','#583a24'],['#522d12','#643c1d'],['#7b482b','#7e4f2d'],['#865334','#7e5033'],['#895438','#8f5c3a'],['#985f3c','#9c633b'],['#84522d','#83512f'],['#ce8e55','#d2965d'],['#ce8f53','#bc804c'],['#986239','#875730'],['#c48450','#936038'],['#b97a45','#8a5837'],['#ac7346','#b57a49'],['#835934','#9d6e3f'],['#a06b42','#ab7347'],['#a76e44','#ab7346'],['#a36940','#a86e43'],['#8e5c36','#8e5c34'],['#b27e4f','#b27e4d'],['#b57e4e','#b47b4e'],['#ae7d4d','#906543'],['#74492b','#472b16'],['#7c5339','#825538'],['#8e5b3b','#99653c'],['#d89753','#cf9153'],['#805631','#8b5329'],['#7b5834','#c1884e'],['#9c6b3f','#ce9056'],['#da9857','#d2965a'],['#5b3617','#48260c'],['#764929','#a16e3f'],['#8c5f43','#e0a771'],['#7d563d','#e4ae71'],['#8a6447','#c09162'],['#825c44','#a97f5a'],['#9b6f48','#daa56d'],['#b0875f','#d0a475'],0,0],
  [0,0,['#ffd897','#bd8f64'],['#ffde93','#bf8d61'],['#f1c184','#cc9864'],['#daa56e','#ab7a50'],['#a17b5b','#8a6146'],['#986e4e','#906241'],['#5d3313','#4b280e'],0,['#281f12','#2d2417'],['#483b2a','#443a2a'],['#4d4538','#4d3c2c'],['#4b4437','#4e3b2c'],['#4d4332','#523f2c'],['#574431','#503b2c'],['#53422f','#543b28'],['#3d3223','#44321f'],['#31271c','#4b3824'],['#292015','#5b442c'],['#17140f','#66482c'],['#000000','#956841'],['#483222','#bb7e4a'],['#af7546','#b9804c'],['#96633a','#95623a'],['#8c5e3d','#936141'],['#a87046','#a56f47'],['#aa7143','#ab6f45'],['#835530','#895733'],['#ab774a','#aa7647'],['#bd8452','#bb824e'],['#ca9357','#b98450'],['#683f23','#704827'],['#9e673f','#91603d'],['#95673f','#b37243'],['#493622','#90633b'],['#4d2a13','#342a21'],['#000000','#201d16'],['#3b1f09','#1e1811'],['#7b5e41','#875f3a'],['#000000','#48270c'],['#6d3b17','#613718'],['#f0b77d','#c4915e'],['#8f6c54','#7a5840'],['#b4875a','#7e583d'],['#ebba7c','#a97a51'],['#facb83','#986c47'],['#9f7556','#654434'],0,0],
  [0,0,['#ffe59d','#ffe39e'],['#efbd7a','#d5a871'],['#e0ab76','#b38961'],['#ebbd85','#c49564'],['#efc38d','#e1b584'],['#b38459','#ac7e59'],['#6d3f1e','#603515'],0,['#2e1b0a','#201910'],['#55361b','#2a2118'],['#673d1f','#2b1506'],['#704329','#3d220f'],['#613f2b','#462b1a'],['#643e2e','#523321'],['#5f3a27','#4a3120'],['#835331','#4b301c'],['#cc8a51','#66462a'],['#b47648','#64442a'],['#764c2e','#503118'],['#d19158','#915f37'],['#bb7944','#9f6539'],['#cb8d51','#be814a'],['#8c5d37','#865a36'],['#94613f','#895c3e'],['#93613c','#a16940'],['#965f3e','#9e653d'],['#7a492c','#815330'],['#af7849','#b17c4c'],['#c28651','#c38a55'],['#ab7747','#c58e56'],['#60371c','#60371c'],['#8e613d','#9e683d'],['#87522f','#5d3b1d'],['#89562e','#402f1b'],['#5a381f','#54351a'],['#28160c',0],['#452e17','#462b11'],['#674223','#6a5032'],['#381807',0],['#835325','#76471d'],['#ffd28f','#ffcd90'],['#d8ae7f','#b6916f'],['#b2875d','#8d6646'],['#c29366','#b2875e'],['#e2ae70','#c89865'],['#bd8f61','#ac815a'],0,0],
  [0,['#000000','#0e081e'],['#ffe89a','#fbc88b'],['#f4c280','#ca9968'],['#c89a6c','#c1946b'],['#946a4a','#cda276'],['#a87d54','#ddac76'],['#c2905e','#ab7d55'],['#6f401e','#5d3317'],0,['#432914','#6a4324'],['#774d2d','#81542f'],['#764925','#784c26'],['#704327','#764c2d'],['#6f452c','#66412a'],['#905b3a','#6b442c'],['#855335','#6f472e'],['#885730','#83532e'],['#be8250','#bd8252'],['#c6874e','#b17646'],['#81502b','#6c4326'],['#c1844e','#b47849'],['#c0824c','#c07f4a'],['#ae7443','#cf8f52'],['#784829','#885930'],['#764f35','#744b34'],['#93613f','#784f37'],['#a06640','#96603b'],['#663b22','#714428'],['#b07846','#9e6740'],['#d49656','#b37a4a'],['#c98c53','#b07748'],['#60351b','#653b20'],['#b57b49','#ac7346'],['#b17542','#ad703f'],['#9e6438','#b87a42'],['#724528','#86532c'],['#74492e','#7a4a2c'],['#a56f44','#b67748'],['#ae764b','#c18551'],['#2d1407','#46230f'],['#7c4b1e','#72441b'],['#ffd08b','#ffd38f'],['#c39869','#e1b47d'],['#8f6343','#8f694e'],['#b2895f','#956e53'],['#dfab70','#ba885b'],['#c4925e','#966d4b'],0,0],
  [0,['#0e091e',0],['#ffeda1','#ffda92'],['#fbca86','#ffcf8a'],['#f8c887','#eab579'],['#e5b77c','#bd8b5a'],['#ddaf7c','#845f49'],['#be8d5d','#906747'],['#845329','#8b582d'],0,['#764e29','#4d2f1a'],['#a47340','#875b34'],['#704522','#6e4222'],['#5e3722','#6c4027'],['#5d3f2b','#66402b'],['#7a5134','#8b5d39'],['#955f3a','#8b5b3a'],['#945e34','#8a5b32'],['#b77d4b','#bd804d'],['#c2864e','#b97c49'],['#784c2a','#7c4e2b'],['#bd864d','#c98f53'],['#cd8e53','#b67945'],['#d09051','#a56a3d'],['#7b522c','#6a4125'],['#855439','#84563a'],['#9f663a','#a46c41'],['#a7693c','#ab6d40'],['#60351f','#6e4026'],['#ba824c','#bd874e'],['#ca894e','#d79957'],['#ba7d46','#cb8c4f'],['#5b331b','#63391e'],['#a87143','#b67f49'],['#ae6e3e','#b97846'],['#a87040','#9d683d'],['#925d2f','#7c4b28'],['#975f3a','#7d4e31'],['#b67d49','#a06942'],['#bf824d','#ab7347'],['#3c1a0a','#270d02'],['#805224','#804d23'],['#ffea9a','#f4bc7d'],['#ebc28d','#aa8362'],['#a9815d','#a0714d'],['#af825c','#c1905e'],['#b8885a','#d2a16a'],['#c69664','#bb8b5d'],0,0],
  [0,['#29202f',0],['#d3a16c','#ffd38f'],['#ae7a4c','#ebb97b'],['#97613a','#cf9d68'],['#8d5934','#d9a365'],['#95643f','#d19d64'],['#b48054','#916741'],['#5f3b1d','#583217'],0,['#724622','#714724'],['#946535','#a36f3e'],['#6b4524','#5f391c'],['#4e2f1d','#462618'],['#68412b','#614027'],['#7e4f32','#794c30'],['#98633b','#a96e3f'],['#8e5c33','#965f32'],['#99663e','#b97c49'],['#ae7645','#d59858'],['#835733','#8a592f'],['#ac7647','#c3874e'],['#af7143','#c1824b'],['#a77043','#d39051'],['#7b4b2e','#87582d'],['#75492d','#7f4e32'],['#8d5833','#a3693e'],['#78492c','#885633'],['#73462b','#6c4022'],['#a46b3e','#c5874b'],['#9e653e','#bc7d47'],['#945e38','#ba7b45'],['#774625','#714120'],['#a0673a','#a66d3c'],['#a46c3f','#9f663c'],['#9c673b','#a3693d'],['#89552f','#865129'],['#a56d3d','#af7542'],['#9a6138','#ae7545'],['#b57a47','#c78853'],['#4c270e','#4a250e'],['#4c270c','#603613'],['#eaac70','#fabb78'],['#b37b4e','#e1b175'],['#a66c3f','#d79d61'],['#af7545','#b98454'],['#a9764b','#906646'],['#ac8158','#a47953'],['#201a29',0],0],
  [['#b39572','#5c4e4a'],['#ffe9a3','#fff1ae'],['#e0b583','#e7b982'],['#d5ad7e','#c29771'],['#cba277','#d09d70'],['#c29a6d','#c39265'],['#b58d67','#b6865b'],['#c1966c','#d3a271'],['#906946','#cc9561'],['#3a1e07','#3e1e08'],['#3e210a','#553115'],['#5a361b','#3d260f'],['#402710','#2b1f13'],['#4e2c14','#845a35'],['#4a2c1a','#905f3a'],['#4a2c1a','#5d412d'],['#5f361e','#161411'],['#643b21','#5b3c27'],['#684027','#352319'],['#754b2b','#38281b'],['#5e381e','#795339'],['#754929','#774e35'],['#663e23','#3a291d'],['#6f4427','#231b13'],['#683e1f','#8d633e'],['#764b28','#8a5e39'],['#87542c','#8b5e3b'],['#704422','#4f3b27'],['#503014','#2b2216'],['#996336','#764d2f'],['#8d5b30','#825534'],['#7b4e29','#503d2c'],['#4e2c10','#362b1c'],['#7f4f29','#754d30'],['#643e22','#7c5133'],['#674025','#885836'],['#57331b','#5d4129'],['#654221','#271d14'],['#825229','#4e280f'],['#976237','#9b6538'],['#6a3d18','#7d491f'],['#ce935c','#cc8e56'],['#dbac79','#e8af77'],['#ca9d6e','#bb8659'],['#d0a171','#bf8c5f'],['#c1976c','#c08c65'],['#bf976d','#c0956f'],['#b58d65','#f4c58b'],['#bd8c63','#eabf8a'],['#6b5142','#3a2c31']],
  [['#9d7b5c','#be9974'],['#b27f4e','#fecb88'],['#8b603d','#dbb07c'],['#ac7f52','#e7bb81'],['#976d45','#dfb380'],['#a17146','#e8b87f'],['#976742','#e3b376'],['#926542','#deac71'],['#684730','#765437'],['#271615','#271200'],['#1f1217','#54320f'],['#311f1f','#85562b'],['#23151a','#583514'],['#231319','#5c3315'],['#27161a','#60381e'],['#372223','#8c562f'],['#3a2624','#ba743d'],['#2d1b1f','#774725'],['#3e2828','#a1683c'],['#422c2a','#b47943'],['#392424','#835026'],['#3e2828','#ae6f3c'],['#402828','#b8743e'],['#452b28','#c37a42'],['#372022','#7f4722'],['#3a2424','#9c5f36'],['#352022','#a36533'],['#301b1e','#a26133'],['#311d1f','#7d4622'],['#422b28','#c7864c'],['#462d2a','#b47541'],['#3a2426','#9c6236'],['#342022','#854b25'],['#442c2a','#bf7b40'],['#422b27','#b5743d'],['#422a27','#9b6336'],['#301b1e','#8c5528'],['#341e20','#ad6e38'],['#422a28','#c27d41'],['#382324','#9b6233'],['#3a2222','#a66a36'],['#7e5028','#c48a51'],['#c28c5c','#e2ab72'],['#9e7252','#c09168'],['#a57b56','#c59768'],['#a37a55','#b18a63'],['#a57b57','#b38e6b'],['#9e7a5a','#d4a673'],['#8e6d50','#c89d6e'],['#4b3730','#6d5345']]
  ];

  /**
   * Parse DOOR_ART into a luminance-only array for theme remapping.
   * Luminance = 0.299*R + 0.587*G + 0.114*B (ITU-R BT.601)
   */
  function parseDoorLuminance() {
    DOOR_LUM = [];
    for (var r = 0; r < DOOR_ART.length; r++) {
      var row = DOOR_ART[r];
      var lumRow = [];
      for (var c = 0; c < row.length; c++) {
        var cell = row[c];
        if (!cell) { lumRow.push(0); continue; }
        var fgL = cell[0] ? hexToLum(cell[0]) : -1;
        var bgL = cell[1] ? hexToLum(cell[1]) : -1;
        lumRow.push([fgL, bgL]);
      }
      DOOR_LUM.push(lumRow);
    }
  }

  function hexToLum(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  /**
   * Map a luminance value (0-1) to a theme-aware color.
   * Uses --color-bg as the dark end and a brightened --color-weather as the light end.
   * Applies a contrast boost so the door stands out from the background.
   */
  function lumToThemeColor(lum, bgRGB, fgRGB) {
    /* Boost contrast: remap 0-1 luminance to a narrower range that
       stays clearly above the background */
    var lo = 0.25;  /* minimum brightness offset from bg */
    var hi = 0.95;  /* maximum brightness */
    var t = lo + lum * (hi - lo);

    var r = Math.round(bgRGB[0] + t * (fgRGB[0] - bgRGB[0]));
    var g = Math.round(bgRGB[1] + t * (fgRGB[1] - bgRGB[1]));
    var b = Math.round(bgRGB[2] + t * (fgRGB[2] - bgRGB[2]));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function parseHexToRGB(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16)
    ];
  }

  function getCSSColor(prop, fallback) {
    var v = getComputedStyle(document.documentElement)
      .getPropertyValue(prop).trim();
    return v || fallback;
  }

  /* --- Door state --- */
  var doorEnabled = !!document.querySelector('.demo-banner');
  var doorOffscreen = null;
  var doorDrawX = 0;
  var doorDrawY = 0;
  var doorDirty = true;
  var doorLastW = 0;
  var doorLastH = 0;
  var doorLastBg = '';
  var doorLastWeather = '';
  var doorBaseW = 0;   /* base dimensions (before animation scale) */
  var doorBaseH = 0;
  var doorBaseX = 0;
  var doorBaseY = 0;

  /* --- Chat bubble state --- */
  var bubbleOffscreen = null;
  var bubbleW = 0;
  var bubbleH = 0;
  var bubbleFloatPhase = 0;  /* radians — drives sine-wave bobbing */
  var bubbleLastLang = '';    /* tracks current language for re-render */

  /* --- Interaction state --- */
  var doorKnocks = 0;
  var doorKnockTimer = 0;
  var KNOCK_TIMEOUT = 2000; /* ms — must knock 3 times within this window */
  var doorAnimating = false;
  var doorAnimPhase = 'idle'; /* idle | moving | dissolving | done */
  var doorAnimProgress = 0;
  var doorAnimX = 0;
  var doorAnimY = 0;
  var doorAnimScale = 1;
  var doorStartX = 0;
  var doorStartY = 0;
  var doorTargetX = 0;
  var doorTargetY = 0;
  var MOVE_DURATION = 1000;   /* ms to move to center */
  var DISSOLVE_DURATION = 1000; /* ms for top-to-bottom dissolve */
  var doorDissolveProgress = 0;
  var weatherFadeAlpha = 1;     /* 1 = full, fades to 0 during door animation */

  /* Initialize luminance data */
  parseDoorLuminance();

  /**
   * Get the translated bubble text for the current language.
   * Falls back to English if the key or language is missing.
   */
  function getBubbleText() {
    var lang = document.documentElement.lang || 'en';
    var i18nData = window.i18n;
    if (i18nData && i18nData.translations) {
      var langData = i18nData.translations[lang] || i18nData.translations['en'];
      if (langData && langData['door-bubble']) return langData['door-bubble'];
    }
    return 'Knock thrice to enter';
  }

  /**
   * Render the chat bubble above the door.
   * Theme-aware colors, i18n text, 10% smaller than door width would suggest.
   */
  function renderBubble(doorW) {
    var style = getComputedStyle(document.documentElement);
    var borderColor = style.getPropertyValue('--color-border').trim() || '#382838';
    var textColor = style.getPropertyValue('--color-text').trim() || '#d8c8d0';
    var bgColor = style.getPropertyValue('--color-bg-subtle').trim() || '#1e1828';

    var text = getBubbleText();
    bubbleLastLang = document.documentElement.lang || 'en';

    /* 10% smaller: scale factor 0.9 applied to font size */
    var fontSize = Math.max(9, Math.round(doorW * 0.085 * 0.9));
    var padding = Math.round(fontSize * 0.6);
    var tailH = Math.round(fontSize * 0.5);

    /* Measure text */
    var measureCanvas = document.createElement('canvas');
    var mctx = measureCanvas.getContext('2d');
    mctx.font = fontSize + 'px "Cormorant Garamond", Georgia, serif';
    var metrics = mctx.measureText(text);

    bubbleW = Math.ceil(metrics.width + padding * 2);
    bubbleH = Math.ceil(fontSize * 1.4 + padding * 2 + tailH);

    bubbleOffscreen = document.createElement('canvas');
    bubbleOffscreen.width = bubbleW;
    bubbleOffscreen.height = bubbleH;
    var bctx = bubbleOffscreen.getContext('2d');

    var bodyH = bubbleH - tailH;
    var radius = Math.round(fontSize * 0.4);

    /* Draw bubble body with rounded corners */
    bctx.fillStyle = bgColor;
    bctx.strokeStyle = borderColor;
    bctx.lineWidth = 1;
    bctx.beginPath();
    bctx.moveTo(radius, 0);
    bctx.lineTo(bubbleW - radius, 0);
    bctx.quadraticCurveTo(bubbleW, 0, bubbleW, radius);
    bctx.lineTo(bubbleW, bodyH - radius);
    bctx.quadraticCurveTo(bubbleW, bodyH, bubbleW - radius, bodyH);
    /* Tail — small triangle pointing down-left */
    var tailX = Math.round(bubbleW * 0.3);
    bctx.lineTo(tailX + tailH, bodyH);
    bctx.lineTo(tailX, bodyH + tailH);
    bctx.lineTo(tailX - 2, bodyH);
    bctx.lineTo(radius, bodyH);
    bctx.quadraticCurveTo(0, bodyH, 0, bodyH - radius);
    bctx.lineTo(0, radius);
    bctx.quadraticCurveTo(0, 0, radius, 0);
    bctx.closePath();
    bctx.fill();
    bctx.stroke();

    /* Draw text */
    bctx.fillStyle = textColor;
    bctx.font = 'italic ' + fontSize + 'px "Cormorant Garamond", Georgia, serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(text, bubbleW / 2, bodyH / 2);
  }

  /**
   * Render the door on an offscreen canvas using theme-aware colors.
   */
  function renderDoor() {
    if (!ctx || W === 0 || H === 0) return;

    /* Read current theme colors */
    var bgHex = getCSSColor('--color-bg', '#1e1828');
    var weatherHex = getCSSColor('--color-weather', '#c8b0c0');
    var accentHex = getCSSColor('--color-accent', '#a05080');
    doorLastBg = bgHex;
    doorLastWeather = weatherHex;

    var bgRGB = parseHexToRGB(bgHex);
    var fgRGB = parseHexToRGB(weatherHex);

    /* Door dimensions — sized to be small and unobtrusive */
    var frameInset = Math.min(Math.max(window.innerWidth * 0.03, 16), 40);
    var doorH = Math.min(176, H * 0.256);
    var artAspect = DOOR_ART_COLS / (DOOR_ART_ROWS * 2);
    var doorW = doorH * artAspect;

    /* Store base dimensions for animation */
    doorBaseW = doorW;
    doorBaseH = doorH;

    /* Position: bottom-left, bottom aligned to frame boundary */
    var doorX = frameInset + 8;
    var doorY = H - frameInset - doorH;
    doorBaseX = doorX;
    doorBaseY = doorY;

    /* Cell size */
    var cellW = doorW / DOOR_ART_COLS;
    var cellH = doorH / DOOR_ART_ROWS;
    var halfH = cellH / 2;

    /* Create offscreen canvas */
    var ow = Math.ceil(doorW);
    var oh = Math.ceil(doorH);
    doorOffscreen = document.createElement('canvas');
    doorOffscreen.width = ow;
    doorOffscreen.height = oh;
    var dctx = doorOffscreen.getContext('2d');

    /* Draw each cell using theme-remapped colors */
    for (var row = 0; row < DOOR_ART_ROWS; row++) {
      var lumRow = DOOR_LUM[row];
      if (!lumRow) continue;
      for (var col = 0; col < DOOR_ART_COLS; col++) {
        var cell = lumRow[col];
        if (!cell) continue;

        var x = Math.floor(col * cellW);
        var y = Math.floor(row * cellH);
        var w = Math.ceil(cellW) + 1;

        /* Background = top half */
        if (cell[1] >= 0) {
          dctx.fillStyle = lumToThemeColor(cell[1], bgRGB, fgRGB);
          dctx.fillRect(x, y, w, Math.ceil(halfH) + 1);
        }

        /* Foreground = bottom half */
        if (cell[0] >= 0) {
          dctx.fillStyle = lumToThemeColor(cell[0], bgRGB, fgRGB);
          dctx.fillRect(x, y + Math.floor(halfH), w, Math.ceil(halfH) + 1);
        }
      }
    }

    /* Store draw position */
    doorDrawX = doorX;
    doorDrawY = doorY;

    /* Also render the chat bubble */
    renderBubble(doorW);
  }

  /**
   * Check if a click/tap hit the door area.
   */
  function isDoorHit(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var cx = clientX - rect.left;
    var cy = clientY - rect.top;
    var dx = doorAnimating ? doorAnimX : doorDrawX;
    var dy = doorAnimating ? doorAnimY : doorDrawY;
    var dw = doorBaseW * doorAnimScale;
    var dh = doorBaseH * doorAnimScale;
    return cx >= dx && cx <= dx + dw && cy >= dy && cy <= dy + dh;
  }

  /**
   * Handle door knock interaction.
   */
  function onDoorKnock() {
    if (doorAnimating) return;
    var now = performance.now();
    if (now - doorKnockTimer > KNOCK_TIMEOUT) {
      doorKnocks = 0;
    }
    doorKnocks++;
    doorKnockTimer = now;

    if (doorKnocks >= 3) {
      startDoorAnimation();
    }
  }

  /**
   * Easing function — ease-in-out cubic
   */
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Start the door animation sequence:
   * 1. Move to center with 20% scale-up
   * 2. Top-to-bottom dissolve
   * 3. Navigate to new page
   */
  function startDoorAnimation() {
    doorAnimating = true;
    doorAnimPhase = 'moving';
    doorAnimProgress = 0;
    doorDissolveProgress = 0;
    doorAnimScale = 1;
    doorStartX = doorDrawX;
    doorStartY = doorDrawY;
    /* Target: center of viewport, accounting for the 20% scale-up */
    var finalW = doorBaseW * 1.2;
    var finalH = doorBaseH * 1.2;
    doorTargetX = (W - finalW) / 2;
    doorTargetY = (H - finalH) / 2;

    /* Fade out all page elements except the language switcher and canvas */
    fadeOutPageElements();
  }

  /**
   * Fade out all visible page elements except .lang-switcher.
   * Weather fades out on the canvas via weatherFadeAlpha (driven in the loop),
   * so the door remains fully visible while rain/clouds/stars disappear.
   * Uses a CSS transition over MOVE_DURATION (1 s) so the fade is smooth.
   */
  function fadeOutPageElements() {
    var durationSec = (MOVE_DURATION / 1000).toFixed(2);
    var selectors = [
      '.hero__header', '.hero__nav', '.hero__contact',
      '.hero__email', '.frame', '.demo-banner', '.skip-link'
    ];
    for (var i = 0; i < selectors.length; i++) {
      var els = document.querySelectorAll(selectors[i]);
      for (var j = 0; j < els.length; j++) {
        /* Cancel any CSS entrance animation — fill-mode:both keeps
           the final keyframe opacity:1 applied, which overrides
           normal inline styles. We must remove the animation first. */
        els[j].style.animation = 'none';
        void els[j].offsetHeight; /* force style recalc */
        els[j].style.transition = 'opacity ' + durationSec + 's ease-out';
        /* Use !important so the value wins over any residual
           animation fill-mode effects in all browsers. */
        els[j].style.setProperty('opacity', '0', 'important');
      }
    }
  }

  /**
   * Update door animation each frame.
   */
  function updateDoorAnimation(dt) {
    if (!doorAnimating) return;

    if (doorAnimPhase === 'moving') {
      doorAnimProgress += dt / MOVE_DURATION;
      if (doorAnimProgress >= 1) {
        doorAnimProgress = 1;
        doorAnimPhase = 'dissolving';
        doorDissolveProgress = 0;
      }
      var t = easeInOutCubic(doorAnimProgress);
      doorAnimX = doorStartX + (doorTargetX - doorStartX) * t;
      doorAnimY = doorStartY + (doorTargetY - doorStartY) * t;
      doorAnimScale = 1 + 0.2 * t;  /* 1.0 → 1.2 */

    } else if (doorAnimPhase === 'dissolving') {
      doorDissolveProgress += dt / DISSOLVE_DURATION;
      if (doorDissolveProgress >= 1) {
        doorDissolveProgress = 1;
        doorAnimPhase = 'done';
        /* Navigate to new page after a brief pause */
        setTimeout(function() {
          window.location.href = '/beyond.html';
        }, 300);
      }
      doorAnimX = doorTargetX;
      doorAnimY = doorTargetY;
      doorAnimScale = 1.2;
    }
  }

  /**
   * Draw the door (and bubble) on the main canvas, handling animation states.
   */
  function drawDoor() {
    if (!doorOffscreen) return;

    if (doorAnimPhase === 'done') return;

    ctx.save();

    if (!doorAnimating) {
      /* Static door at base position */
      ctx.drawImage(doorOffscreen, doorDrawX, doorDrawY);

      /* Draw chat bubble above the door with gentle floating bob */
      if (bubbleOffscreen) {
        var floatAmp = Math.max(2, doorBaseH * 0.02); /* ~2-3 px */
        var floatY = Math.sin(bubbleFloatPhase) * floatAmp;
        var bx = doorDrawX + doorBaseW * 0.1;
        var by = doorDrawY - bubbleH - 6 + floatY;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(bubbleOffscreen, bx, by);
        ctx.globalAlpha = 1;
      }

    } else if (doorAnimPhase === 'moving') {
      /* Moving + scaling to center */
      var sw = doorBaseW * doorAnimScale;
      var sh = doorBaseH * doorAnimScale;
      ctx.drawImage(doorOffscreen, doorAnimX, doorAnimY, sw, sh);

      /* Fade out bubble during move (keep float bob) */
      if (bubbleOffscreen) {
        var fadeOut = 1 - doorAnimProgress;
        if (fadeOut > 0) {
          var floatAmp2 = Math.max(2, doorBaseH * 0.02);
          var floatY2 = Math.sin(bubbleFloatPhase) * floatAmp2 * fadeOut;
          ctx.globalAlpha = fadeOut * 0.9;
          var bx2 = doorAnimX + sw * 0.1;
          var by2 = doorAnimY - bubbleH * doorAnimScale - 6 + floatY2;
          ctx.drawImage(bubbleOffscreen, bx2, by2,
            bubbleW * doorAnimScale, bubbleH * doorAnimScale);
          ctx.globalAlpha = 1;
        }
      }

    } else if (doorAnimPhase === 'dissolving') {
      /* Top-to-bottom dissolve at center */
      var sw2 = doorBaseW * 1.2;
      var sh2 = doorBaseH * 1.2;
      var dissolveY = doorDissolveProgress * sh2;

      /* Only draw the portion below the dissolve line */
      if (dissolveY < sh2) {
        /* Source rect: from dissolveY/scale to bottom of the offscreen canvas */
        var srcY = dissolveY / 1.2;  /* map back to offscreen coords */
        var srcH = doorOffscreen.height - srcY;
        var dstY = doorAnimY + dissolveY;
        var dstH = sh2 - dissolveY;

        ctx.drawImage(doorOffscreen,
          0, srcY, doorOffscreen.width, srcH,
          doorAnimX, dstY, sw2, dstH);

        /* Add a subtle glow/shimmer at the dissolve edge */
        var gradient = ctx.createLinearGradient(
          doorAnimX, dstY - 8, doorAnimX, dstY + 8);
        var accentHex2 = getCSSColor('--color-accent-soft', '#b86898');
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.5, accentHex2);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(doorAnimX, dstY - 4, sw2, 12);
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
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

    /* Fade weather alpha during door animation */
    if (doorAnimating && weatherFadeAlpha > 0) {
      weatherFadeAlpha -= dt / MOVE_DURATION;
      if (weatherFadeAlpha < 0) weatherFadeAlpha = 0;
    }

    /* Apply weather fade alpha for all weather elements */
    if (weatherFadeAlpha < 1) ctx.globalAlpha = weatherFadeAlpha;

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

    /* Celestial bodies (behind rain and mist, on top of clouds) */
    updateCelestialTime(dtSec);
    celestialTimeAccum += dtSec;
    renderStars(celestialTimeAccum);
    renderSun(celestialTimeAccum);
    renderMoon(celestialTimeAccum);

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

    /* Reset alpha before drawing the door (door stays fully visible) */
    ctx.globalAlpha = 1;

    /* Arch door (demo only — theme-aware pixel-art with interaction) */
    if (doorEnabled) {
    var curBg = getCSSColor('--color-bg', '#1e1828');
    var curWeather = getCSSColor('--color-weather', '#c8b0c0');
    var curLang = document.documentElement.lang || 'en';
    if (W !== doorLastW || H !== doorLastH || curBg !== doorLastBg || curWeather !== doorLastWeather) {
      doorDirty = true;
      doorLastW = W;
      doorLastH = H;
    }
    /* Re-render bubble when language changes */
    if (curLang !== bubbleLastLang && doorBaseW > 0) {
      renderBubble(doorBaseW);
    }
    if (doorDirty) {
      renderDoor();
      doorDirty = false;
    }
    /* Advance bubble float phase (~3 s full cycle, very gentle) */
    bubbleFloatPhase += dtSec * 2.1;
    if (bubbleFloatPhase > 6.2832) bubbleFloatPhase -= 6.2832;
    updateDoorAnimation(dt);
    drawDoor();
    } /* end doorEnabled */

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
    initCelestial();
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

    /* Invalidate celestial color cache so sun/moon/star colors update */
    celestialThemeDirty = true;
    lastSunColorStr = '';
    lastMoonColorStr = '';
    invalidateGlowCache();
    invalidateStarSprites();
  }

  /* MutationObserver on <html> to detect data-time-theme and lang changes */
  if (typeof MutationObserver !== 'undefined') {
    var themeObserver = new MutationObserver(function (mutations) {
      var needTheme = false;
      var needLang = false;
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === 'data-time-theme') needTheme = true;
        if (mutations[i].attributeName === 'lang') needLang = true;
      }
      if (needTheme) {
        /* Small delay to let CSS variables propagate */
        setTimeout(onThemeChange, 50);
      }
      if (needLang) {
        /* Re-render bubble with new language text; also mark door dirty
           so theme colors on the bubble update in the same pass. */
        doorDirty = true;
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
    getWind: function () { return currentWind; },
    getCelestial: function () {
      return {
        hour: celestialHour,
        lunarFraction: lunarFraction,
        illumination: getIllumination(lunarFraction),
        phaseIndex: getPhaseIndex(lunarFraction)
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
