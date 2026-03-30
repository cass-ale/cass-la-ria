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
├── netlify.toml            Netlify build & deploy configuration
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
| Netlify build / headers       | `netlify.toml`         |

For detailed instructions on adding images, fonts, pages, video, and more, see **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## Deployment on Netlify

This site includes a `netlify.toml` that handles all configuration automatically. To deploy:

1. Log in to [Netlify](https://app.netlify.com/) and click **"Add new site" → "Import an existing project"**.
2. Connect your GitHub account and select the `cass-la-ria` repository.
3. Netlify will read `netlify.toml` automatically. Verify the settings show:
   - **Build command:** *(blank — leave empty)*
   - **Publish directory:** `.`
4. Click **"Deploy site"**.

The `netlify.toml` also configures security headers, asset caching, and disables CSS/JS post-processing to prevent style breakage.

### Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `missing script: build` | Netlify trying to run a build command | Ensure build command is blank (the `netlify.toml` handles this) |
| "Page not found" | Publish directory wrong | Must be `.` (root), not `/build` or a subdirectory |
| CSS not loading | Incorrect paths or post-processing | Paths are relative; `netlify.toml` disables CSS bundling/minification |
| Blank page | `index.html` not at root | Verify `index.html` is in the repo root, not inside a subfolder |

## Responsiveness

The site is built mobile-first and tested across:

- Small phones (≤ 374px) — stacked buttons, compact spacing
- Standard phones (375px – 599px) — stacked buttons, balanced layout
- Tablets (600px – 1023px) — inline buttons, wider frame
- Desktop (1024px+) — full elegance with generous whitespace
- Landscape phones — reduced vertical padding to prevent overflow

Key techniques: `clamp()` fluid typography, `100dvh` dynamic viewport height, JS `--vh` fallback, 44px minimum touch targets, and `prefers-reduced-motion` support.

## License

All rights reserved. This site and its contents are the property of Cass la Ria.
