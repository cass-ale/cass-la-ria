# How to Update This Site

A quick reference for adding assets, pages, and content to the Cass la Ria hub.

---

## Directory Map

```
cass-la-ria/
├── index.html              ← Main landing page (name, links, meta, structured data)
├── netlify.toml            ← Netlify deploy config + security headers (CSP, HSTS, etc.)
├── manifest.json           ← PWA manifest for "Add to Home Screen"
├── sw.js                   ← Service worker for offline support
├── robots.txt              ← Search engine crawl rules
├── sitemap.xml             ← Sitemap for SEO
├── 404.html                ← Custom 404 error page
├── offline.html            ← Offline fallback page
├── css/
│   ├── variables.css       ← Design tokens — colours, fonts, spacing, transitions
│   ├── reset.css           ← Browser reset (rarely needs editing)
│   ├── layout.css          ← Page structure and responsive breakpoints
│   ├── components.css      ← Buttons, headings, language switcher, decorative elements
│   ├── animations.css      ← Entrance animations (respects reduced-motion)
│   ├── rain.css            ← Rain canvas, umbrella cursor, touch ripple
│   ├── editable.css        ← Inline editing UI (tooltip, pencil, mobile bar, toast)
│   ├── fonts.css           ← Self-hosted @font-face declarations (Latin)
│   └── fonts-cjk.css       ← CJK font fallback declarations (loaded lazily)
├── js/
│   ├── main.js             ← Viewport fix, deep linking, mailto fallback, i18n switcher
│   ├── rain.js             ← Rain/cloud animation engine (weather presets, collision, tilt)
│   ├── time-theme.js       ← Time-based colour theme (updates CSS variables every minute)
│   ├── editable.js         ← Inline editing module (localStorage + Google Sheet logging)
│   ├── i18n.js             ← Translation strings for all 8 languages
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
├── research/               ← Research notes (UX, benchmarks, weather, translation, etc.)
├── pages/                  ← Future additional pages
├── screenshots/            ← Development screenshots for reference
├── CONTRIBUTING.md         ← This file
└── README.md               ← Project overview + changelog
```

---

## Architecture Overview

### Time-Based Theming (`js/time-theme.js`)

The site's colour palette changes throughout the day. The theme system updates CSS custom properties (`--color-bg`, `--color-text`, `--color-accent`, etc.) in `variables.css` every minute based on the visitor's local time. All CSS should use these variables, never hardcoded colour values.

### Language System (`js/i18n.js` + `js/main.js`)

The site supports 8 languages (EN, ES, PT, FR, JA, KO, ID, ZH). Translation strings live in `js/i18n.js`. Any element with `data-i18n="key"` is automatically translated when the language changes. CJK fonts are lazy-loaded via Google Fonts with `text=` subsetting (~17KB each).

### Inline Editing (`js/editable.js` + `css/editable.css`)

Visitors can edit any element with `data-editable="key"` to suggest translation improvements. Edits are:
- **Stored locally** in the visitor's `localStorage` (only visible to them)
- **Logged remotely** to a Google Sheet via Apps Script (for the site owner to review)
- **Spam-checked** client-side with 6 heuristics (profanity, gibberish, length, links, rate, duplicates)

To make an element editable, add `data-editable="unique-key"`:
```html
<p data-editable="hero-tagline" data-i18n="tagline">Original text</p>
```

For multiline elements, add `data-editable-multiline`:
```html
<p data-editable="story-text" data-editable-multiline>Long text...</p>
```

### Content Security Policy (`netlify.toml`)

The CSP is strict. If you add a new external resource (font CDN, analytics, etc.), you must update the CSP in `netlify.toml` or the browser will block it. Current allowed origins:
- `fonts.googleapis.com` / `fonts.gstatic.com` — CJK fonts
- `script.google.com` — inline editing feedback endpoint

---

## Common Tasks

### Add an image to the site

1. Drop the file into `assets/images/`.
2. Reference it in HTML:
   ```html
   <img src="assets/images/my-photo.webp" alt="Description" />
   ```
3. Or use it as a CSS background:
   ```css
   .hero {
     background-image: url('../assets/images/my-photo.webp');
   }
   ```

### Add a favicon

1. Place your icon files in `assets/icons/` (e.g. `favicon.ico`, `apple-touch-icon.png`).
2. Add to the `<head>` in `index.html`:
   ```html
   <link rel="icon" href="assets/icons/favicon.ico" />
   <link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png" />
   ```

### Add a custom font

1. Place `.woff2` files in `assets/fonts/`.
2. Declare the font in `css/fonts.css`:
   ```css
   @font-face {
     font-family: 'MyFont';
     src: url('../assets/fonts/MyFont.woff2') format('woff2');
     font-weight: 400;
     font-style: normal;
     font-display: swap;
   }
   ```
3. Update the font variable in `css/variables.css`:
   ```css
   --font-display: 'MyFont', 'Cormorant Garamond', serif;
   ```

### Add a new page

1. Create an HTML file in `pages/` (e.g. `pages/portfolio.html`).
2. Copy the `<head>` from `index.html` — adjust the CSS paths to go up one level:
   ```html
   <link rel="stylesheet" href="../css/variables.css" />
   <link rel="stylesheet" href="../css/reset.css" />
   <!-- etc. -->
   ```
3. Link to it from `index.html`:
   ```html
   <a href="pages/portfolio.html" class="btn">Portfolio</a>
   ```

### Add a new social link / button

In `index.html`, add another `<a>` inside the `<nav class="hero__nav">`:
```html
<a
  href="https://example.com/@casslaria"
  target="_blank"
  rel="noopener noreferrer"
  class="btn"
>
  Platform Name
</a>
```
The existing CSS will style it automatically.

### Change the colour scheme

Edit **only** `css/variables.css`. Every colour on the site reads from these tokens:

| Variable              | Controls                        |
|-----------------------|---------------------------------|
| `--color-bg`          | Page background                 |
| `--color-bg-subtle`   | Subtle background accents       |
| `--color-text`        | Primary text colour             |
| `--color-text-muted`  | Secondary / lighter text        |
| `--color-accent`      | Buttons, rule, key highlights   |
| `--color-accent-soft` | Hover state accent              |
| `--color-border`      | Frame and button borders        |
| `--color-border-light`| Lighter border on hover         |

**Important:** The time-theme system overrides these variables dynamically. If you change the base values, also update the theme palettes in `js/time-theme.js`.

### Add a new translation language

1. Add the translation strings to `js/i18n.js` under a new language key.
2. Add a new `<button>` to the language switcher in `index.html`.
3. If the language uses CJK characters, add a Google Fonts URL with `text=` subsetting to `main.js`.
4. Add a new `<link rel="alternate" hreflang="xx">` tag in the `<head>`.
5. Update the `knowsLanguage` array in the JSON-LD structured data.
6. Regenerate the CSP hash if the JSON-LD changed (see comment in `netlify.toml`).

### Add background video or audio

1. Place the file in `assets/video/` or `assets/audio/`.
2. Add to `index.html`:
   ```html
   <video class="bg-video" autoplay muted loop playsinline>
     <source src="assets/video/reel.mp4" type="video/mp4" />
   </video>
   ```
3. Style in `css/layout.css`:
   ```css
   .bg-video {
     position: fixed;
     inset: 0;
     width: 100%;
     height: 100%;
     object-fit: cover;
     z-index: 0;
     opacity: 0.3;
   }
   ```

---

## Image Format Recommendations

| Format | Best For                          | Notes                    |
|--------|-----------------------------------|--------------------------|
| `.webp`| Photos, artwork (preferred)       | Smallest file size       |
| `.png` | Graphics with transparency        | Lossless                 |
| `.jpg` | Photos where .webp isn't an option| Wide compatibility       |
| `.svg` | Icons, logos, line art            | Scales to any size       |

---

## Deployment Checklist

Before pushing updates:

1. Test locally: `python3 -m http.server 8080` then open `http://localhost:8080`
2. Check mobile: resize browser or use DevTools device toolbar
3. Verify all new asset paths are correct (relative, not absolute)
4. If you changed CSS, bump the `?v=` query string in `index.html` to bust cache
5. If you changed the JSON-LD, regenerate the CSP hash (see `netlify.toml` comment)
6. Commit and push:
   ```bash
   git add -A
   git commit -m "Add [description of what you added]"
   git push
   ```
