# Smashing Magazine — Designing A Perfect Language Selector UX
Source: https://www.smashingmagazine.com/2022/05/designing-better-language-selector/
Author: Vitaly Friedman, May 2022

## Key UX Principles

1. **Avoid auto-redirects** — Can't infer user's language from location or browser settings
2. **Users look in header first, then footer** — The two expected locations
3. **Globe icon or "translate" icon** — Users recognize these as language indicators
4. **Use text labels for languages, NOT flags** — Flags represent countries, not languages
5. **Non-modal dialogs** — Don't use full-screen modals for language selection
6. **Decouple location and language** — They are separate concerns
7. **Label each language in its own script** — "Français" not "French", "日本語" not "Japanese"
8. **Allow overrides** — Let users change regardless of auto-detection
9. **Persist the choice** — Remember via localStorage or cookie

## Placement Patterns Observed
- **Header corner** — Most common for small language lists (2-8 languages)
- **Footer** — Secondary location, always expected
- **Globe icon trigger** — Opens a dropdown/flyout with language list
- **Non-modal popover** — Preferred over full modals for small lists

## For Our Use Case (Cass la Ria)
- Small number of languages (likely 5-10)
- Single-page site — no URL routing needed
- Globe icon in a corner → small elegant flyout list
- Each language labeled in its native script
- localStorage persistence
- No flags — text labels only
- Client-side text replacement (no server needed)
