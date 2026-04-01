/* ============================================================
   RAIN.JS
   Continuous Unicode rain & cloud animation system.

   Features:
   - Moving clouds made of numbers/unicode at the top
   - Rain characters (1, l, !, I, i) falling from clouds
   - Umbrella cursor on desktop with deflection physics
   - Touch-based rain deflection on mobile
   - Wind effects with gusts (sinusoidal harmonics)
   - 7 weather presets randomly selected per visit
   - Object pooling for zero GC pressure
   - Pre-rendered character sprites for performance
   - DPI-aware canvas (capped at 2x)
   - Visibility API pause/resume
   - Debounced resize handling
   - Reduced particles on mobile

   Sources & references:
   - Matrix rain technique: dev.to/javascriptacademy (Adam Nagy)
   - Particle physics: natureofcode.com/particles (Daniel Shiffman)
   - Particle repulsion: stackoverflow.com/questions/15097664
   - Canvas DPI fix: medium.com/wdstack (Coen Warmer)
   - Canvas optimization: developer.mozilla.org/Canvas_API
   - Custom cursor: 14islands.com/journal
   - Weather presets: canvasengine.net/presets/weather
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     CONFIGURATION
     ============================================================ */

  var RAIN_CHARS = ['1', 'l', '!', 'I', 'i'];
  var CLOUD_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
                     '#', '%', '&', '@', '*', '~', '^'];

  /* Umbrella Unicode character and collision geometry */
  var UMBRELLA_CHAR = '\u2602';  /* ☂ */
  var UMBRELLA_RADIUS = 55;
  var UMBRELLA_ARC_START = -Math.PI;       /* left edge of arc */
  var UMBRELLA_ARC_END = 0;                /* right edge of arc */

  /* Touch deflection radius */
  var TOUCH_RADIUS = 50;

  /* Performance tuning */
  var MAX_DPI = 2;
  var MAX_DELTA = 50;            /* ms — cap to prevent teleporting after tab switch */
  var MOBILE_BREAKPOINT = 768;
  var MOBILE_DROP_FACTOR = 0.5;  /* reduce drops by 50% on mobile */
  var RESIZE_DEBOUNCE = 200;     /* ms */

  /* Cloud configuration */
  var CLOUD_FONT_SIZE = 14;
  var CLOUD_LINE_HEIGHT = 16;
  var CLOUD_Y_OFFSET = 20;       /* px from top */

  /* Bottom fade zone — rain fades out in the last N% of viewport */
  var BOTTOM_FADE_ZONE = 0.15;

  /* ============================================================
     WEATHER PRESETS
     Each preset defines the full weather personality.
     Randomly selected once per page load.
     ============================================================ */

  var WEATHER_PRESETS = {
    gentleMist: {
      name: 'Gentle Mist',
      dropCount: 80,
      fallSpeed: 1.2,
      fallSpeedVariance: 0.4,
      windSpeed: 0,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudCount: 3,
      cloudSpeed: 0.15,
      cloudOpacity: 0.12,
      rainOpacity: 0.18,
      charSize: 12
    },
    lightDrizzle: {
      name: 'Light Drizzle',
      dropCount: 140,
      fallSpeed: 2.0,
      fallSpeedVariance: 0.6,
      windSpeed: 0.3,
      gustEnabled: false,
      gustStrength: 0,
      gustFrequency: 0,
      cloudCount: 4,
      cloudSpeed: 0.2,
      cloudOpacity: 0.15,
      rainOpacity: 0.22,
      charSize: 13
    },
    steadyRain: {
      name: 'Steady Rain',
      dropCount: 220,
      fallSpeed: 3.0,
      fallSpeedVariance: 0.8,
      windSpeed: 0.6,
      gustEnabled: true,
      gustStrength: 0.4,
      gustFrequency: 0.8,
      cloudCount: 5,
      cloudSpeed: 0.3,
      cloudOpacity: 0.18,
      rainOpacity: 0.28,
      charSize: 13
    },
    windyShower: {
      name: 'Windy Shower',
      dropCount: 200,
      fallSpeed: 3.5,
      fallSpeedVariance: 1.0,
      windSpeed: 1.8,
      gustEnabled: true,
      gustStrength: 1.0,
      gustFrequency: 1.2,
      cloudCount: 5,
      cloudSpeed: 0.5,
      cloudOpacity: 0.2,
      rainOpacity: 0.3,
      charSize: 14
    },
    downpour: {
      name: 'Downpour',
      dropCount: 350,
      fallSpeed: 4.5,
      fallSpeedVariance: 1.2,
      windSpeed: 0.4,
      gustEnabled: true,
      gustStrength: 0.6,
      gustFrequency: 0.5,
      cloudCount: 6,
      cloudSpeed: 0.25,
      cloudOpacity: 0.22,
      rainOpacity: 0.35,
      charSize: 14
    },
    stormFront: {
      name: 'Storm Front',
      dropCount: 400,
      fallSpeed: 5.5,
      fallSpeedVariance: 1.5,
      windSpeed: 2.5,
      gustEnabled: true,
      gustStrength: 1.8,
      gustFrequency: 1.5,
      cloudCount: 7,
      cloudSpeed: 0.7,
      cloudOpacity: 0.25,
      rainOpacity: 0.38,
      charSize: 15
    },
    typhoon: {
      name: 'Typhoon',
      dropCount: 500,
      fallSpeed: 6.5,
      fallSpeedVariance: 2.0,
      windSpeed: 3.5,
      gustEnabled: true,
      gustStrength: 2.5,
      gustFrequency: 2.0,
      cloudCount: 8,
      cloudSpeed: 1.0,
      cloudOpacity: 0.28,
      rainOpacity: 0.4,
      charSize: 15
    }
  };

  /* ============================================================
     UTILITY FUNCTIONS
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

  function isMobile() {
    return window.innerWidth < MOBILE_BREAKPOINT ||
           ('ontouchstart' in window && navigator.maxTouchPoints > 0);
  }

  /* Simple Perlin-like noise using layered sine waves */
  function windNoise(t, freq) {
    return Math.sin(t * 0.7 * freq) * 0.5 +
           Math.sin(t * 1.3 * freq) * 0.3 +
           Math.sin(t * 0.3 * freq) * 0.2;
  }

  /* ============================================================
     CLOUD SHAPE DEFINITIONS
     Each cloud is an array of strings forming the shape.
     Made of numbers and unicode symbols.
     ============================================================ */

  var CLOUD_SHAPES = [
    [
      '          0 3 7 2          ',
      '      4 8 # 5 1 9 6 3     ',
      '   2 7 0 3 8 6 1 4 9 5 2  ',
      '  5 1 9 4 7 0 2 8 3 6 1 7 ',
      ' 3 6 8 2 5 9 1 7 4 0 8 3 5',
      '   4 0 7 3 6 2 9 5 1 8    '
    ],
    [
      '       5 2 8 1        ',
      '    9 3 6 0 4 7 2     ',
      '  1 8 5 # 9 3 7 0 6  ',
      ' 4 2 7 1 5 8 0 6 3 9 ',
      '  6 0 3 8 2 7 4 1 5  '
    ],
    [
      '            7 4 1          ',
      '        3 9 5 0 8 2        ',
      '     6 1 4 8 # 3 7 9 5     ',
      '   0 8 2 6 1 9 4 7 3 5 0 2 ',
      '  4 7 3 9 5 0 8 2 6 1 4 8 3',
      '    2 5 1 7 3 6 0 9 8 4    ',
      '      9 0 4 8 2 5 1        '
    ],
    [
      '     8 3 6      ',
      '   2 5 9 1 7    ',
      '  0 4 8 3 6 2 5 ',
      ' 7 1 9 5 0 4 8 3',
      '  6 2 7 1 9 3 0 '
    ],
    [
      '              2 9 5 1            ',
      '          7 3 8 0 4 6 2          ',
      '       1 5 9 # 7 3 8 0 4 6      ',
      '    3 8 2 6 1 5 9 4 0 7 2 8 3   ',
      '  6 0 4 9 3 7 2 8 1 5 6 0 9 4 7 ',
      '   5 1 7 0 4 8 3 6 9 2 5 1 8    ',
      '     3 6 2 9 5 1 7 4 0          '
    ]
  ];

  /* ============================================================
     PRE-RENDERED CHARACTER SPRITES
     Render each rain character to an offscreen canvas once,
     then stamp with drawImage in the loop — avoids fillText cost.
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
     RAINDROP OBJECT POOL
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
    this.windFactor = 1;   /* per-particle wind variance */
    this.size = 13;
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
  };

  /* ============================================================
     CLOUD OBJECT
     ============================================================ */

  function Cloud(shapeIndex, x, y, speed, opacity) {
    this.shape = CLOUD_SHAPES[shapeIndex % CLOUD_SHAPES.length];
    this.x = x;
    this.y = y;
    this.baseSpeed = speed;
    this.speed = speed;
    this.opacity = opacity;
    this.width = 0;
    this.height = this.shape.length * CLOUD_LINE_HEIGHT;

    /* Calculate width from longest line */
    for (var i = 0; i < this.shape.length; i++) {
      var w = this.shape[i].length * (CLOUD_FONT_SIZE * 0.6);
      if (w > this.width) this.width = w;
    }
  }

  /* ============================================================
     MAIN ANIMATION CONTROLLER
     ============================================================ */

  var canvas, ctx;
  var animId = null;
  var lastTime = 0;
  var running = false;

  /* State */
  var W = 0, H = 0, dpi = 1;
  var drops = [];
  var clouds = [];
  var activePreset = null;
  var currentWind = 0;
  var targetWind = 0;
  var timeAccum = 0;

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

    /* Adjust drop count for mobile */
    if (isMobile()) {
      activePreset = Object.assign({}, activePreset);
      activePreset.dropCount = Math.floor(activePreset.dropCount * MOBILE_DROP_FACTOR);
    }

    /* Log for debugging (removed in production by minifier) */
    if (typeof console !== 'undefined') {
      console.log('[Rain] Weather: ' + activePreset.name);
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

    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.width = Math.floor(W * dpi);
    canvas.height = Math.floor(H * dpi);

    ctx = canvas.getContext('2d');
    ctx.scale(dpi, dpi);
  }

  /* ---- Initialize drop pool ---- */

  function initDrops() {
    var count = activePreset.dropCount;
    drops = [];
    for (var i = 0; i < count; i++) {
      var drop = new Raindrop();
      /* Stagger initial positions across the viewport */
      spawnDrop(drop, true);
      drops.push(drop);
    }
  }

  /* ---- Spawn / recycle a drop ---- */

  function spawnDrop(drop, initialScatter) {
    /* Pick a random cloud to spawn from, or random x if no clouds */
    var spawnX, spawnY;
    if (clouds.length > 0) {
      var cloud = clouds[Math.floor(Math.random() * clouds.length)];
      spawnX = cloud.x + randomRange(0, cloud.width);
      spawnY = cloud.y + cloud.height + randomRange(0, 10);
    } else {
      spawnX = randomRange(0, W);
      spawnY = randomRange(-20, 0);
    }

    drop.reset(spawnX, spawnY, activePreset);

    /* On initial load, scatter drops across the full viewport so it
       doesn't look like all rain starts at once */
    if (initialScatter) {
      drop.y = randomRange(-H * 0.1, H);
      drop.x = randomRange(0, W);
    }
  }

  /* ---- Initialize clouds ---- */

  function initClouds() {
    clouds = [];
    var count = activePreset.cloudCount;
    var spacing = W / count;

    for (var i = 0; i < count; i++) {
      var shapeIdx = i % CLOUD_SHAPES.length;
      var x = (i * spacing) + randomRange(-spacing * 0.3, spacing * 0.3);
      var y = CLOUD_Y_OFFSET + randomRange(0, 30);
      var speed = activePreset.cloudSpeed * randomRange(0.7, 1.3);
      var opacity = activePreset.cloudOpacity * randomRange(0.7, 1.0);
      clouds.push(new Cloud(shapeIdx, x, y, speed, opacity));
    }
  }

  /* ---- Umbrella / touch DOM elements ---- */

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

  function onTouchStart(e) {
    updateTouchPoints(e);
  }

  function onTouchMove(e) {
    /* Don't prevent default — allow scrolling on content layer.
       Canvas has pointer-events: none so this only fires on content. */
    updateTouchPoints(e);
  }

  function onTouchEnd(e) {
    touchPoints = [];
    if (touchRippleEl) touchRippleEl.classList.remove('active');
  }

  function updateTouchPoints(e) {
    touchPoints = [];
    for (var i = 0; i < e.touches.length; i++) {
      touchPoints.push({
        x: e.touches[i].clientX,
        y: e.touches[i].clientY
      });
    }
    /* Show ripple at first touch point */
    if (touchRippleEl && touchPoints.length > 0) {
      touchRippleEl.style.left = touchPoints[0].x + 'px';
      touchRippleEl.style.top = touchPoints[0].y + 'px';
      touchRippleEl.classList.add('active');
    }
  }

  /* ============================================================
     PHYSICS — UMBRELLA DEFLECTION
     ============================================================ */

  function applyUmbrellaDeflection(drop) {
    if (!mouseActive) return;

    var dx = drop.x - mouseX;
    var dy = drop.y - mouseY;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > UMBRELLA_RADIUS || dist < 1) return;

    /* Check if drop is in the upper semicircle (umbrella canopy) */
    var angle = Math.atan2(dy, dx);
    if (angle > UMBRELLA_ARC_START && angle < UMBRELLA_ARC_END) {
      /* Drop is under the umbrella arc — deflect it */
      var nx = dx / dist;
      var ny = dy / dist;

      /* Reflection: v' = v - 2(v·n)n, with some energy loss */
      var dot = drop.vx * nx + drop.vy * ny;
      if (dot < 0) {  /* only reflect if moving toward umbrella */
        drop.vx -= 1.6 * dot * nx;
        drop.vy -= 1.6 * dot * ny;

        /* Add slight random scatter for natural look */
        drop.vx += randomRange(-0.3, 0.3);
        drop.vy += randomRange(-0.1, 0.2);

        /* Push drop just outside the umbrella to prevent re-collision */
        drop.x = mouseX + nx * (UMBRELLA_RADIUS + 2);
        drop.y = mouseY + ny * (UMBRELLA_RADIUS + 2);
      }
    }
  }

  /* ---- Touch deflection (radial repulsion) ---- */

  function applyTouchDeflection(drop) {
    for (var i = 0; i < touchPoints.length; i++) {
      var tp = touchPoints[i];
      var dx = drop.x - tp.x;
      var dy = drop.y - tp.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < TOUCH_RADIUS && dist > 1) {
        var force = (TOUCH_RADIUS - dist) / TOUCH_RADIUS;
        var nx = dx / dist;
        var ny = dy / dist;
        drop.vx += nx * force * 2;
        drop.vy += ny * force * 1.5;
      }
    }
  }

  /* ============================================================
     ANIMATION LOOP
     ============================================================ */

  function loop(timestamp) {
    if (!running) return;

    var dt = timestamp - lastTime;
    lastTime = timestamp;

    /* Cap delta to prevent huge jumps after tab switch */
    if (dt > MAX_DELTA) dt = MAX_DELTA;

    var dtFactor = dt / 16.667;  /* normalize to ~60fps */
    timeAccum += dt * 0.001;     /* seconds accumulator for wind noise */

    /* ---- Clear canvas with semi-transparent overlay for trail effect ---- */
    ctx.clearRect(0, 0, W, H);

    /* ---- Update wind ---- */
    updateWind(dtFactor);

    /* ---- Update and draw clouds ---- */
    updateClouds(dtFactor);
    drawClouds();

    /* ---- Update and draw rain ---- */
    updateDrops(dtFactor);
    drawDrops();

    animId = requestAnimationFrame(loop);
  }

  /* ---- Wind system ---- */

  function updateWind(dtFactor) {
    if (activePreset.gustEnabled) {
      var noise = windNoise(timeAccum, activePreset.gustFrequency);
      targetWind = activePreset.windSpeed + noise * activePreset.gustStrength;
    } else {
      targetWind = activePreset.windSpeed;
    }

    /* Smooth interpolation to prevent abrupt wind changes */
    currentWind = lerp(currentWind, targetWind, 0.02 * dtFactor);
  }

  /* ---- Cloud update ---- */

  function updateClouds(dtFactor) {
    for (var i = 0; i < clouds.length; i++) {
      var cloud = clouds[i];

      /* Wind affects cloud speed */
      cloud.speed = cloud.baseSpeed + currentWind * 0.15;
      cloud.x += cloud.speed * dtFactor;

      /* Wrap around when cloud moves off screen */
      if (cloud.x > W + 50) {
        cloud.x = -cloud.width - 50;
      } else if (cloud.x < -cloud.width - 50) {
        cloud.x = W + 50;
      }
    }
  }

  /* ---- Cloud drawing ---- */

  function drawClouds() {
    ctx.font = CLOUD_FONT_SIZE + 'px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (var i = 0; i < clouds.length; i++) {
      var cloud = clouds[i];
      ctx.globalAlpha = cloud.opacity;
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-text').trim() || '#2a1f2d';

      for (var row = 0; row < cloud.shape.length; row++) {
        var line = cloud.shape[row];
        var yPos = cloud.y + row * CLOUD_LINE_HEIGHT;
        ctx.fillText(line, cloud.x, yPos);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- Drop update ---- */

  function updateDrops(dtFactor) {
    for (var i = 0; i < drops.length; i++) {
      var drop = drops[i];
      if (!drop.active) {
        spawnDrop(drop, false);
        continue;
      }

      /* Apply gravity (constant downward) */
      drop.vy += 0.02 * dtFactor;

      /* Apply wind with per-particle variance */
      drop.vx = lerp(drop.vx, currentWind * drop.windFactor, 0.05 * dtFactor);

      /* Apply deflection */
      if (isDesktop) {
        applyUmbrellaDeflection(drop);
      } else {
        applyTouchDeflection(drop);
      }

      /* Drag to prevent runaway velocity */
      drop.vx *= 0.995;

      /* Update position */
      drop.x += drop.vx * dtFactor;
      drop.y += drop.vy * dtFactor;

      /* Bottom fade: reduce opacity as drop approaches bottom */
      var fadeStart = H * (1 - BOTTOM_FADE_ZONE);
      if (drop.y > fadeStart) {
        var fadeProgress = (drop.y - fadeStart) / (H * BOTTOM_FADE_ZONE);
        drop.opacity = activePreset.rainOpacity * (1 - fadeProgress) * randomRange(0.6, 1.0);
      }

      /* Recycle: off bottom or off sides (with margin for wind) */
      if (drop.y > H + 20 || drop.x < -100 || drop.x > W + 100) {
        drop.active = false;
      }
    }
  }

  /* ---- Drop drawing ---- */

  function drawDrops() {
    /* Calculate rain angle from wind for character rotation */
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
        ctx.rotate(windAngle * 0.5);  /* subtle lean, not full angle */
        ctx.drawImage(sprite, -halfSize, -halfSize, drop.size, drop.size);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ============================================================
     LIFECYCLE
     ============================================================ */

  function init() {
    selectPreset();
    setupCanvas();

    /* Build character sprites using the site's text color */
    var textColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-text').trim() || '#2a1f2d';
    buildCharSprites(activePreset.charSize, textColor);

    initClouds();
    initDrops();
    setupInteraction();

    running = true;
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);
  }

  /* ---- Visibility API: pause when tab hidden ---- */

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
      if (animId) {
        cancelAnimationFrame(animId);
        animId = null;
      }
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
      initClouds();

      /* Rebuild sprites if DPI changed */
      var newDpi = Math.min(window.devicePixelRatio || 1, MAX_DPI);
      if (newDpi !== dpi) {
        var textColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--color-text').trim() || '#2a1f2d';
        buildCharSprites(activePreset.charSize, textColor);
      }

      /* Re-scatter existing drops to new viewport */
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
