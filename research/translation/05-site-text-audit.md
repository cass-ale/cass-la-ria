# Cass la Ria — Site Text Audit

## All Visible Text on the Site

| # | Text | Location | Type | Translation Approach |
|---|------|----------|------|---------------------|
| 1 | "Cass la Ria" | `<h1>` heading | Artist name / brand | **NEVER translate** — foreignize in all languages |
| 2 | "Contact" | Button label | Functional UI | **Domesticate** — use natural target-language equivalent |
| 3 | "admin@caprilaria.com" | Below contact button | Email address | **NEVER translate** — keep as-is |
| 4 | "Skip to content" | Screen reader only | Accessibility | **Domesticate** — standard a11y translation |

## All Meta/SEO Text (invisible but crawled)

| # | Text | Location | Translation Approach |
|---|------|----------|---------------------|
| 5 | "Cass la Ria \| Official Website" | `<title>`, og:title, twitter:title | Partial — translate "Official Website" |
| 6 | "Official website of Cass la Ria. Multi-faceted creative — music, video, and visual art." | description, og:description, twitter:description | **Transcreate** — preserve the evocative tone |
| 7 | "Cass Aleria" | meta author | **NEVER translate** |
| 8 | Keywords | meta keywords | **Localize** — add target-language search terms |
| 9 | "YouTube" / "TikTok" / "Instagram" | aria-labels | **Domesticate** — platform names stay, but label phrasing may change |
| 10 | "Send email to Cass la Ria at admin@caprilaria.com" | aria-label | **Domesticate** — translate the sentence structure |
| 11 | "Email address" | aria-label | **Domesticate** |
| 12 | "Creative" | JSON-LD jobTitle | **Transcreate** — find the culturally resonant equivalent |
| 13 | "Multi-faceted creative — music, video, and visual art." | JSON-LD description | Same as #6 |

## Key Observations

1. **Extremely minimal text** — only 4 visible text elements, making every word precious
2. **"Contact"** is the only word that needs translation on the visible page (plus "Skip to content" for a11y)
3. The real translation challenge is the **meta/SEO text** — the description must feel poetic and intentional in every language
4. The artist name "Cass la Ria" has Romance-language roots (Italian/Spanish "la ria" = the inlet/estuary) — this may resonate differently in Romance vs. Germanic vs. Asian languages
5. The `lang="en"` attribute on `<html>` would need to change per language version
6. The `og:locale` would need to change (e.g., `fr_FR`, `es_ES`, `ja_JP`)

## Translation Complexity Assessment

**Visible text:** Very low complexity (1 word + 1 phrase)
**Meta text:** Medium complexity (poetic description needs transcreation)
**Structural:** Medium complexity (lang attributes, locale, hreflang tags for multi-language SEO)
**Cultural:** High complexity (the "multi-faceted creative" concept doesn't translate literally into many languages — e.g., Japanese has no direct equivalent for "creative" as a noun)
