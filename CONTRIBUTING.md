# How to Update This Site

A quick reference for adding assets, pages, and content to the Cass la Ria hub.

---

## Directory Map

```
cass-la-ria/
├── index.html              ← Main landing page (edit name, links, meta)
├── css/
│   ├── variables.css       ← Design tokens — change colours, fonts, spacing here
│   ├── reset.css           ← Browser reset (rarely needs editing)
│   ├── layout.css          ← Page structure and responsive breakpoints
│   ├── components.css      ← Buttons, headings, decorative elements
│   └── animations.css      ← Entrance animations (respects reduced-motion)
├── js/
│   └── main.js             ← Viewport fix + future interactivity hooks
├── assets/
│   ├── images/             ← Photos, artwork, backgrounds (.jpg .png .webp)
│   ├── video/              ← Clips, reels, showreels (.mp4 .webm)
│   ├── audio/              ← Music, samples, podcasts (.mp3 .wav .ogg)
│   ├── fonts/              ← Custom/self-hosted font files (.woff2 .woff)
│   └── icons/              ← Favicon, social icons, SVG icons (.svg .ico .png)
├── pages/                  ← Additional pages (portfolio, about, etc.)
├── CONTRIBUTING.md         ← This file
└── README.md               ← Project overview
```

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
2. Declare the font in `css/variables.css`:
   ```css
   @font-face {
     font-family: 'MyFont';
     src: url('../assets/fonts/MyFont.woff2') format('woff2');
     font-weight: 400;
     font-style: normal;
     font-display: swap;
   }
   ```
3. Update the font variable:
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
4. Commit and push:
   ```bash
   git add -A
   git commit -m "Add [description of what you added]"
   git push
   ```
