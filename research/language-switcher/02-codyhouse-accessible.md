# CodyHouse — Accessible Language Picker
Source: https://codyhouse.co/blog/post/accessible-language-picker
Author: Claudia Romano, May 2019

## Accessible HTML Structure

### Button trigger:
```html
<button aria-label="English - Select your language" 
        aria-expanded="false" 
        aria-controls="language-picker-dropdown">
  <span aria-hidden="true">🌐</span>
</button>
```

### Dropdown list:
```html
<div id="language-picker-dropdown" aria-describedby="language-picker-description">
  <p class="sr-only" id="language-picker-description">Select your language</p>
  <ul role="listbox">
    <li>
      <a lang="de" hreflang="de" href="#" role="option" data-value="deutsch">
        Deutsch
      </a>
    </li>
    <li>
      <a lang="en" hreflang="en" href="#" aria-selected="true" role="option">
        English
      </a>
    </li>
  </ul>
</div>
```

## Key ARIA Attributes
- `aria-label` on button: announces selected language + purpose
- `aria-expanded`: false when closed, true when open
- `aria-controls`: links button to dropdown id
- `role="listbox"` on `<ul>`: tells SR this is a selection list
- `role="option"` on each `<a>`: each item is a selectable option
- `lang` attribute on each option: SR pronounces the language name correctly
- `aria-selected="true"` on the active language
- `aria-describedby`: provides description for the dropdown

## Keyboard Navigation
- Enter/Space: toggle dropdown
- Arrow keys: navigate between options
- Escape: close dropdown
- Tab: move focus out

## For Our Implementation
- Use `<button>` not `<a>` for the globe trigger (it performs an action, not navigation)
- Each language labeled in its native script with `lang` attribute
- Since we're a single-page site, clicking a language does client-side text replacement (no href navigation)
- Use `role="option"` with `<button>` elements instead of `<a>` since we're not navigating
