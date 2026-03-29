# Cass la Ria — Personal Hub

A minimal, elegant single-page website serving as the central hub for the multi-faceted creative **Cass la Ria**.

## Design

The visual language fuses two distinct aesthetics:

- **Neo Yokio** — soft blush pinks, muted pastels, and the refined melancholy of anime-inflected luxury.
- **Ralph Lauren** — serif typography, heritage-driven restraint, and timeless elegance.

## Structure

```
cass-la-ria/
├── index.html              Main landing page
├── css/
│   ├── variables.css       Design tokens (colours, fonts, spacing)
│   ├── reset.css           Cross-browser reset
│   ├── layout.css          Page structure and responsive breakpoints
│   ├── components.css      Buttons, headings, decorative elements
│   └── animations.css      Entrance animations (motion-safe)
├── js/
│   └── main.js             Viewport-height fix and future hooks
├── assets/
│   ├── images/             Photos, artwork, backgrounds
│   ├── video/              Clips, reels, showreels
│   ├── audio/              Music, samples, podcasts
│   ├── fonts/              Custom / self-hosted font files
│   └── icons/              Favicon, social icons, SVGs
├── pages/                  Additional pages (portfolio, about, etc.)
├── CONTRIBUTING.md         Guide for adding assets and updating the site
└── README.md               This file
```

## Quick Edits

| What you want to change       | File to edit           |
|-------------------------------|------------------------|
| Colours, fonts, spacing       | `css/variables.css`    |
| Page layout / responsiveness  | `css/layout.css`       |
| Button styles / name heading  | `css/components.css`   |
| Entrance animations           | `css/animations.css`   |
| Social links / name text      | `index.html`           |
| Future interactivity          | `js/main.js`           |

For detailed instructions on adding images, fonts, pages, video, and more, see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Responsiveness

The site is built mobile-first and tested across:

- Small phones (≤ 374px) — stacked buttons, compact spacing
- Standard phones (375px – 599px) — stacked buttons, balanced layout
- Tablets (600px – 1023px) — inline buttons, wider frame
- Desktop (1024px+) — full elegance with generous whitespace
- Landscape phones — reduced vertical padding to prevent overflow

Key techniques: `clamp()` fluid typography, `100dvh` dynamic viewport height, JS `--vh` fallback, 44px minimum touch targets, and `prefers-reduced-motion` support.

## Deployment

Static site — no build step required. Deploy to any static host:

- **GitHub Pages** — push to `main`, enable Pages in repo settings
- **Netlify / Vercel** — connect the repo, publish root directory
- **Any web server** — upload the files as-is

## License

All rights reserved. This site and its contents are the property of Cass la Ria.
