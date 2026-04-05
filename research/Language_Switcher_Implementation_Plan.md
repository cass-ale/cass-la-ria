# Language Switcher Implementation Plan
**Project:** Cass la Ria Official Website
**Author:** Manus AI

This document outlines the architecture, UX design, and technical implementation plan for integrating a multi-language switcher into the Cass la Ria website. The implementation will be powered by the `poetic-translation` skill to ensure all translated copy maintains the site's artistic integrity.

## 1. UX Design & Placement

Based on UX research from NNGroup [1] and Smashing Magazine [2], the language switcher must be discoverable but unobtrusive, matching the site's minimalist aesthetic.

### Visual Design
- **Trigger:** A minimalist SVG globe icon (16x16px or 20x20px).
- **Placement:** The bottom-right corner of the decorative border frame (`.frame`). This keeps it out of the way of the primary content (center) and social links (bottom-left), while remaining in a highly expected utility zone.
- **Interaction:** Hovering over (or clicking on mobile) the globe icon reveals an elegant, vertically stacked list of supported languages.
- **Language Labels:** Languages will be listed in their native scripts (e.g., "Français", "日本語", "한국어") rather than English translations or flags, as flags represent countries, not languages [2].

### Accessibility (a11y)
Following the CodyHouse accessible language picker pattern [3]:
- The trigger will be a `<button>` with `aria-expanded` and `aria-controls`.
- The dropdown will use `role="listbox"`.
- Each language option will use `role="option"` and include the `lang` attribute so screen readers pronounce the language name correctly.

## 2. Technical Architecture

The site is a single static HTML page. To maintain the 100/100 Lighthouse performance score and avoid server-side routing, we will use a **client-side vanilla JavaScript i18n pattern** [4].

### The `data-i18n` Pattern
Every translatable text node in `index.html` will receive a `data-i18n` attribute acting as a key:

```html
<!-- Example -->
<a href="mailto:..." id="contact-btn" class="btn" data-i18n="contact.button">
  Contact
</a>
<span class="email-text" data-i18n="contact.email_label">cassaleria@gmail.com</span>
```

### The Translation Dictionary
Since the site has very little text, we will inline the translation dictionary directly in a new `js/i18n.js` file to avoid additional HTTP requests.

```javascript
const translations = {
  en: {
    "contact.button": "Contact",
    "contact.email_label": "cassaleria@gmail.com",
    "nav.skip": "Skip to content"
  },
  fr: {
    "contact.button": "Contact",
    "contact.email_label": "cassaleria@gmail.com",
    "nav.skip": "Aller au contenu"
  },
  ja: {
    "contact.button": "お問い合わせ",
    "contact.email_label": "cassaleria@gmail.com",
    "nav.skip": "本文へスキップ"
  }
};
```

### State Management
- The selected language will be saved to `localStorage` so the preference persists across sessions.
- On page load, the script will check `localStorage`, fallback to `navigator.language`, and apply the translations immediately.
- The `<html>` tag's `lang` attribute will be updated dynamically to ensure screen readers switch pronunciation rules.

## 3. Translation Strategy (The Poetic Translation Skill)

The actual translation of the text will be governed by the `poetic-translation` skill, which enforces a 3-tiered classification system:

| Element | Tier | Strategy | Example |
|---------|------|----------|---------|
| "CASS LA RIA" | Tier 1 (Brand) | **Never translate.** | Stays "CASS LA RIA" in all languages. |
| "Contact" button | Tier 2 (UI) | **Domesticate.** | Use standard UI conventions (e.g., "Contacto" in ES, "お問い合わせ" in JA). |
| "Skip to content" | Tier 2 (UI) | **Domesticate.** | Standard accessibility phrasing. |
| Future Bio/Tagline | Tier 3 (Creative) | **Transcreate.** | Apply the 7-step poetic translation process, routing to specific aesthetic traditions (e.g., *Yūgen* for Japanese, *Han* for Korean). |

## 4. Implementation Steps

When authorized to proceed, the implementation will follow these steps:

1. **HTML Updates:** Add `data-i18n` attributes to all translatable elements in `index.html`.
2. **Component Addition:** Inject the accessible globe button and dropdown list into the `.frame` container.
3. **CSS Styling:** Add styles for the language switcher in `components.css`, ensuring it matches the site's typography, colors, and hover states.
4. **JavaScript Logic:** Create `js/i18n.js` to handle language detection, `localStorage` persistence, and DOM text replacement.
5. **Translation Generation:** Use the `poetic-translation` skill to generate the initial dictionary for 3-5 target languages (e.g., French, Spanish, Japanese, Korean).
6. **Testing:** Verify keyboard navigation, screen reader announcements, and visual layout across desktop and mobile viewports.

## References

[1] NNGroup. "6 Tips for Improving Language Switchers on Ecommerce Sites." March 2022. https://www.nngroup.com/articles/language-switching-ecommerce/
[2] Smashing Magazine. "Designing A Perfect Language Selector UX." May 2022. https://www.smashingmagazine.com/2022/05/designing-better-language-selector/
[3] CodyHouse. "How to create an accessible language picker." May 2019. https://codyhouse.co/blog/post/accessible-language-picker
[4] Andreas Remdt. "Building a Super Small and Simple i18n Script in JavaScript." https://andreasremdt.com/blog/building-a-super-small-and-simple-i18n-script-in-javascript/
