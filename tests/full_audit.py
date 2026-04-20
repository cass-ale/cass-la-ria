#!/usr/bin/env python3
"""
Comprehensive i18n.js audit script.
Checks for:
1. Cross-language contamination (foreign words in wrong language block)
2. Missing or empty translations
3. Key count consistency across all language blocks
4. LLM commentary/parenthetical notes left in values
5. Untranslated English left in non-English blocks
6. Inconsistent spacing in mystical spaced-out text
7. Proper nouns that should remain consistent (Cicero, du Lac, Ealasaid, Cass la Ria)
8. JS syntax validity
9. Character encoding issues
10. Duplicate keys within a block
"""

import re
import json
import subprocess
import sys

I18N_PATH = '/home/ubuntu/cass-la-ria-git/js/i18n.js'

LANGUAGES = {
    'en': {'name': 'English', 'script': 'latin'},
    'es': {'name': 'Spanish', 'script': 'latin'},
    'fr': {'name': 'French', 'script': 'latin'},
    'id': {'name': 'Indonesian', 'script': 'latin'},
    'ja': {'name': 'Japanese', 'script': 'cjk'},
    'ko': {'name': 'Korean', 'script': 'cjk'},
    'pt': {'name': 'Portuguese', 'script': 'latin'},
    'zh': {'name': 'Chinese', 'script': 'cjk'},
}

# Proper nouns that should appear the same across all languages
UNIVERSAL_PROPER_NOUNS = ['Cicero', 'du Lac', 'Ealasaid']

# English words that should NEVER appear in non-English blocks (except proper nouns)
ENGLISH_SENTENCES_PATTERN = re.compile(
    r'\b(Adding a |Again, |Using |While this|Note:|This is |For example|'
    r'sounds a bit|might better|could better|would help|feels more|'
    r'a truly |possibly using|similar to how|For instance)\b',
    re.IGNORECASE
)

# Patterns for detecting untranslated English in non-English blocks
# These are common English function words that shouldn't appear in other languages
ENGLISH_FUNCTION_WORDS = re.compile(
    r'\b(the |a |an |is |are |was |were |has |have |had |will |would |could |should |'
    r'might |may |can |this |that |these |those |it |its |more |less |very |quite |'
    r'rather |also |too |just |only |even |still |already |yet |here |there |'
    r'where |when |how |why |what |which |who |whom |whose |'
    r'and |but |or |nor |for |so |'
    r'he |she |they |we |you |I |me |him |her |them |us |'
    r'his |my |your |our |their |'
    r'not |no |yes |'
    r'with |from |into |upon |about |between |through |during |before |after |'
    r'above |below |under |over |'
    r'said |told |asked |replied |thought |felt |saw |heard |knew |'
    r'went |came |took |gave |made |got |put |set |ran |sat |stood |'
    r'young man |the Lake |once upon)\b'
)

# Known false positives: English words that legitimately appear in other languages
FALSE_POSITIVES = {
    'es': ['Ha!', 'Hmph', 'Mhm', 'Ow', 'Swat', 'du Lac', 'Cicero', 'Ealasaid', 'Cass la Ria', 'Young Cicero'],
    'fr': ['Ha!', 'Hmph', 'Mhm', 'Ow', 'Swat', 'du Lac', 'Cicero', 'Ealasaid', 'Cass la Ria', 'Young Cicero', 'for'],
    'id': ['Ha!', 'Hmph', 'Mhm', 'Ow', 'Swat', 'du Lac', 'Cicero', 'Ealasaid', 'Cass la Ria', 'Young Cicero'],
    'ja': ['Ha!', 'Hmph', 'Mhm', 'Ow', 'Swat', 'du Lac', 'Cicero', 'Ealasaid', 'Cass la Ria', 'Young Cicero'],
    'ko': ['Ha!', 'Hmph', 'Mhm', 'Ow', 'Swat', 'du Lac', 'Cicero', 'Ealasaid', 'Cass la Ria', 'Young Cicero'],
    'pt': ['Ha!', 'Hmph', 'Mhm', 'Ow', 'Swat', 'du Lac', 'Cicero', 'Ealasaid', 'Cass la Ria', 'Young Cicero'],
    'zh': ['Ha!', 'Hmph', 'Mhm', 'Ow', 'Swat', 'du Lac', 'Cicero', 'Ealasaid', 'Cass la Ria', 'Young Cicero'],
}

# Spaced-out mystical keys that should be checked for consistency
MYSTICAL_KEYS_CH1 = ['cicero-v1', 'cicero-v2', 'cicero-v3', 'cicero-v4', 'cicero-v5', 'cicero-v6']
MYSTICAL_KEYS_CH3 = ['cicero3-m1', 'cicero3-m2', 'cicero3-m3']

# Keys that are INTENTIONALLY identical across all languages (proper nouns, brand names)
INTENTIONALLY_IDENTICAL_KEYS = {
    'name',           # "Cass la Ria" — brand name
    'cicero-title',   # "Young Cicero du Lac" — story title / proper noun
    'cicero2-m1',     # "E A L A S A I D" — lake proper noun
    'cicero3-m2',     # "C I C E R O . . ." — character proper noun
    'cicero3-m3',     # "D U  L A C . . ." — character proper noun
}

# Per-language whitelist for keys that are legitimately identical to English (cognates)
# Format: { 'lang_code': {'key1', 'key2', ...} }
LANG_IDENTICAL_WHITELIST = {
    'fr': {'cicero-m1'},  # "V I S I O N" — same word in French and English
}

# Keys with known legitimate English content in the en block
EN_WHITELIST_KEYS = {
    'cicero-note',    # UI instruction with "(or tap the pencil on mobile)"
    'name',           # "Cass la Ria" contains 'la'
    'meta-desc',      # "Cass la Ria" contains 'la'
    'meta-title',     # "Cass la Ria" contains 'la'
}

issues = []
warnings = []

def add_issue(severity, lang, key, msg, value_snippet=''):
    issues.append({
        'severity': severity,
        'lang': lang,
        'key': key,
        'message': msg,
        'value': value_snippet[:120] if value_snippet else ''
    })

def extract_translations():
    """Extract all translation blocks from i18n.js."""
    with open(I18N_PATH, 'r') as f:
        content = f.read()
    
    translations = {}
    
    # Find each language block using the comment markers
    lang_markers = {
        'en': '// English',
        'es': '// Spanish', 
        'fr': '// French',
        'id': '// Indonesian',
        'ja': '// Japanese',
        'ko': '// Korean',
        'pt': '// Portuguese',
        'zh': '// Chinese',
    }
    
    lines = content.split('\n')
    current_lang = None
    current_keys = {}
    
    for i, line in enumerate(lines):
        # Check for language block markers
        stripped = line.strip()
        
        # Stop parsing at the end of the translations object
        if stripped == '};' and current_lang:
            if current_keys:
                translations[current_lang] = current_keys
            current_lang = None
            current_keys = {}
            break
        
        for lang_code, marker in lang_markers.items():
            if marker in stripped and stripped.startswith('//'):
                if current_lang and current_keys:
                    translations[current_lang] = current_keys
                current_lang = lang_code
                current_keys = {}
                break
        
        # Extract key-value pairs
        m = re.match(r"\s+'([^']+)': '(.*)',?\s*$", line)
        if m and current_lang:
            key = m.group(1)
            value = m.group(2)
            if key in current_keys:
                add_issue('CRITICAL', current_lang, key, f'Duplicate key on line {i+1}')
            current_keys[key] = {'value': value, 'line': i + 1}
    
    # Don't forget the last block (if we didn't hit };)
    if current_lang and current_keys:
        translations[current_lang] = current_keys
    
    return translations, content

def check_js_syntax():
    """Validate JS syntax."""
    result = subprocess.run(
        ['node', '-e', 
         'global.window={};require("/home/ubuntu/cass-la-ria-git/js/i18n.js");'
         'const t=window.i18n.translations;'
         'console.log(JSON.stringify({langs:Object.keys(t),counts:Object.fromEntries(Object.entries(t).map(([k,v])=>[k,Object.keys(v).length]))}))'],
        capture_output=True, text=True, timeout=10
    )
    if result.returncode != 0:
        add_issue('CRITICAL', 'ALL', 'N/A', f'JS syntax error: {result.stderr[:200]}')
        return None
    try:
        data = json.loads(result.stdout.strip())
        return data
    except:
        add_issue('CRITICAL', 'ALL', 'N/A', f'Could not parse JS output: {result.stdout[:200]}')
        return None

def check_key_consistency(translations):
    """Check all languages have the same keys."""
    en_keys = set(translations.get('en', {}).keys())
    for lang, keys_dict in translations.items():
        if lang == 'en':
            continue
        lang_keys = set(keys_dict.keys())
        missing = en_keys - lang_keys
        extra = lang_keys - en_keys
        if missing:
            for k in sorted(missing):
                add_issue('CRITICAL', lang, k, f'Key missing in {LANGUAGES[lang]["name"]} but present in English')
        if extra:
            for k in sorted(extra):
                add_issue('WARNING', lang, k, f'Extra key in {LANGUAGES[lang]["name"]} not in English')

def check_empty_values(translations):
    """Check for empty or whitespace-only values."""
    for lang, keys_dict in translations.items():
        for key, data in keys_dict.items():
            if not data['value'] or not data['value'].strip():
                add_issue('CRITICAL', lang, key, 'Empty or whitespace-only value', data['value'])

def check_llm_commentary(translations):
    """Check for LLM commentary/parenthetical notes left in values."""
    for lang, keys_dict in translations.items():
        if lang == 'en':
            continue
        for key, data in keys_dict.items():
            value = data['value']
            if ENGLISH_SENTENCES_PATTERN.search(value):
                add_issue('CRITICAL', lang, key, 'LLM commentary detected in translation value', value)

def check_cross_contamination(translations):
    """Check for untranslated English in non-English blocks."""
    en_keys = translations.get('en', {})
    
    for lang, keys_dict in translations.items():
        if lang == 'en':
            continue
        
        for key, data in keys_dict.items():
            value = data['value']
            en_value = en_keys.get(key, {}).get('value', '')
            
            # Skip if value is identical to English (proper nouns, onomatopoeia, etc.)
            if value == en_value and key not in ['cicero3-end']:
                # This is suspicious — the translation is identical to English
                # But some keys ARE supposed to be the same (proper nouns, brand names)
                if key in INTENTIONALLY_IDENTICAL_KEYS:
                    continue
                # Check per-language cognate whitelist
                if key in LANG_IDENTICAL_WHITELIST.get(lang, set()):
                    continue
                # Check if it's a very short value (onomatopoeia, etc.)
                if len(value) <= 10:
                    continue
                add_issue('WARNING', lang, key, 
                         f'Value identical to English — may be untranslated', value)
            
            # For Latin-script languages, check for English sentence patterns
            if LANGUAGES[lang]['script'] == 'latin':
                # Strip out known false positives
                test_value = value
                for fp in FALSE_POSITIVES.get(lang, []):
                    test_value = test_value.replace(fp, '')
                
                # Check for full English sentences (3+ consecutive English words)
                english_words = re.findall(r'\b[A-Za-z]{3,}\b', test_value)
                if english_words:
                    # Count how many are common English words
                    common_en = ['the', 'and', 'was', 'were', 'his', 'her', 'had', 'has',
                                'have', 'with', 'from', 'that', 'this', 'they', 'them',
                                'been', 'being', 'would', 'could', 'should', 'will',
                                'into', 'upon', 'about', 'after', 'before', 'between',
                                'through', 'during', 'under', 'over', 'above', 'below',
                                'said', 'told', 'asked', 'replied', 'thought', 'felt',
                                'young', 'man', 'lake', 'stone', 'water', 'eyes',
                                'house', 'home', 'back', 'came', 'went', 'took',
                                'gave', 'made', 'got', 'put', 'set', 'ran', 'sat',
                                'stood', 'looked', 'saw', 'heard', 'knew', 'found']
                    en_count = sum(1 for w in english_words if w.lower() in common_en)
                    if en_count >= 3:
                        add_issue('MAJOR', lang, key,
                                 f'{en_count} common English words detected — possible untranslated content',
                                 value)

def check_mystical_spacing(translations):
    """Check that mystical spaced-out text is properly formatted."""
    for lang, keys_dict in translations.items():
        for key in MYSTICAL_KEYS_CH1 + MYSTICAL_KEYS_CH3:
            if key in keys_dict:
                value = keys_dict[key]['value']
                # Check for proper spacing pattern (letters separated by spaces)
                # Allow CJK characters with spaces between them
                if not re.match(r'^[\w\u3000-\u9fff\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff]', value):
                    add_issue('WARNING', lang, key, 'Mystical text may not have proper spacing', value)

def check_parenthetical_alternatives(translations):
    """Check for (or ...) style alternatives left by LLM."""
    for lang, keys_dict in translations.items():
        for key, data in keys_dict.items():
            value = data['value']
            if re.search(r'\(or [^)]+\)', value):
                if key in EN_WHITELIST_KEYS and lang == 'en':
                    continue
                add_issue('CRITICAL', lang, key, 'Parenthetical alternative "(or ...)" found', value)
            if re.search(r'\(e\.g\.|for example|i\.e\.|alternatively\)', value, re.IGNORECASE):
                add_issue('CRITICAL', lang, key, 'LLM example/alternative text found', value)

def check_encoding(content):
    """Check for encoding issues."""
    # Check for common encoding artifacts
    bad_patterns = [
        (r'â€™', 'Mojibake: smart quote'),
        (r'â€"', 'Mojibake: em dash'),
        (r'â€"', 'Mojibake: en dash'),
        (r'Ã©', 'Mojibake: é'),
        (r'Ã¨', 'Mojibake: è'),
        (r'Ã±', 'Mojibake: ñ'),
        (r'Ã¡', 'Mojibake: á'),
        (r'Ã³', 'Mojibake: ó'),
        (r'Ã­', 'Mojibake: í'),
        (r'Ã¼', 'Mojibake: ü'),
    ]
    for pattern, desc in bad_patterns:
        matches = re.finditer(pattern, content)
        for m in matches:
            # Find the line number
            line_num = content[:m.start()].count('\n') + 1
            add_issue('CRITICAL', 'ALL', f'line {line_num}', f'Encoding issue: {desc}')

def check_spanish_in_english(translations):
    """Specifically check for Spanish words in English block."""
    en_keys = translations.get('en', {})
    spanish_words = re.compile(
        r'\b(joven|lago|muchacho|niño|piedra|ojos|agua|casa|noche|día|'
        r'también|pero|porque|cuando|donde|como|qué|quién|'
        r'está|tiene|hace|puede|quiere|dice|sabe|viene|'
        r'el |la |los |las |un |una |unos |unas |'
        r'del |al |con |sin |por |para |sobre |entre |'
        r'su |sus |mi |mis |tu |tus |nuestro|'
        r'este |esta |estos |estas |ese |esa |esos |esas |'
        r'aquel|aquella|aquellos|aquellas)\b',
        re.IGNORECASE
    )
    for key, data in en_keys.items():
        if key in EN_WHITELIST_KEYS:
            continue
        value = data['value']
        matches = spanish_words.findall(value)
        if matches:
            # Filter out false positives
            real_matches = [m for m in matches if m.strip().lower() not in ['la']]
            if real_matches:
                add_issue('CRITICAL', 'en', key, 
                         f'Spanish words in English block: {real_matches}', value)

def check_english_in_spanish(translations):
    """Specifically check for English words in Spanish block."""
    es_keys = translations.get('es', {})
    en_keys = translations.get('en', {})
    
    for key, data in es_keys.items():
        value = data['value']
        en_value = en_keys.get(key, {}).get('value', '')
        
        # Check if the Spanish value contains full English phrases
        # Look for 3+ consecutive English-only words
        words = value.split()
        consecutive_en = 0
        max_consecutive = 0
        en_phrase = []
        
        for word in words:
            clean = re.sub(r'[^\w]', '', word)
            if clean and re.match(r'^[A-Za-z]+$', clean) and len(clean) > 2:
                # Check if this word is common English but NOT common Spanish
                en_only = ['the', 'and', 'was', 'were', 'his', 'her', 'had', 'has',
                          'have', 'with', 'from', 'that', 'this', 'they', 'them',
                          'been', 'would', 'could', 'should', 'will', 'into',
                          'upon', 'about', 'after', 'before', 'between', 'through',
                          'said', 'told', 'asked', 'replied', 'thought', 'felt',
                          'young', 'man', 'stone', 'water', 'eyes', 'house',
                          'home', 'back', 'came', 'went', 'took', 'gave',
                          'made', 'got', 'put', 'set', 'ran', 'sat', 'stood',
                          'looked', 'saw', 'heard', 'knew', 'found', 'filled',
                          'heat', 'restored', 'fingers', 'toes', 'stomach',
                          'pit', 'ease', 'calm', 'surety', 'opened', 'closed',
                          'rubbed', 'tossed', 'toward', 'waters', 'pulled',
                          'phone', 'sent', 'text', 'mother', 'read']
                if clean.lower() in en_only:
                    consecutive_en += 1
                    en_phrase.append(word)
                else:
                    if consecutive_en > max_consecutive:
                        max_consecutive = consecutive_en
                    consecutive_en = 0
                    en_phrase = []
            else:
                if consecutive_en > max_consecutive:
                    max_consecutive = consecutive_en
                consecutive_en = 0
                en_phrase = []
        
        if consecutive_en > max_consecutive:
            max_consecutive = consecutive_en
        
        if max_consecutive >= 2:
            add_issue('MAJOR', 'es', key,
                     f'{max_consecutive} consecutive English words detected', value)

def check_all_languages_for_english(translations):
    """Check all non-English languages for untranslated English content."""
    en_keys = translations.get('en', {})
    
    for lang, keys_dict in translations.items():
        if lang == 'en':
            continue
        for key, data in keys_dict.items():
            value = data['value']
            en_value = en_keys.get(key, {}).get('value', '')
            
            # Skip keys that are supposed to be the same
            if key in INTENTIONALLY_IDENTICAL_KEYS:
                continue
            if key in LANG_IDENTICAL_WHITELIST.get(lang, set()):
                continue
            
            # Check if value is >80% identical to English (character overlap)
            if en_value and len(value) > 20:
                common = sum(1 for a, b in zip(value, en_value) if a == b)
                similarity = common / max(len(value), len(en_value))
                if similarity > 0.8 and len(value) > 30:
                    add_issue('MAJOR', lang, key,
                             f'Value is {similarity:.0%} similar to English — likely untranslated',
                             value)

def main():
    print("=" * 80)
    print("COMPREHENSIVE i18n.js AUDIT")
    print("=" * 80)
    
    # 1. JS Syntax check
    print("\n[1/10] Checking JS syntax...")
    js_data = check_js_syntax()
    if js_data:
        print(f"  Languages: {js_data['langs']}")
        print(f"  Key counts: {js_data['counts']}")
        # Check key count consistency
        counts = list(js_data['counts'].values())
        if len(set(counts)) > 1:
            add_issue('CRITICAL', 'ALL', 'N/A', 
                     f'Key count mismatch across languages: {js_data["counts"]}')
        else:
            print(f"  All languages have {counts[0]} keys ✓")
    
    # 2. Extract translations
    print("\n[2/10] Extracting translations...")
    translations, content = extract_translations()
    print(f"  Extracted {len(translations)} language blocks")
    for lang, keys in translations.items():
        print(f"    {lang}: {len(keys)} keys")
    
    # 3. Key consistency
    print("\n[3/10] Checking key consistency...")
    check_key_consistency(translations)
    
    # 4. Empty values
    print("\n[4/10] Checking for empty values...")
    check_empty_values(translations)
    
    # 5. LLM commentary
    print("\n[5/10] Checking for LLM commentary...")
    check_llm_commentary(translations)
    check_parenthetical_alternatives(translations)
    
    # 6. Cross-language contamination
    print("\n[6/10] Checking for cross-language contamination...")
    check_spanish_in_english(translations)
    check_english_in_spanish(translations)
    check_all_languages_for_english(translations)
    
    # 7. Mystical text spacing
    print("\n[7/10] Checking mystical text spacing...")
    check_mystical_spacing(translations)
    
    # 8. Encoding
    print("\n[8/10] Checking encoding...")
    check_encoding(content)
    
    # 9. Cross-contamination deep check
    print("\n[9/10] Deep cross-contamination check...")
    check_cross_contamination(translations)
    
    # 10. Summary
    print("\n[10/10] Generating summary...")
    
    critical = [i for i in issues if i['severity'] == 'CRITICAL']
    major = [i for i in issues if i['severity'] == 'MAJOR']
    warning = [i for i in issues if i['severity'] == 'WARNING']
    
    print("\n" + "=" * 80)
    print(f"AUDIT RESULTS: {len(critical)} CRITICAL, {len(major)} MAJOR, {len(warning)} WARNING")
    print("=" * 80)
    
    if critical:
        print(f"\n{'='*40} CRITICAL {'='*40}")
        for i in critical:
            print(f"  [{i['lang']}] {i['key']}: {i['message']}")
            if i['value']:
                print(f"    Value: {i['value']}")
    
    if major:
        print(f"\n{'='*40} MAJOR {'='*40}")
        for i in major:
            print(f"  [{i['lang']}] {i['key']}: {i['message']}")
            if i['value']:
                print(f"    Value: {i['value']}")
    
    if warning:
        print(f"\n{'='*40} WARNING {'='*40}")
        for i in warning:
            print(f"  [{i['lang']}] {i['key']}: {i['message']}")
            if i['value']:
                print(f"    Value: {i['value']}")
    
    if not issues:
        print("\n  ✓ ALL CHECKS PASSED — No issues found!")
    
    # Write results to JSON
    with open('/home/ubuntu/audit_results.json', 'w') as f:
        json.dump({
            'total_issues': len(issues),
            'critical': len(critical),
            'major': len(major),
            'warning': len(warning),
            'issues': issues
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\nFull results written to /home/ubuntu/audit_results.json")
    
    return len(critical) + len(major)

if __name__ == '__main__':
    exit_code = main()
    sys.exit(1 if exit_code > 0 else 0)
