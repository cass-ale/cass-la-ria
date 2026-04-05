# Vanilla i18n — Client-Side Translation Pattern
Source: https://andreasremdt.com/blog/building-a-super-small-and-simple-i18n-script-in-javascript/
Author: Andreas Remdt

## Core Pattern: data-i18n Attributes

### HTML markup:
```html
<h1 data-i18n="title">This is some English title</h1>
<p data-i18n="description">Some description text</p>
```

### JSON translation files (one per language):
```
i18n/
├── en.json
├── de.json
├── es.json
└── ja.json
```

### JSON structure:
```json
{
  "title": "Dies ist ein deutscher Titel",
  "description": "Ein Beschreibungstext",
  "contact": {
    "button": "Kontakt",
    "email_label": "E-Mail kopiert!"
  }
}
```

### JavaScript translator:
1. Detect user's preferred language via `navigator.languages[0]`
2. Fetch the JSON file: `fetch(/i18n/${lang}.json)`
3. Loop through all `[data-i18n]` elements
4. Replace `textContent` with the matching key from JSON
5. Support nested keys with dot notation: `data-i18n="contact.button"`
6. Persist choice in `localStorage`

### Key implementation details:
- Use `data-i18n` on every translatable element
- Keep English as the default in HTML (SEO-friendly, always visible)
- JSON files are lazy-loaded only when a language is selected
- `document.documentElement.lang` should be updated when language changes
- For attributes like `aria-label`, use `data-i18n-attr="aria-label"` pattern

## For Our Implementation (Cass la Ria)
- Very few translatable strings (~6-8 total)
- Can inline all translations in a single JS object instead of separate JSON files
- Keeps it zero-dependency, zero-fetch, instant switching
- data-i18n approach is clean and maintainable
- Must handle: heading, skip-link, contact button, email label, aria-labels
