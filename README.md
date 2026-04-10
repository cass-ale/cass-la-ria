# Cass la Ria

A minimal, elegant single-page website for the multi-faceted creative **Cass la Ria**. The design fuses Neo Yokio's muted pastel luxury with Ralph Lauren's heritage serif refinement.

## Live Features

### Favicon

A custom crystal skull favicon inspired by Neo Yokio's crystal skull and Damien Hirst's *For the Love of God*, rendered in the site's signature pink palette. Provided in all standard sizes (16, 32, 48, 192, 512, Apple Touch 180).

### Social Media Icons

Three SVG icon buttons (YouTube, TikTok, Instagram) replace the original text buttons. Icons are inline SVGs from [Simple Icons](https://simpleicons.org/) — no external requests. On mobile, links use platform-appropriate deep linking to open the corresponding native app when installed; if the app is not present, the link falls back gracefully to the browser.

### Contact Button

An envelope icon + "CONTACT" button links to `mailto:admin@caprilaria.com`, opening the user's default email client.

### Rain Animation System

A continuous Unicode rain and cloud animation runs behind the site content on every visit. Each cloud is an **individual entity** with its own noise seed, position, size, depth layer, and drift velocity — producing clearly distinct, separately identifiable cloud formations rather than a uniform texture. Clouds are procedurally generated using simplex noise with domain warping ([Inigo Quilez technique](https://iquilezles.org/articles/warp/)), with an elliptical falloff that gives each cloud defined edges, a dense core, and lighter wisps at the margins. Cloud characters are drawn from a diverse Unicode set (block elements `█▓▒`, numbers, symbols `*+=$`, braille dots `⠁⠂`, punctuation) that **constantly cycle** as clouds drift. Rain characters (`1`, `l`, `!`, `I`, `i`) spawn from cloud base positions and fall to the bottom of the viewport where they fade away.

### Cloud Architecture (v4)

The cloud system uses **individual cloud objects** rather than a global noise field. Each cloud has:

| Property | Description |
|---|---|
| Noise seed | Unique per cloud — no two clouds look the same |
| Position & size | Independent x/y center, width, height |
| Depth layer | 0 (far, dimmer) to 2 (near, brighter) — creates parallax |
| Direction | Randomized per cloud — left-to-right, right-to-left, diagonals, and steep angles |
| Z-axis movement | 30% of clouds oscillate in scale (0.75x–1.3x), simulating approach/recede with lateral drift |
| Size breathing | Subtle sinusoidal pulse (max 3.5% amplitude) gives clouds a living quality |
| Shape evolution | `warpDrift` slowly shifts the noise offset, causing internal texture to subtly reshape over time |

**Cloud collision and merging** follows the five-phase model from Westcott (1994, *Monthly Weather Review*): approach, bridging, thickening, merger, and growth. When two same-depth clouds drift close enough, a wispy bridge of light characters forms between them. The bridge thickens over time. On full merger, the smaller cloud is absorbed and the larger one grows (consistent with the finding that merged clouds are larger than either parent). Absorbed clouds fade out and respawn off-screen with a new direction and shape.

### Rain-Text Collision

Rain characters bounce off the "CASS LA RIA" heading text. The heading's bounding box is sampled each frame, and drops that enter it are deflected — bouncing off the top surface and deflecting left/right from the sides. This creates a natural "sheltered" effect under the name.

### Weather Physics

The physics model is grounded in real meteorology:

- **Rain angle** follows `atan(windSpeed / terminalVelocity)` — the real formula from atmospheric physics ([Physics StackExchange #128586](https://physics.stackexchange.com/questions/128586)).
- **Wind gradient** (Ekman spiral): rain drifts faster at cloud height and slower near the ground, creating a natural curve ([Cliff Mass Weather Blog](https://cliffmass.blogspot.com/2017/05/wind-shear-when-atmospheric-seems-to-be.html)).
- **Cloud shapes** are based on six real cloud types (cirrus, stratus, stratocumulus, cumulus, nimbostratus, cumulonimbus), each with distinct noise parameters derived from study of 24+ reference images per type.
- **Wind stretches clouds** horizontally — stronger wind produces more elongated shapes.
- **Rain spawns from dense cloud regions** — heavier cloud areas produce more drops.
- **Virga effect** — in light presets, some drops fade before reaching the ground (evaporation).
- **Depth parallax** — far clouds drift slower than near clouds, creating a layered sky.

One of **15 weather presets** is randomly selected each time a visitor loads the page:

| Preset | Rain | Wind | Gusts | Mood |
|---|---|---|---|---|
| Gentle Mist | Very light | None | No | Calm, barely there |
| Light Drizzle | Light | Slight | No | Soft, peaceful |
| Steady Rain | Moderate | Moderate | Yes | Classic rainy day |
| Windy Shower | Moderate | Strong | Yes | Blustery, dynamic |
| Downpour | Heavy | Slight | Yes | Intense, vertical |
| Storm Front | Very heavy | Very strong | Yes | Dramatic, angled |
| Typhoon | Extreme | Extreme | Yes | Chaotic, powerful |
| Monsoon | Very heavy | Moderate | Yes | Dense, tropical |
| Squall Line | Heavy | Very strong | Yes | Fast-moving front |
| Thunderstorm | Heavy | Strong | Yes | With procedural lightning |
| Freezing Rain | Moderate | Slight | No | Slow, heavy drops |
| Radiation Fog | Very light | None | No | Ground-level mist |
| Petrichor | Light | None | No | Post-rain calm |

Each preset also defines **celestial visibility parameters** (sun/moon visibility, cloud coverage, haze factor, rain curtain, fog halo, snow scatter) that control how the sun and moon interact with the weather conditions.

### Celestial Body System

A Unicode sun, moon, and 500-star field render in the sky behind the weather layer, following physically accurate mechanics. Stars are sourced from the Hipparcos catalog (ESA, 1997) with J2000 coordinates, filtered for Tokyo's sky, and projected using stereographic projection with real sidereal time:

| Feature | Description |
|---|---|
| Sun arc | Sinusoidal arc from east (sunrise 5:00 AM) to west (sunset 8:00 PM) |
| Moon arc | Phase-dependent rise/set times synced to the real lunar calendar |
| Lunar phase | Calculated from the current date using the voidware algorithm — matches the real moon |
| Rayleigh scattering | Both bodies shift from amber-orange at the horizon to white/silver at zenith |
| Theme-aware colors | Celestial colors blend with `--color-weather` CSS variable for guaranteed contrast |
| WCAG contrast | Automatic contrast enforcement pushes colors toward the weather variable if ratio < 2.0 |
| 5-zone sun | Core, inner, rays, corona, glow — each with unique Unicode character sets |
| 3-zone moon | Core (phase-specific characters), surface detail, glow |
| Cloud occlusion | Noise-based cloud density field partially blocks sun/moon |
| Rain curtain | Dimming proportional to drop count and fall speed |
| Fog halo | Forward scattering expands apparent disc, creates corona effect |
| Snow whiteout | Scatter-based contrast reduction |
| Dust color shift | Pushes sun toward blood-red/amber in dust presets |
| Wind-shifted gaps | Higher wind = more turbulent = more frequent visibility gaps |
| Star catalog | 500 real stars from Hipparcos (ESA, 1997) — magnitude -1.46 (Sirius) to 6.5, 7 spectral types |
| Star projection | Stereographic projection with real local sidereal time for Tokyo (139.65°E) |
| Twilight model | 4-stage magnitude limit (civil → nautical → astronomical → full dark) |
| Scintillation | Noise-driven brightness + chromatic flickering, stronger near horizon |
| Constellation glow | Soft glow fields around constellation centroids |
| Emoji prevention | VS15 (U+FE0E) on all emoji-capable characters + monochrome font stack |
| Sprite cache | Pre-rendered character sprites for 60fps performance |

### Umbrella Cursor (Desktop)

On desktop, the native cursor is replaced by a Unicode umbrella (`☂`). Rain characters deflect and bounce off the umbrella canopy using reflection physics. The umbrella follows the cursor with smooth movement.

### Touch Interaction (Mobile)

On mobile, touching or dragging across the screen creates a deflection zone where rain characters are pushed away from the point of contact.

### Phone Tilt (Mobile)

On mobile devices with gyroscope/accelerometer, tilting the phone influences the rain and cloud animation:

- **Rain direction** shifts based on device tilt angle (left tilt pushes rain left, right tilt pushes right)
- **Cloud drift** is gently nudged by tilt, adding a subtle interactive layer
- iOS requires a one-time permission prompt (triggered on first touch); Android enables automatically
- Uses the [DeviceOrientationEvent API](https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Detecting_device_orientation)

### Animation Pause Toggle

A pause/play button in the bottom-right corner allows users to stop and restart the weather animation. This satisfies WCAG 2.2.2 (Pause, Stop, Hide). The animation also auto-pauses when `prefers-reduced-motion: reduce` is set in the user's OS.

### Time-Based Colour Theme

The site's colour palette changes smoothly throughout the day based on the visitor's local time. The theme system (`js/time-theme.js`) updates CSS custom properties every minute, interpolating between palettes for dawn, morning, midday, afternoon, golden hour, dusk, evening, and night. All UI elements — including the language switcher, editing UI, and weather animation — follow the theme automatically.

### Multilingual Support

The site supports 8 languages: English, Spanish, Portuguese, French, Japanese, Korean, Indonesian, and Chinese. Translation strings live in `js/i18n.js`. A globe icon in the top-right reveals a dropdown language selector. CJK fonts are lazy-loaded via Google Fonts with `text=` subsetting (~17KB each).

### Inline Editing (Crowdsource Translation Feedback)

Visitors can edit any translated text element to suggest improvements. On desktop, double-click to edit; on mobile, tap to reveal a pencil button. Edits are:

- **User-scoped** — stored in the visitor's `localStorage`, visible only to them
- **Remotely logged** — sent to a Google Sheet via Apps Script for the site owner to review
- **Spam-checked** — 6 client-side heuristics flag suspicious edits (profanity, gibberish, length anomaly, link injection, rate flooding, duplicates)
- **Batched** — remote submissions are debounced (5s) and flushed on page close via `sendBeacon`

### Wet Text Effect

The "CASS LA RIA" heading features a rain-responsive wet/drip text effect using SVG filters (turbulence + displacement). The effect intensity responds to the current weather preset.

### Performance

The animation is built for high performance and will not degrade the site even as future assets are added:

- **Pre-rendered character sprites** — rain characters are rendered to offscreen canvases once, then stamped with `drawImage` (avoids `fillText` cost per frame).
- **Object pooling** — all raindrops are pre-allocated and recycled, producing zero garbage collection pressure.
- **DPI-aware canvas** capped at 2x to prevent iOS Safari memory limits.
- **Reduced particle count on mobile** — 50% fewer drops on small screens.
- **Visibility API** — animation pauses when the tab is hidden, resumes cleanly on return.
- **Debounced resize** — canvas recalculates on window resize without layout thrashing.
- **Delta-time capping** — prevents particle teleportation after tab switches.

## Accessibility (WCAG 2.2)

The site is built to meet WCAG 2.2 AA standards:

| Feature | Standard | Implementation |
|---|---|---|
| Skip link | WCAG 2.4.1 | "Skip to content" link for keyboard users |
| Aria labels | WCAG 1.1.1 | All interactive elements have descriptive labels |
| Focus indicators | WCAG 2.4.7 | Visible focus ring on all buttons and links |
| Pause animation | WCAG 2.2.2 | Toggle button + `prefers-reduced-motion` auto-pause |
| Colour contrast | WCAG 1.4.3 | Dark plum text on light pink background (7:1+ ratio) |
| Touch targets | WCAG 2.5.8 | Minimum 44x44px on all interactive elements |
| Semantic HTML | WCAG 1.3.1 | Proper heading hierarchy, landmarks, nav labels |
| Screen reader | WCAG 4.1.3 | Live region announcements for edit state changes |

## Privacy and Security

This site collects **no cookies, no analytics, no tracking pixels, and no third-party scripts**. The only data transmitted externally is voluntary translation edit feedback, which is sent to a private Google Sheet for the site owner to review. No personally identifiable information is collected — only the edited text, original text, language, and browser user agent.

### Self-Hosted Fonts

Google Fonts (Cormorant Garamond) are self-hosted in `assets/fonts/` to eliminate all external requests. No DNS lookups to Google, no referrer leakage, no cookie exchange. CJK fonts are loaded on-demand from Google Fonts only when a CJK language is selected.

### Security Headers (via `netlify.toml`)

| Header | Value | Purpose |
|---|---|---|
| Content-Security-Policy | `default-src 'none'; script-src 'self'; ...` | Only own resources + Google Fonts/Apps Script allowed |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| X-Frame-Options | `DENY` | Prevent clickjacking |
| X-Content-Type-Options | `nosniff` | Prevent MIME sniffing |
| X-XSS-Protection | `0` | Disabled per OWASP (CSP replaces it) |
| Referrer-Policy | `strict-origin-when-cross-origin` | Limit referrer leakage |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), ...` | Disable unused APIs, block FLoC |
| Cross-Origin-Opener-Policy | `same-origin` | Prevent cross-origin window interaction |
| Cross-Origin-Resource-Policy | `same-origin` | Prevent resource theft |

Sources: [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), [Netlify Security Headers Guide](https://blog.serghei.pl/posts/configuring-security-headers-with-netlify/).

## Directory Structure

```
cass-la-ria/
├── index.html              ← Main page (name, links, meta, structured data)
├── netlify.toml            ← Netlify deploy config + security headers (CSP, HSTS, etc.)
├── manifest.json           ← PWA manifest for "Add to Home Screen"
├── sw.js                   ← Service worker for offline support
├── robots.txt              ← Search engine crawl rules
├── sitemap.xml             ← Sitemap for SEO
├── 404.html                ← Custom 404 error page
├── offline.html            ← Offline fallback page
├── css/
│   ├── fonts.css           ← Self-hosted @font-face declarations (Latin)
│   ├── fonts-cjk.css       ← CJK font fallback declarations (loaded lazily)
│   ├── variables.css       ← Design tokens (colours, fonts, spacing, transitions)
│   ├── reset.css           ← Cross-browser normalisation
│   ├── layout.css          ← Page structure + responsive breakpoints
│   ├── components.css      ← Icon buttons, language switcher, contact, heading, toggle
│   ├── animations.css      ← Entrance animations (motion-safe)
│   ├── rain.css            ← Rain canvas, umbrella cursor, touch ripple
│   └── editable.css        ← Inline editing UI (tooltip, pencil, mobile bar, toast)
├── js/
│   ├── main.js             ← Viewport fix, deep linking, mailto fallback, i18n switcher
│   ├── rain.js             ← Weather engine (clouds, drops, wind, sun, moon, presets, tilt, collision)
│   ├── time-theme.js       ← Time-based colour theme (updates CSS variables every minute)
│   ├── i18n.js             ← Translation strings for all 8 languages
│   ├── editable.js         ← Inline editing module (localStorage + Google Sheet + spam detection)
│   └── wet-text.js         ← Wet/drip text effect on the heading
├── assets/
│   ├── fonts/              ← Self-hosted Cormorant Garamond .woff2 files
│   ├── icons/              ← Favicon files (ICO, PNG, Apple Touch)
│   ├── images/             ← Photos, artwork, backgrounds
│   ├── video/              ← Clips, reels
│   └── audio/              ← Music, samples
├── docs/
│   ├── apps-script-endpoint.js  ← Google Apps Script code for the edit feedback sheet
│   └── APPS_SCRIPT_SETUP.md     ← Step-by-step deployment guide for the Apps Script
├── research/               ← Research notes (UX, weather, translation, benchmarks)
├── pages/                  ← Future additional pages
├── CONTRIBUTING.md         ← Guide for updating the site
└── README.md               ← This file
```

## Quick Edit Guide

| To change... | Edit this file |
|---|---|
| Colours, fonts, spacing | `css/variables.css` |
| Name text or social links | `index.html` |
| Button/icon styles | `css/components.css` |
| Rain/weather/sun/moon behaviour | `js/rain.js` |
| Time-based theme palettes | `js/time-theme.js` |
| Translation strings | `js/i18n.js` |
| Editing system behaviour | `js/editable.js` |
| Security headers | `netlify.toml` |
| Apps Script endpoint | `docs/apps-script-endpoint.js` |
| Add a new font weight | `css/fonts.css` + drop `.woff2` in `assets/fonts/` |

For detailed instructions on adding images, fonts, pages, video, and more, see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Deployment (Netlify)

1. Go to [app.netlify.com](https://app.netlify.com/) → **Add new site** → **Import an existing project**
2. Connect GitHub and select `cass-la-ria`
3. Build settings: **Base directory** blank, **Build command** blank, **Publish directory** `.`
4. Click **Deploy site**

The `netlify.toml` in the repo overrides all UI settings automatically.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `missing script: build` | Netlify trying to run a build command | Ensure build command is blank |
| "Page not found" | Publish directory wrong | Must be `.` (root) |
| CSS not loading | Post-processing breaking styles | `netlify.toml` disables bundling/minification |
| Blank page | `index.html` not at root | Verify it is in the repo root |
| Edits not reaching Google Sheet | CSP blocking `connect-src` | Ensure `script.google.com` is in CSP |

## Responsive Breakpoints

| Viewport | Width | Layout |
|---|---|---|
| Small phone | ≤ 374px | Compact icon buttons, tight spacing |
| Phone | 375–599px | Icon buttons in a row, balanced |
| Tablet+ | ≥ 600px | Full elegance, generous spacing |
| Landscape phone | height ≤ 500px | Reduced vertical padding |

Key techniques: `clamp()` fluid typography, `100dvh` dynamic viewport height, JS `--vh` fallback, 44px minimum touch targets, and `prefers-reduced-motion` support.

---

## Changelog

All notable changes to this project, in reverse chronological order.

### 2026-04-09 — Star Catalog Expansion & Emoji Prevention

- **Expanded star catalog**: 500 real stars (130 original + 370 new) from the Hipparcos catalog (ESA, 1997), filtered for Tokyo's sky (35.68°N, 139.65°E). Stars selected via spatially balanced, magnitude-prioritized sampling across all 24 RA hours and declination bands. Source: [gmiller123456/hip2000](https://github.com/gmiller123456/hip2000).
- **Full-viewport projection**: Changed `horizontalToScreen` from `Math.min(cW,cH)*0.48` to `Math.max(cW,cH)*0.55`, spreading stars across the entire rectangular viewport instead of a central circle.
- **Emoji prevention system**: Added `EMOJI_CAPABLE` lookup table (all 182 BMP code points with emoji presentation from Unicode 16.0) and `sanitizeChars()` utility function. All Unicode characters in the weather system are protected with VS15 (U+FE0E) to force text presentation. Font stack (`EMOJI_SAFE_FONT`) prioritizes monochrome symbol fonts over emoji fonts.
- **Magnitude limit fix**: Demo `magLimit` raised from 5.5 to 6.5 to show all catalog stars in full darkness.
- **Cache bump**: `rain.js?v=12`, `casslaria-v6` service worker.

### 2026-04-08 — Celestial Body System (Sun + Moon)

- **Unicode sun**: 5-zone rendering (core, inner, rays, corona, glow) with Rayleigh scattering colors that shift from amber-orange at horizon to white-yellow at zenith.
- **Unicode moon**: 3-zone rendering (core with phase-specific characters, surface detail, glow) synced to the real lunar calendar via the voidware algorithm.
- **Real lunar phase**: Moon phase calculated from the current date — the moon in the animation matches the real moon in the sky.
- **Phase-dependent rise/set**: Moon rise and set times shift with the lunar phase (e.g., full moon rises at sunset, third quarter rises at midnight).
- **Theme-aware colors**: Both celestial bodies blend Rayleigh physics colors with the `--color-weather` CSS variable, with WCAG-inspired contrast enforcement.
- **Weather interactions**: Cloud occlusion, rain curtain dimming, fog halo expansion, snow whiteout, dust color shift, and wind-shifted cloud gaps.
- **2 new weather presets**: Radiation Fog and Petrichor added to the preset pool.
- **Sprite cache**: Pre-rendered character sprites with cache invalidation on theme change for 60fps performance.
- **Service worker cache bump**: `casslaria-v3` forces all clients to pick up the new weather engine.
- **Code audit**: Comprehensive audit for stability, performance, memory, edge cases, visual quality, and cross-browser compatibility.

### 2026-04-05 — Code Audit, Spam Detection, and Form Optimization

- **Spam/troll auto-flagging**: Added 6 client-side heuristics to `editable.js` that detect profanity, gibberish, length anomalies, link injection, rate flooding, and duplicate submissions. Flags are sent as a column in the Google Sheet payload for easy filtering.
- **Debounced batch submission**: Remote edit logging now collects edits for 5 seconds before sending, reducing network requests. Pending edits are flushed on page close via `navigator.sendBeacon`.
- **CSP fix**: Added `https://script.google.com` to `connect-src` in the Content Security Policy — the previous `connect-src 'self'` was silently blocking all remote edit logging.
- **Language switcher theme fix**: Replaced 6 hardcoded RGBA colour values in `components.css` with dynamic CSS custom properties (`color-mix()` + `var()`), so the translate button now tracks the time-based theme.
- **Apps Script endpoint updated**: Added `flags` column (column H) to the Google Sheet schema. Updated `docs/apps-script-endpoint.js` with deployment instructions.
- **Documentation overhaul**: Rewrote `CONTRIBUTING.md` with complete directory map, architecture overview, and all systems. Updated `README.md` with accurate directory structure, all features, and this changelog.

### 2026-04-04 — Inline Editing System

- **Inline editing module** (`editable.js` + `editable.css`): Visitors can double-click (desktop) or tap (mobile) any `data-editable` element to suggest translation improvements. Edits persist in `localStorage` (user-scoped) and are logged to a Google Sheet via Apps Script.
- **Mobile editing UX**: Tap-to-edit with floating pencil button, visible Save/Cancel bar, toast notifications, iOS auto-zoom prevention (16px minimum font), virtual keyboard awareness.
- **Desktop editing UX audit**: Click-outside cancels (not auto-saves), inline hint bar ("Enter to save · Esc to cancel"), multiline support (Ctrl+Enter), reset button, screen reader announcements.
- **Custom 404 and offline pages**: Branded error pages matching the site's design.

### 2026-04-03 — Time Theme, PWA, and Weather Expansion

- **Time-based colour theming** (`time-theme.js`): 8 palettes (dawn through night) with smooth CSS variable interpolation every minute.
- **PWA support**: `manifest.json`, `sw.js` service worker, offline fallback page.
- **SEO enhancements**: `hreflang` tags for all 8 languages, enhanced JSON-LD schema, `?lang=` URL parameter support.
- **Wet text optimisation**: SMIL `hueRotate` animation, reduced noise octaves, throttled JS updates, mobile fallback.
- **6 new weather presets**: Monsoon, Squall Line, Thunderstorm (with procedural lightning), Freezing Rain, Radiation Fog, Petrichor.

### 2026-04-02 — Multilingual Support and Weather v4

- **8-language support** (`i18n.js`): EN, ES, PT, FR, JA, KO, ID, ZH with globe icon language switcher.
- **Weather System v4**: AAA wind engine with Ekman spiral gradient, 3 depth layers with parallax, ground splashes, atmospheric mist particles.
- **Umbrella collision physics**: Realistic deflection with splash and drip effects.
- **Wet text effect** (`wet-text.js`): Rain-responsive SVG filter displacement on the heading.
- **Language switcher fixes**: Click-only dropdown, improved positioning inside decorative frame.
- **Cache busting**: Added `?v=` query strings to CSS/JS references + Google Fonts CSP allowance.
- **Favicon fixes**: Transparent background ICO + pink background Apple Touch icon.

### 2026-04-01 — Cloud System, Interaction, and Mobile Fixes

- **Individual cloud entities**: Each cloud has unique noise seed, position, depth layer, direction, z-axis movement, size breathing, and shape evolution.
- **Cloud collision and merging**: Five-phase model (Westcott 1994) — approach, bridging, thickening, merger, growth.
- **Rain-text collision**: Drops bounce off the "CASS LA RIA" heading bounding box.
- **Phone tilt**: DeviceOrientationEvent API shifts rain direction and cloud drift on mobile.
- **Favicon**: Crystal skull in all standard sizes.
- **Social media icons**: Inline SVGs with deep linking on mobile.
- **Contact button**: Mailto link with envelope icon.
- **Accessibility**: Skip link, ARIA labels, focus indicators, pause toggle, touch targets.
- **Mobile/WebView fixes**: Comprehensive display overhaul for compatibility.
- **Cache policy**: `must-revalidate` for HTML/CSS/JS, immutable for assets.
- **SEO**: Meta tags, OG image, JSON-LD structured data.

### 2026-03-31 — Rain Animation System

- **Rain animation engine** (`rain.js`): Procedural simplex noise clouds, realistic wind-cloud-rain physics, 7 weather presets.
- **Self-hosted fonts**: Cormorant Garamond `.woff2` files in `assets/fonts/`.
- **Security hardening**: Full CSP, HSTS, X-Frame-Options, and all OWASP-recommended headers via `netlify.toml`.

### 2026-03-30 — Netlify Deployment

- **`netlify.toml`**: Zero-config Netlify deployment with security headers and cache control.

### 2026-03-28 — Asset Structure

- **Scalable asset directories**: `assets/fonts/`, `assets/icons/`, `assets/images/`, `assets/video/`, `assets/audio/`.
- **`CONTRIBUTING.md`**: Initial contributor guide.

### 2026-03-27 — Initial Release

- **Initial commit**: Single-page landing with name, social links (YouTube, TikTok, Instagram), and Neo Yokio pink colour palette.

---

## License

All rights reserved — Cass la Ria.
