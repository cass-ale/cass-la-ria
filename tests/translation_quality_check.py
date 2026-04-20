#!/usr/bin/env python3
"""
Weekly Translation Quality Check — Young Cicero du Lac
======================================================
Evaluates all 7 target-language translations of the story against the English
source using an LLM-based literary evaluation framework inspired by:
  - KAIST RULER rubric (Lexical Choice, Syntax, Content Accuracy, Register)
  - MQM Multidimensional Quality Metrics
  - Professional literary translation QA best practices
  - Modern literary review standards from acclaimed published translations

The evaluator assumes the character of a master storyteller and translator,
calibrated against modern literary review benchmarks for each target language.

Usage:
    python3 translation_quality_check.py [--i18n-path PATH] [--output-dir DIR]

Sources:
  - KAIST RULER: https://arxiv.org/html/2412.01340v2
  - MQM Framework: https://themqm.org/
  - British Council on Literary Translation: https://www.britishcouncil.org/voices-magazine/what-makes-good-literary-translator
  - Best Literary Translations 2024: https://worldliteraturetoday.org/blog/book-reviews/best-literary-translations-2024
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# 1. Extract translations from i18n.js
# ---------------------------------------------------------------------------

def extract_translations(i18n_path: str) -> dict:
    """Parse the i18n.js file and extract all translation objects."""
    with open(i18n_path, 'r', encoding='utf-8') as f:
        content = f.read()

    start_marker = 'const translations = {'
    start_idx = content.find(start_marker)
    if start_idx == -1:
        raise ValueError("Could not find 'const translations' in i18n.js")

    brace_count = 0
    obj_start = content.index('{', start_idx)
    for i in range(obj_start, len(content)):
        if content[i] == '{':
            brace_count += 1
        elif content[i] == '}':
            brace_count -= 1
            if brace_count == 0:
                obj_end = i + 1
                break

    js_obj = content[obj_start:obj_end]

    # Remove comments
    js_obj = re.sub(r'//[^\n]*', '', js_obj)
    js_obj = re.sub(r'/\*.*?\*/', '', js_obj, flags=re.DOTALL)

    translations = {}
    lang_pattern = re.compile(r"'(\w+)'\s*:\s*\{", re.MULTILINE)

    for match in lang_pattern.finditer(js_obj):
        lang_code = match.group(1)
        block_start = match.end() - 1

        bc = 0
        for i in range(block_start, len(js_obj)):
            if js_obj[i] == '{':
                bc += 1
            elif js_obj[i] == '}':
                bc -= 1
                if bc == 0:
                    block_end = i + 1
                    break

        block = js_obj[block_start:block_end]

        lang_dict = {}
        kv_pattern = re.compile(
            r"'([^']+)'\s*:\s*'((?:[^'\\]|\\.|'')*)'",
            re.DOTALL
        )
        for kv in kv_pattern.finditer(block):
            key = kv.group(1)
            value = kv.group(2)
            value = value.replace("\\'", "'")
            value = value.replace("\\n", "\n")
            lang_dict[key] = value

        if lang_dict:
            translations[lang_code] = lang_dict

    return translations


# ---------------------------------------------------------------------------
# 2. Reconstruct story text in reading order
# ---------------------------------------------------------------------------

CH1_ORDER = [
    'cicero-title', 'cicero-chapter',
    'cicero-m1', 'cicero-m2', 'cicero-m3',
    'cicero-p1', 'cicero-p2', 'cicero-p3', 'cicero-p4',
    'cicero-p5', 'cicero-p6', 'cicero-p7', 'cicero-p8', 'cicero-p9',
    'cicero-p10', 'cicero-p11',
    'cicero-skip1', 'cicero-skip2', 'cicero-skip3',
    'cicero-p12',
    'cicero-p13', 'cicero-p14', 'cicero-p15',
    'cicero-skip4', 'cicero-skip5', 'cicero-skip6',
    'cicero-skip7', 'cicero-skip8', 'cicero-skip9',
    'cicero-skip10', 'cicero-skip11', 'cicero-skip12', 'cicero-skip13',
    'cicero-p16', 'cicero-p17', 'cicero-p18', 'cicero-p19',
    'cicero-p20', 'cicero-p21', 'cicero-p22', 'cicero-p23', 'cicero-p24',
    'cicero-p25', 'cicero-p26', 'cicero-p27', 'cicero-p28', 'cicero-p29',
    'cicero-p30', 'cicero-p31', 'cicero-p32', 'cicero-p33', 'cicero-p34',
    'cicero-p35', 'cicero-p36', 'cicero-p37', 'cicero-p38', 'cicero-p39',
    'cicero-p40', 'cicero-p41', 'cicero-p42', 'cicero-p43', 'cicero-p44',
    'cicero-p45', 'cicero-p46', 'cicero-p47', 'cicero-p48', 'cicero-p49',
    'cicero-p50', 'cicero-p51', 'cicero-p52',
]

CH2_ORDER = [
    'cicero-ch2',
    'cicero2-m1', 'cicero2-m2', 'cicero2-m3',
    'cicero2-p1', 'cicero2-p2', 'cicero2-p3', 'cicero2-p4', 'cicero2-p5',
    'cicero2-p6', 'cicero2-p7', 'cicero2-p8', 'cicero2-p9', 'cicero2-p10',
    'cicero2-p11', 'cicero2-p12', 'cicero2-p13', 'cicero2-p14', 'cicero2-p15',
    'cicero2-p16', 'cicero2-p17', 'cicero2-p18', 'cicero2-p19', 'cicero2-p20',
    'cicero2-p21', 'cicero2-p22', 'cicero2-p23', 'cicero2-p24', 'cicero2-p25',
    'cicero2-p26', 'cicero2-p27', 'cicero2-p28', 'cicero2-p29', 'cicero2-p30',
    'cicero2-p31', 'cicero2-p32', 'cicero2-p33', 'cicero2-p34', 'cicero2-p35',
    'cicero2-p36', 'cicero2-p37', 'cicero2-p38', 'cicero2-p39', 'cicero2-p40',
    'cicero2-p41', 'cicero2-p42', 'cicero2-p43', 'cicero2-p44', 'cicero2-p45',
    'cicero2-p46', 'cicero2-p47', 'cicero2-p48', 'cicero2-p49', 'cicero2-p50',
    'cicero2-p51', 'cicero2-p52', 'cicero2-p53', 'cicero2-p54', 'cicero2-p55',
    'cicero2-p56', 'cicero2-p57', 'cicero2-p58',
]

FULL_ORDER = CH1_ORDER + CH2_ORDER

LANGUAGE_NAMES = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'id': 'Indonesian (Bahasa Indonesia)',
    'ja': 'Japanese',
    'ko': 'Korean',
    'pt': 'Brazilian Portuguese',
    'zh': 'Chinese Simplified',
}

# ---------------------------------------------------------------------------
# Renowned literary references + modern literary review benchmarks per language
# ---------------------------------------------------------------------------

LITERARY_REFERENCES = {
    'es': {
        'authors': ['Gabriel Garcia Marquez', 'Jorge Luis Borges', 'Isabel Allende'],
        'translators': ['Gregory Rabassa', 'Edith Grossman', 'Margaret Sayers Peden'],
        'style_note': 'Spanish literary tradition values lyrical expansion, rhythmic prose, and emotional warmth. The best fairy tales in Spanish (like those of Horacio Quiroga) balance poetic imagery with accessible storytelling.',
        'modern_reviews': (
            'MODERN LITERARY REVIEW BENCHMARKS FOR SPANISH:\n'
            '- Edith Grossman (1936-2023), to whom Best Literary Translations 2024 was dedicated, '
            'set the gold standard: "the translator must serve the text, not the other way around." '
            'Her Don Quixote (2003) was praised for making 400-year-old text feel alive and immediate.\n'
            '- Megan McDowell\'s translations of Samanta Schweblin (Fever Dream, 2017) and '
            'Mariana Enriquez (The Dangers of Smoking in Bed, 2021) are praised for preserving '
            'the hallucinatory tension and uncanny quality of Argentine Spanish without domesticating it.\n'
            '- Garcia Marquez told Gregory Rabassa that his English translation of One Hundred Years '
            'of Solitude was "more accurate than the original" — precision can exceed the source '
            'when the translator deeply understands the author\'s intent.\n'
            '- Key quality markers in modern Spanish literary reviews: Does the prose have duende '
            '(that untranslatable quality of deep emotional truth)? Does dialogue feel like real '
            'speech, not translated speech? Is the lyrical register sustained without becoming purple?'
        ),
    },
    'fr': {
        'authors': ['Antoine de Saint-Exupery', 'Marcel Proust', 'Marguerite Yourcenar'],
        'translators': ['C. K. Scott Moncrieff', 'Barbara Bray', 'Richard Howard'],
        'style_note': 'French literary tradition prizes elegance, precision, and understated emotion. The fairy tale tradition (Perrault, Saint-Exupery) uses deceptively simple language that carries philosophical depth.',
        'modern_reviews': (
            'MODERN LITERARY REVIEW BENCHMARKS FOR FRENCH:\n'
            '- Le Petit Prince by Saint-Exupery, with 600+ translations (the most translated fiction '
            'book in the world as of 2024), is the gold standard for fairy tale prose in French. '
            'Every translation is measured against its philosophical simplicity and emotional directness.\n'
            '- Annie Ernaux (Nobel 2022) pioneered "ecriture plate" (flat writing) — deliberate '
            'simplicity that carries enormous emotional weight. Translations praised for maintaining '
            'this restraint rather than embellishing.\n'
            '- Sam Taylor\'s translation of Leila Slimani\'s Lullaby (2018) was praised for '
            'preserving the "chilling precision" of French prose — every word measured, nothing wasted.\n'
            '- Villa Albertine\'s 2024 Translations Sneak Peek catalogued 350 French-to-English titles, '
            'emphasizing that the French literary tradition demands elegance and precision even in translation.\n'
            '- Key quality markers in modern French literary reviews: Is there elegance without '
            'affectation? Does the prose achieve clarte (clarity) and justesse (rightness/precision)? '
            'Does the fairy tale register evoke Perrault\'s deceptive simplicity?'
        ),
    },
    'id': {
        'authors': ['Pramoedya Ananta Toer', 'Ayu Utami', 'Andrea Hirata'],
        'translators': ['Max Lane', 'Angie Kilbane', 'John H. McGlynn'],
        'style_note': 'Indonesian literary tradition balances formal (baku) and colloquial (gaul) registers. Fairy tales draw from rich oral tradition. Jakarta slang vs. formal narration creates a powerful register contrast.',
        'modern_reviews': (
            'MODERN LITERARY REVIEW BENCHMARKS FOR INDONESIAN:\n'
            '- Max Lane\'s translation of Pramoedya Ananta Toer\'s This Earth of Mankind is the '
            'benchmark for Indonesian literary translation. Praised for preserving Pramoedya\'s '
            '"living, breathing characters" while navigating the formal/informal register shifts '
            'that are central to Indonesian storytelling.\n'
            '- Annie Tucker\'s translation of Eka Kurniawan\'s Beauty Is a Wound (2015) was praised '
            'by Electric Literature for capturing Indonesian magical realism and oral storytelling cadence.\n'
            '- John H. McGlynn\'s translation of Leila S. Chudori\'s Home (2015) was lauded for '
            'preserving the emotional weight of Indonesian political history in accessible prose.\n'
            '- Electric Literature\'s "7 Indonesian Novels in Translation That Push Boundaries" (2023) '
            'emphasizes that Indonesian literature\'s strength is its oral tradition and register contrast.\n'
            '- Key quality markers in modern Indonesian literary reviews: Is the formal/informal '
            'register contrast (baku vs. gaul) preserved? Does dialogue sound like real Indonesian '
            'speech? Does the oral storytelling quality come through? Are Javanese/Malay cultural '
            'nuances handled with sensitivity rather than flattened?'
        ),
    },
    'ja': {
        'authors': ['Haruki Murakami', 'Yasunari Kawabata', 'Kenji Miyazawa'],
        'translators': ['Jay Rubin', 'Edward Seidensticker', 'Alfred Birnbaum'],
        'style_note': 'Japanese literary tradition values yugen — profound grace and subtlety. Say less, mean more. Concrete images over abstractions. Kenji Miyazawa\'s fairy tales are the gold standard.',
        'modern_reviews': (
            'MODERN LITERARY REVIEW BENCHMARKS FOR JAPANESE:\n'
            '- Kenji Miyazawa\'s fairy tales (Once and Forever, trans. John Bester) are the gold '
            'standard. NPR praised the collection for "turning familiar fairy-tale ideas upside down" '
            'while maintaining the gentle, luminous quality of Miyazawa\'s prose.\n'
            '- Sam Bett and David Boyd\'s translation of Mieko Kawakami\'s Breasts and Eggs (2020) '
            'was praised for preserving the Osaka dialect distinction — a key lesson in how register '
            'and dialect must be handled with care in Japanese literary translation.\n'
            '- Jay Rubin and Philip Gabriel\'s Murakami translations are praised for capturing his '
            '"distinctive magical realism" and "fusion of high-brow metaphysical themes with accessible '
            'prose" (Tokyo Weekender, 2025).\n'
            '- Faber\'s "20 Great Japanese Novels" (2025) emphasizes that Japanese literary translation '
            'must capture yugen (profound grace) and mono no aware (the pathos of things).\n'
            '- Key quality markers in modern Japanese literary reviews: Does the prose achieve '
            'the Japanese aesthetic of saying less but meaning more? Are concrete images preferred '
            'over abstractions? Is the emotional register understated yet deeply felt? Do honorific '
            'levels (keigo) accurately reflect character relationships?'
        ),
    },
    'ko': {
        'authors': ['Han Kang', 'Hwang Sok-yong', 'Kim Young-ha'],
        'translators': ['Deborah Smith', 'Anton Hur', 'Chi-Young Kim'],
        'style_note': 'Korean literary tradition values han — deep emotional resonance — and jeong — warmth and connection. Oral storytelling quality is essential. Honorific levels must match character relationships.',
        'modern_reviews': (
            'MODERN LITERARY REVIEW BENCHMARKS FOR KOREAN:\n'
            '- Han Kang (Nobel 2024) and the Deborah Smith controversy: The New Yorker (2018) examined '
            'whether Smith\'s translation of The Vegetarian was "faithful to the original." The LA Review '
            'of Books noted Smith "received extraordinarily high praise for things that have nothing to do '
            'with the translator." Key lesson: a translation can be beautiful in the target language yet '
            'unfaithful to the source — both fidelity AND beauty must be achieved.\n'
            '- Anton Hur\'s translation of Bora Chung\'s Cursed Bunny (2022) was praised for preserving '
            'Korean horror\'s distinctive blend of the mundane and supernatural without over-explaining.\n'
            '- Jamie Chang\'s translation of Cho Nam-joo\'s Kim Ji-young, Born 1982 (2020) was praised '
            'for maintaining the flat, documentary tone that makes the social critique devastating.\n'
            '- EST Translation Studies (2024) on Han Kang\'s Nobel called it "a milestone for Korean '
            'literature" but raised important questions about translation fidelity vs. creative adaptation.\n'
            '- Key quality markers in modern Korean literary reviews: Are honorific levels (jondaenmal '
            'vs. banmal) correctly deployed for each character relationship? Does the prose carry han '
            '(deep sorrow/resilience) and jeong (warmth/connection)? Does dialogue sound like real '
            'Korean speech, not translated speech? Is the oral storytelling quality preserved?'
        ),
    },
    'pt': {
        'authors': ['Clarice Lispector', 'Jose Saramago', 'Machado de Assis'],
        'translators': ['Giovanni Pontiero', 'Margaret Jull Costa', 'Benjamin Moser'],
        'style_note': 'Brazilian Portuguese literary tradition values warmth, rhythm, and sensory richness. The best PT-BR prose has a musical quality. Fairy tales should feel like they could be told aloud around a fire.',
        'modern_reviews': (
            'MODERN LITERARY REVIEW BENCHMARKS FOR BRAZILIAN PORTUGUESE:\n'
            '- Katrina Dodson\'s translation of Clarice Lispector\'s The Complete Stories (2015) was '
            'praised for finally giving English readers access to Lispector\'s "dense, introspective prose" '
            'without flattening its strangeness. Benjamin Moser\'s biography and editorial work on Lispector '
            'set a new standard for how PT-BR literary voice should be preserved.\n'
            '- Margaret Jull Costa\'s translations of Jose Saramago were praised for preserving his '
            'rule-breaking style — no quotation marks, stream-of-consciousness, sentences that run for '
            'pages. Reviewers noted: "He did what only a few are capable of — break the rules."\n'
            '- Johnny Lorenz\'s translation of Itamar Vieira Junior\'s Crooked Plow (2023) was praised '
            'for capturing the rhythms of rural Bahian Portuguese and its oral storytelling cadence.\n'
            '- Modern Languages Open (2017) mapping of Brazilian literature in English emphasizes that '
            'PT-BR translation must preserve the "musical quality" of the language.\n'
            '- Key quality markers in modern PT-BR literary reviews: Does the prose have the warmth '
            'and musicality that defines great Brazilian writing? Does dialogue capture the informality '
            'and rhythm of spoken Brazilian Portuguese? Does the fairy tale register feel like oral '
            'storytelling — something that could be told aloud around a fire?'
        ),
    },
    'zh': {
        'authors': ['Mo Yan', 'Yu Hua', 'Can Xue'],
        'translators': ['Howard Goldblatt', 'Michael Berry', 'Annelise Finegan Wasmoen'],
        'style_note': 'Chinese literary tradition values qi yun — vital rhythm and resonance. Compress ruthlessly; every character must earn its place. Classical fairy tale register should echo the cadence of traditional storytelling.',
        'modern_reviews': (
            'MODERN LITERARY REVIEW BENCHMARKS FOR CHINESE:\n'
            '- Howard Goldblatt\'s translations of Mo Yan (Nobel 2012) are praised for capturing '
            '"hallucinatory realism." However, a Frontiers in Communication study (2023) documented '
            '"omission of narrative texts" in the English translation of Life and Death Are Wearing Me Out '
            '— a cautionary tale about content fidelity even in acclaimed translations.\n'
            '- Michael Berry\'s translations of Yu Hua (To Live, Brothers) are praised for preserving '
            'the "brutal simplicity" of Yu Hua\'s prose — short sentences, plain vocabulary, devastating impact.\n'
            '- Annelise Finegan Wasmoen\'s translation of Can Xue\'s Love in the New Millennium (2018) '
            'was praised for capturing avant-garde style without domesticating it.\n'
            '- World Literature Today\'s "A Westerner\'s Reflection on Mo Yan" noted that "the Western '
            'active appreciation of Mo Yan signals a Western openness to Chinese literature."\n'
            '- Key quality markers in modern Chinese literary reviews: Does the prose achieve qi yun '
            '(vital rhythm)? Is every character (zi) earning its place — no bloat, no filler? Does the '
            'fairy tale register echo classical Chinese storytelling cadence? Are four-character idioms '
            '(chengyu) used where appropriate to add literary weight? Does dialogue preserve the '
            'distinction between formal and colloquial registers?'
        ),
    },
}


def reconstruct_story(translations: dict, lang: str) -> str:
    """Reconstruct the full story text in reading order for a given language."""
    lang_dict = translations.get(lang, {})
    parts = []
    for key in FULL_ORDER:
        text = lang_dict.get(key, '')
        if text:
            parts.append(f"[{key}] {text}")
    return '\n\n'.join(parts)


# ---------------------------------------------------------------------------
# 3. LLM-based evaluation
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a master storyteller and literary translator with decades of experience translating fairy tales and literary fiction across world languages. You have the refined sensibility of a poet, the precision of a grammarian, and the cultural fluency of a native speaker in every language you evaluate.

You are also deeply read in modern literary criticism and translation reviews. You calibrate your standards against the best published literary translations of the 21st century. You know what Daniel Hahn (Director, British Centre for Literary Translation) means when he says: "Taking something living and fresh and transforming it into something dull and dead in another language doesn't seem like genuine faithfulness." You understand that every translation is an interpretive act AND a creative one — translators must constantly choose which elements to preserve and foreground, and which to sacrifice.

You know that the greatest risk in literary translation is the loss of ambiguity — reducing a word with multiple simultaneous meanings to one that covers only a single sense. You also know that Garcia Marquez said Gregory Rabassa's English translation of One Hundred Years of Solitude was "more accurate than the original" — because precision in translation can sometimes illuminate what the source text left implicit.

Your task is to evaluate a translation of the fairy tale "Young Cicero du Lac" — a lyrical, emotionally rich story about a young man, a magical lake, and the gifts it bestows. The story has two chapters: Chapter I follows the young man receiving the gift of special eyes; Chapter II follows a family and the Lake's promise of a daughter that arrives as a son.

The story features:
- A fairy tale register ("Once upon a time" / "Once, a young man...")
- The Lake as a character with a grandiose, warm, slightly theatrical voice
- Dialogue with distinct character voices (the Lake's formality, the young man's hesitance, the older brother's street-smart bravado, the younger brother's innocence)
- Onomatopoeia for stone-skipping sounds
- Poetic imagery around water, light, eyes, and color
- Emotional crescendo from loneliness to wonder to joy (Ch. I) and from family tension to divine intervention to twist ending (Ch. II)
- Spaced-out letters for dramatic emphasis (e.g., "L O N E L I N E S S . . .")
- The older brother in Chapter II speaks in a distinctly informal, youthful register — this MUST be preserved in translation

You evaluate with the highest standards — comparable to what would be expected in a published literary translation by a major press (Penguin, Knopf, Granta, New Directions). You are generous with praise where deserved and specific with criticism where needed. You cite the modern literary review benchmarks provided to calibrate your assessment."""


def build_evaluation_prompt(source_text: str, target_text: str, lang_code: str) -> str:
    """Build the evaluation prompt for a specific language."""
    lang_name = LANGUAGE_NAMES[lang_code]
    refs = LITERARY_REFERENCES[lang_code]

    return f"""## Translation Evaluation Task

**Source Language:** English
**Target Language:** {lang_name}
**Literary Context:** {refs['style_note']}
**Reference Authors in {lang_name}:** {', '.join(refs['authors'])}
**Reference Translators (into English, for calibration):** {', '.join(refs['translators'])}

### Modern Literary Review Benchmarks

{refs['modern_reviews']}

---

### ENGLISH SOURCE TEXT:

{source_text}

---

### {lang_name.upper()} TRANSLATION:

{target_text}

---

## Evaluation Instructions

Evaluate this translation across the following 10 dimensions. For each dimension, provide:
1. A **score from 1-10** (10 = flawless, publishable; 7-9 = good with minor issues; 4-6 = functional but needs work; 1-3 = significant problems)
2. A **brief assessment** (2-3 sentences)
3. **Specific examples** of issues found (quote the problematic text with the translation key in brackets, e.g. [cicero-p3])
4. **Suggested improvements** for any issues found (provide the improved text in the target language)

When assessing, calibrate against the modern literary review benchmarks above. Ask yourself: would this translation receive praise in a review by the LA Review of Books, World Literature Today, or Electric Literature? Would it stand alongside the acclaimed translations referenced above?

### The 10 Dimensions:

1. **Narrative Voice** — Does the fairy tale register carry through naturally? Does it open with the right storytelling cadence for this language's tradition? (Calibrate against: Le Petit Prince for French, Miyazawa for Japanese, Quiroga for Spanish, Pramoedya for Indonesian, Lispector for Portuguese, classical storytelling for Chinese/Korean)

2. **Character Voice Distinction** — Are the Lake's grandiose warmth, the young man's hesitance, the older brother's street-smart bravado (Chapter II), and the younger brother's innocence all distinctly rendered? Is the older brother's informal/slang register preserved authentically? (Calibrate against: Kawakami's Osaka dialect handling, Han Kang's register shifts, Saramago's dialogue-within-prose)

3. **Poetic Imagery** — Are the water metaphors, color descriptions, and emotional landscapes rendered with equivalent beauty and precision? Do images land with the same sensory impact? (Calibrate against: Kawabata's snow imagery, Lispector's sensory prose, Garcia Marquez's magical descriptions)

4. **Onomatopoeia & Sound Words** — Are the stone-skipping sounds (skip counts, "Swat!", "Sink!"), the Lake's exclamations ("Ha~!", "Mhm~!"), and other sound effects rendered with equivalent sonic impact in the target language? Are they culturally natural sound words?

5. **Emotional Arc & Resonance** — Does the translation preserve the emotional trajectory? The loneliness, the wonder of the Lake's appearance, the tenderness of the gift, the joy of transformation (Ch. I)? The family tension, divine promise, and twist ending (Ch. II)? (Calibrate against: Korean han, Japanese mono no aware, Spanish duende)

6. **Cultural Naturalness** — Does this read like a fairy tale that could have been originally written in {lang_name}? Or does it feel like a translation? Are idioms and expressions natural to the target culture? (The Deborah Smith test: is it beautiful AND faithful, not just one or the other?)

7. **Grammar & Syntax** — Is the grammar correct throughout? Are there any errors in verb conjugation, agreement, particle usage, case marking, or sentence structure? (Zero tolerance for grammatical errors in a published literary translation)

8. **Lexical Precision & Intentionality** — Is every word choice intentional and serving the story? Are there any words that feel generic where a more precise or poetic choice exists? Does the vocabulary match the register? (Daniel Hahn: "If the writer has used word x, we need to know why that was the word he chose of all the options")

9. **Register Consistency** — Is the formal narration distinct from casual dialogue? In Chapter II, is the contrast between the narrator's literary voice and the older brother's colloquial speech maintained? Are honorific/politeness levels appropriate? (Calibrate against: Indonesian baku/gaul contrast, Korean jondaenmal/banmal, Japanese keigo levels)

10. **Rhythm & Cadence** — Does the prose flow when read aloud? Are sentence lengths varied for effect? Does the pacing match the emotional beats of the story? (Calibrate against: PT-BR musical quality, Chinese qi yun, French clarte)

## Output Format

Respond in valid JSON with this exact structure:
```json
{{
  "language": "{lang_code}",
  "language_name": "{lang_name}",
  "overall_score": <float 1-10>,
  "overall_assessment": "<2-3 sentence summary>",
  "dimensions": [
    {{
      "name": "<dimension name>",
      "score": <int 1-10>,
      "assessment": "<2-3 sentences>",
      "issues": [
        {{
          "key": "<translation key e.g. cicero-p3>",
          "current": "<problematic text snippet>",
          "problem": "<what's wrong>",
          "suggested": "<improved text in target language>"
        }}
      ]
    }}
  ],
  "critical_issues": [
    {{
      "key": "<translation key>",
      "severity": "critical|major|minor",
      "description": "<what's wrong>",
      "current": "<current text>",
      "suggested": "<improved text>"
    }}
  ],
  "praise": ["<specific things done exceptionally well>"],
  "review_calibration": "<1-2 sentences comparing this translation's quality to the modern literary review benchmarks provided>"
}}
```

Be thorough but fair. Remember: you are evaluating against the standard of a published literary translation by a major press. Focus on what matters most for the reader's experience. Cite specific modern review benchmarks where relevant in your assessments."""


def evaluate_translation(source_text: str, target_text: str, lang_code: str, client) -> dict:
    """Send the evaluation prompt to the LLM and parse the response."""
    prompt = build_evaluation_prompt(source_text, target_text, lang_code)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model="gemini-2.5-flash",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=16000,
            )

            content = response.choices[0].message.content

            # Extract JSON from the response
            json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
            else:
                json_start = content.find('{')
                json_end = content.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = content[json_start:json_end]
                else:
                    raise ValueError("No JSON found in response")

            result = json.loads(json_str)
            return result

        except json.JSONDecodeError as e:
            print(f"  [RETRY {attempt+1}/{max_retries}] JSON parse error: {e}")
            if attempt == max_retries - 1:
                return {
                    "language": lang_code,
                    "language_name": LANGUAGE_NAMES[lang_code],
                    "overall_score": 0,
                    "overall_assessment": f"EVALUATION FAILED: Could not parse LLM response after {max_retries} attempts.",
                    "dimensions": [],
                    "critical_issues": [],
                    "praise": [],
                    "review_calibration": "N/A",
                    "raw_response": content[:2000] if 'content' in dir() else "No response"
                }
            time.sleep(2)

        except Exception as e:
            print(f"  [RETRY {attempt+1}/{max_retries}] API error: {e}")
            if attempt == max_retries - 1:
                return {
                    "language": lang_code,
                    "language_name": LANGUAGE_NAMES[lang_code],
                    "overall_score": 0,
                    "overall_assessment": f"EVALUATION FAILED: {str(e)}",
                    "dimensions": [],
                    "critical_issues": [],
                    "praise": [],
                    "review_calibration": "N/A"
                }
            time.sleep(5)


# ---------------------------------------------------------------------------
# 4. Report generation
# ---------------------------------------------------------------------------

def generate_markdown_report(results: list, timestamp: str) -> str:
    """Generate a comprehensive Markdown report from all evaluation results."""
    lines = []
    lines.append("# Weekly Translation Quality Report — Young Cicero du Lac")
    lines.append("")
    lines.append(f"**Generated:** {timestamp}")
    lines.append("")
    lines.append(f"**Evaluation Model:** gemini-2.5-flash (master storyteller persona)")
    lines.append("")
    lines.append("**Framework:** Adapted from KAIST RULER + MQM + Modern Literary Review Benchmarks")
    lines.append("")
    lines.append("**Calibration Sources:** Best Literary Translations 2024 (World Literature Today), "
                 "British Council Literary Translation Workshop, LA Review of Books, "
                 "Electric Literature, Faber, Tokyo Weekender, EST Translation Studies")
    lines.append("")

    # Summary table
    lines.append("## Executive Summary")
    lines.append("")
    lines.append("| Language | Overall Score | Critical | Major | Minor | Review Calibration |")
    lines.append("|----------|:------------:|:--------:|:-----:|:-----:|-------------------|")

    for r in sorted(results, key=lambda x: x.get('overall_score', 0), reverse=True):
        lang = r.get('language_name', r.get('language', '?'))
        score = r.get('overall_score', 0)
        criticals = sum(1 for i in r.get('critical_issues', []) if i.get('severity') == 'critical')
        majors = sum(1 for i in r.get('critical_issues', []) if i.get('severity') == 'major')
        minors = sum(1 for i in r.get('critical_issues', []) if i.get('severity') == 'minor')
        calibration = r.get('review_calibration', '')[:60]

        score_emoji = "PASS" if score >= 8 else "WARN" if score >= 6 else "FAIL"
        lines.append(f"| {lang} | {score_emoji} {score:.1f}/10 | {criticals} | {majors} | {minors} | {calibration} |")

    lines.append("")

    # Dimension comparison table
    lines.append("## Dimension Scores Across Languages")
    lines.append("")

    dim_names = []
    if results and results[0].get('dimensions'):
        dim_names = [d['name'] for d in results[0]['dimensions']]

    if dim_names:
        header = "| Dimension | " + " | ".join(r.get('language', '?').upper() for r in results) + " |"
        sep = "|-----------|" + "|".join(":---:" for _ in results) + "|"
        lines.append(header)
        lines.append(sep)

        for dim_name in dim_names:
            row = f"| {dim_name} |"
            for r in results:
                dim_score = 0
                for d in r.get('dimensions', []):
                    if d.get('name', '').lower() == dim_name.lower():
                        dim_score = d.get('score', 0)
                        break
                row += f" {dim_score}/10 |"
            lines.append(row)

        lines.append("")

    # Per-language detailed reports
    for r in results:
        lang = r.get('language_name', r.get('language', '?'))
        lang_code = r.get('language', '?')
        score = r.get('overall_score', 0)

        lines.append("---")
        lines.append(f"## {lang} ({lang_code.upper()}) — {score:.1f}/10")
        lines.append("")
        lines.append(f"> {r.get('overall_assessment', 'No assessment available.')}")
        lines.append("")

        # Review calibration
        cal = r.get('review_calibration', '')
        if cal:
            lines.append(f"**Review Calibration:** {cal}")
            lines.append("")

        # Praise
        praise = r.get('praise', [])
        if praise:
            lines.append("### Strengths")
            lines.append("")
            for p in praise:
                lines.append(f"- {p}")
            lines.append("")

        # Dimension details
        dims = r.get('dimensions', [])
        if dims:
            lines.append("### Dimension Breakdown")
            lines.append("")
            for d in dims:
                dname = d.get('name', '?')
                dscore = int(round(d.get('score', 0)))  # FIX: ensure int
                dassess = d.get('assessment', '')
                bar = "█" * dscore + "░" * (10 - dscore)
                lines.append(f"**{dname}** [{bar}] {dscore}/10")
                lines.append("")
                if dassess:
                    lines.append(f"{dassess}")
                    lines.append("")

                issues = d.get('issues', [])
                if issues:
                    for iss in issues:
                        key = iss.get('key', '?')
                        current = iss.get('current', '')
                        problem = iss.get('problem', '')
                        suggested = iss.get('suggested', '')
                        lines.append(f"- **[{key}]** {problem}")
                        if current:
                            lines.append(f"  - Current: `{current[:150]}`")
                        if suggested:
                            lines.append(f"  - Suggested: `{suggested[:150]}`")
                    lines.append("")

        # Critical issues
        critical = r.get('critical_issues', [])
        if critical:
            lines.append("### Issues Requiring Attention")
            lines.append("")
            lines.append("| Key | Severity | Description | Suggested Fix |")
            lines.append("|-----|----------|-------------|---------------|")
            for ci in critical:
                key = ci.get('key', '?')
                sev = ci.get('severity', '?')
                desc = ci.get('description', '')[:80]
                sugg = ci.get('suggested', '')[:80]
                sev_icon = "CRIT" if sev == 'critical' else "MAJOR" if sev == 'major' else "minor"
                lines.append(f"| {key} | {sev_icon} | {desc} | {sugg} |")
            lines.append("")

    # Footer
    lines.append("---")
    lines.append("")
    lines.append("*Report generated by the Weekly Translation Quality Check.*")
    lines.append("")
    lines.append("*Evaluation framework: KAIST RULER (adapted) + MQM + Modern Literary Review Benchmarks.*")
    lines.append("")
    lines.append("*Evaluator persona: Master storyteller and literary translator, calibrated against 21st-century published translation standards.*")
    lines.append("")
    lines.append("*Sources: arxiv.org/html/2412.01340v2 (KAIST RULER), britishcouncil.org (Daniel Hahn), "
                 "worldliteraturetoday.org (Best Literary Translations 2024), electricliterature.com, "
                 "lareviewofbooks.org, est-translationstudies.org*")

    return '\n'.join(lines)


def generate_json_report(results: list, timestamp: str) -> dict:
    """Generate a structured JSON report."""
    return {
        "report_type": "weekly_translation_quality",
        "story": "Young Cicero du Lac",
        "generated": timestamp,
        "model": "gemini-2.5-flash",
        "framework": "KAIST RULER + MQM + Modern Literary Review Benchmarks",
        "calibration_sources": [
            "KAIST RULER: https://arxiv.org/html/2412.01340v2",
            "British Council: https://www.britishcouncil.org/voices-magazine/what-makes-good-literary-translator",
            "Best Literary Translations 2024: https://worldliteraturetoday.org/blog/book-reviews/best-literary-translations-2024",
            "Electric Literature: https://electricliterature.com/7-boundary-pushing-indonesian-novels-in-translation/",
            "EST Translation Studies: https://est-translationstudies.org/wp-content/uploads/Unorganized/Article-on-Han-Kang.translated.pdf",
        ],
        "languages_evaluated": len(results),
        "results": results,
    }


# ---------------------------------------------------------------------------
# 5. Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Weekly Translation Quality Check")
    parser.add_argument('--i18n-path', default=None,
                        help='Path to i18n.js file')
    parser.add_argument('--output-dir', default=None,
                        help='Directory for output reports')
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    if args.i18n_path:
        i18n_path = Path(args.i18n_path)
    else:
        candidates = [
            script_dir / 'cass-la-ria-git' / 'js' / 'i18n.js',
            Path('/home/ubuntu/cass-la-ria-git/js/i18n.js'),
            script_dir / 'js' / 'i18n.js',
        ]
        i18n_path = None
        for c in candidates:
            if c.exists():
                i18n_path = c
                break
        if not i18n_path:
            print("ERROR: Could not find i18n.js. Use --i18n-path to specify.")
            sys.exit(1)

    output_dir = Path(args.output_dir) if args.output_dir else script_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"=== Weekly Translation Quality Check ===")
    print(f"Time: {timestamp}")
    print(f"Source: {i18n_path}")
    print(f"Framework: KAIST RULER + MQM + Modern Literary Review Benchmarks")
    print()

    print("Extracting translations from i18n.js...")
    translations = extract_translations(str(i18n_path))
    print(f"  Found {len(translations)} languages: {', '.join(sorted(translations.keys()))}")

    source_text = reconstruct_story(translations, 'en')
    print(f"  Source text: {len(source_text)} characters")
    print()

    from openai import OpenAI
    client = OpenAI()

    target_langs = [l for l in sorted(translations.keys()) if l != 'en']
    results = []

    for i, lang in enumerate(target_langs, 1):
        lang_name = LANGUAGE_NAMES.get(lang, lang)
        print(f"[{i}/{len(target_langs)}] Evaluating {lang_name} ({lang})...")

        target_text = reconstruct_story(translations, lang)
        if not target_text:
            print(f"  SKIP: No story text found for {lang}")
            continue

        print(f"  Target text: {len(target_text)} characters")

        result = evaluate_translation(source_text, target_text, lang, client)
        results.append(result)

        score = result.get('overall_score', 0)
        n_issues = len(result.get('critical_issues', []))
        cal = result.get('review_calibration', '')[:60]
        print(f"  Score: {score:.1f}/10 | Issues: {n_issues}")
        if cal:
            print(f"  Calibration: {cal}")
        print()

        if i < len(target_langs):
            time.sleep(2)

    print("Generating reports...")

    md_report = generate_markdown_report(results, timestamp)
    md_path = output_dir / f"translation_quality_report_{datetime.now().strftime('%Y%m%d')}.md"
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md_report)
    print(f"  Markdown report: {md_path}")

    json_data = generate_json_report(results, timestamp)
    json_path = output_dir / f"translation_quality_report_{datetime.now().strftime('%Y%m%d')}.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    print(f"  JSON report: {json_path}")

    print()
    print("=== SUMMARY ===")
    print()
    for r in sorted(results, key=lambda x: x.get('overall_score', 0), reverse=True):
        lang = r.get('language_name', '?')
        score = r.get('overall_score', 0)
        n_crit = sum(1 for i in r.get('critical_issues', []) if i.get('severity') == 'critical')
        n_major = sum(1 for i in r.get('critical_issues', []) if i.get('severity') == 'major')
        icon = "PASS" if score >= 8 else "WARN" if score >= 6 else "FAIL"
        print(f"  {icon} {lang:30s} {score:.1f}/10  (critical: {n_crit}, major: {n_major})")

    print()
    print(f"Reports saved to: {output_dir}")
    print("=== Done ===")

    min_score = min((r.get('overall_score', 0) for r in results), default=0)
    any_critical = any(
        i.get('severity') == 'critical'
        for r in results
        for i in r.get('critical_issues', [])
    )
    if any_critical or min_score < 5:
        sys.exit(1)  # FAIL
    elif min_score < 7:
        sys.exit(2)  # WARN
    else:
        sys.exit(0)  # PASS


if __name__ == '__main__':
    main()
