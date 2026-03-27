# Cass la Ria — Personal Hub

A minimal, elegant single-page website serving as the central hub for the multi-faceted creative **Cass la Ria**.

## Design

The visual language fuses two distinct aesthetics:

- **Neo Yokio** — muted luxury, deep midnight tones, and the refined melancholy of anime-inflected high fashion.
- **Ralph Lauren** — serif typography, antique gold accents, warm ivory text, and restrained, heritage-driven elegance.

## Structure

```
cass-la-ria/
├── index.html              Main page
├── css/
│   ├── variables.css       Design tokens (colours, fonts, spacing)
│   ├── reset.css           Cross-browser reset
│   ├── layout.css          Page structure and responsive breakpoints
│   ├── components.css      Buttons, headings, decorative elements
│   └── animations.css      Entrance animations (motion-safe)
├── js/
│   └── main.js             Viewport-height fix and future hooks
└── README.md
```

## Editing Guide

| What you want to change       | File to edit           | Notes                                          |
|-------------------------------|------------------------|-------------------------------------------------|
| Colours, fonts, spacing       | `css/variables.css`    | All design tokens live here as CSS variables    |
| Page layout / responsiveness  | `css/layout.css`       | Flexbox-based; breakpoints at 375px and 600px   |
| Button styles / name heading  | `css/components.css`   | Fluid sizing via `clamp()`                      |
| Entrance animations           | `css/animations.css`   | Respects `prefers-reduced-motion`               |
| Social links / name text      | `index.html`           | Update `href` values and heading text           |
| Future interactivity          | `js/main.js`           | Lightweight; extend the DOMContentLoaded hook   |

## Responsiveness

The site is built mobile-first and tested across:

- Small phones (≤ 374px) — stacked buttons, compact spacing
- Standard phones (375px – 599px) — stacked buttons, balanced layout
- Tablets (600px – 1023px) — inline buttons, wider frame
- Desktop (1024px+) — full elegance with generous whitespace
- Landscape phones — reduced vertical padding to prevent overflow

Key techniques used:

- `clamp()` for fluid typography and spacing (no hard breakpoint jumps)
- `100dvh` (dynamic viewport height) for accurate mobile fullscreen
- JS-based `--vh` custom property as a fallback for older browsers
- Minimum 44px touch targets on all interactive elements
- `prefers-reduced-motion` respected for accessibility

## Deployment

This is a static site — no build step required. Deploy to any static host:

- **GitHub Pages** — push to `main`, enable Pages in repo settings
- **Netlify / Vercel** — connect the repo, publish root directory
- **Any web server** — upload the files as-is

## License

All rights reserved. This site and its contents are the property of Cass la Ria.
