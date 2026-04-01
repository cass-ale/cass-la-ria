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

One of **7 weather presets** is randomly selected each time a visitor loads the page:

| Preset | Rain | Wind | Gusts | Mood |
|---|---|---|---|---|
| Gentle Mist | Very light | None | No | Calm, barely there |
| Light Drizzle | Light | Slight | No | Soft, peaceful |
| Steady Rain | Moderate | Moderate | Yes | Classic rainy day |
| Windy Shower | Moderate | Strong | Yes | Blustery, dynamic |
| Downpour | Heavy | Slight | Yes | Intense, vertical |
| Storm Front | Very heavy | Very strong | Yes | Dramatic, angled |
| Typhoon | Extreme | Extreme | Yes | Chaotic, powerful |

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
| Touch targets | WCAG 2.5.8 | Minimum 44×44px on all interactive elements |
| Semantic HTML | WCAG 1.3.1 | Proper heading hierarchy, landmarks, nav labels |

## Privacy and Security

This site collects **zero user data**. No cookies, no analytics, no tracking pixels, no forms, no third-party scripts.

### Self-Hosted Fonts

Google Fonts (Cormorant Garamond) are self-hosted in `assets/fonts/` to eliminate all external requests. No DNS lookups to Google, no referrer leakage, no cookie exchange.

### Security Headers (via `netlify.toml`)

| Header | Value | Purpose |
|---|---|---|
| Content-Security-Policy | `default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; ...` | Only own resources allowed |
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| X-Frame-Options | `DENY` | Prevent clickjacking |
| X-Content-Type-Options | `nosniff` | Prevent MIME sniffing |
| X-XSS-Protection | `0` | Disabled per OWASP (CSP replaces it) |
| Referrer-Policy | `strict-origin-when-cross-origin` | Limit referrer leakage |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), interest-cohort=(), ...` | Disable unused APIs, block FLoC |
| Cross-Origin-Opener-Policy | `same-origin` | Prevent cross-origin window interaction |
| Cross-Origin-Resource-Policy | `same-origin` | Prevent resource theft |

Sources: [OWASP HTTP Headers Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), [Netlify Security Headers Guide](https://blog.serghei.pl/posts/configuring-security-headers-with-netlify/).

## Directory Structure

```
cass-la-ria/
├── index.html              ← Main page
├── netlify.toml            ← Netlify deploy config + security headers
├── css/
│   ├── fonts.css           ← Self-hosted @font-face declarations
│   ├── variables.css       ← Design tokens (colours, fonts, spacing)
│   ├── reset.css           ← Cross-browser normalisation
│   ├── layout.css          ← Page structure + responsive breakpoints
│   ├── components.css      ← Icon buttons, contact, heading, toggle
│   ├── animations.css      ← Entrance animations (motion-safe)
│   └── rain.css            ← Rain canvas, umbrella cursor, touch ripple
├── js/
│   ├── main.js             ← Viewport-height fix + future hooks
│   └── rain.js             ← Rain animation engine (clouds, drops, wind, presets, tilt, collision)
├── assets/
│   ├── fonts/              ← Self-hosted Cormorant Garamond .woff2 files
│   ├── icons/              ← Favicon files (ICO, PNG, Apple Touch)
│   ├── images/             ← Future photos, artwork, backgrounds
│   ├── video/              ← Future clips, reels
│   └── audio/              ← Future music, samples
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
| Rain behaviour or presets | `js/rain.js` |
| Security headers | `netlify.toml` |
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

## Responsive Breakpoints

| Viewport | Width | Layout |
|---|---|---|
| Small phone | ≤ 374px | Compact icon buttons, tight spacing |
| Phone | 375–599px | Icon buttons in a row, balanced |
| Tablet+ | ≥ 600px | Full elegance, generous spacing |
| Landscape phone | height ≤ 500px | Reduced vertical padding |

Key techniques: `clamp()` fluid typography, `100dvh` dynamic viewport height, JS `--vh` fallback, 44px minimum touch targets, and `prefers-reduced-motion` support.

## License

All rights reserved — Cass la Ria.
