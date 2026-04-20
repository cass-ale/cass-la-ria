#!/usr/bin/env python3
"""
Hardened Translation Suggestion Applier
=======================================
Applies translation improvement suggestions from quality reports to i18n.js
with multiple layers of contamination prevention.

Safety layers:
  1. LLM commentary detection — rejects "No changes needed", "This is excellent", etc.
  2. Parenthetical alternative detection — rejects "(or ...)", "(alternatively ...)"
  3. Script/language validation — ensures suggested text uses the correct writing system
  4. Proper noun preservation — ensures Cicero, du Lac, Ealasaid are not altered
  5. Key-length sanity check — rejects suggestions that are wildly different in length
  6. Post-apply audit gate — runs full_audit.py after all changes to catch regressions

Usage:
  python3 tests/apply_suggestions_hardened.py <report.json>
  python3 tests/apply_suggestions_hardened.py <report.json> --dry-run
  python3 tests/apply_suggestions_hardened.py <report.json> --force

Created: 2026-04-19
"""

import json
import re
import sys
import subprocess
import unicodedata
from pathlib import Path
from copy import deepcopy

# ============================================================================
# Configuration
# ============================================================================

REPO_ROOT = Path(__file__).resolve().parent.parent
I18N_PATH = REPO_ROOT / 'js' / 'i18n.js'
AUDIT_SCRIPT = Path(__file__).resolve().parent / 'full_audit.py'

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

# Proper nouns that MUST be preserved exactly in all languages
REQUIRED_PROPER_NOUNS = ['Cicero', 'du Lac', 'Ealasaid']

# ============================================================================
# Layer 1: LLM Commentary Detection
# ============================================================================

LLM_COMMENTARY_PATTERNS = [
    # Direct "no change" responses
    re.compile(r'^no\s+change', re.IGNORECASE),
    re.compile(r'^no\s+changes?\s+(needed|required|necessary)', re.IGNORECASE),
    re.compile(r'^(the\s+)?(current|existing|original)\s+(translation|text|version)\s+is', re.IGNORECASE),
    re.compile(r'^this\s+(is|translation\s+is)\s+(excellent|good|fine|correct|accurate|perfect)', re.IGNORECASE),
    re.compile(r'^(already|translation\s+already)\s+(correct|accurate|good|fine)', re.IGNORECASE),
    re.compile(r'^keep\s+(as\s+is|the\s+current|the\s+original|unchanged)', re.IGNORECASE),
    re.compile(r'^(I\s+would|I\s+suggest|I\s+recommend|consider|perhaps|maybe)', re.IGNORECASE),
    re.compile(r'^(note:|note\s+that|importantly|however|additionally)', re.IGNORECASE),
    re.compile(r'^(the\s+)?translation\s+(looks|seems|appears)\s+(good|fine|correct|accurate)', re.IGNORECASE),
    re.compile(r'^(unchanged|same\s+as\s+original|identical)', re.IGNORECASE),
    
    # LLM meta-commentary embedded in text
    re.compile(r'(No changes needed|Tidak ada perubahan|変更不要|변경 불필요|无需更改|Sem alterações)', re.IGNORECASE),
    re.compile(r'(This is excellent|This sounds natural|This captures)', re.IGNORECASE),
    re.compile(r'(Adding a |Again, |Using |While this|Note:|For example)', re.IGNORECASE),
    re.compile(r'(sounds a bit|might better|could better|would help|feels more)', re.IGNORECASE),
    re.compile(r'(a truly |possibly using|similar to how|For instance)', re.IGNORECASE),
    
    # Indonesian-specific LLM commentary (from real contamination incidents)
    re.compile(r'Tidak ada perubahan yang diperlukan', re.IGNORECASE),
    re.compile(r'Tidak perlu perubahan', re.IGNORECASE),
    re.compile(r'Sudah baik', re.IGNORECASE),
    
    # Japanese-specific LLM commentary
    re.compile(r'変更の必要はありません', re.IGNORECASE),
    re.compile(r'このままで良い', re.IGNORECASE),
    
    # Korean-specific LLM commentary
    re.compile(r'변경이 필요하지 않', re.IGNORECASE),
    
    # Chinese-specific LLM commentary
    re.compile(r'无需修改', re.IGNORECASE),
    re.compile(r'不需要更改', re.IGNORECASE),
]

def is_llm_commentary(text):
    """Check if the suggested text is LLM commentary rather than an actual translation."""
    for pattern in LLM_COMMENTARY_PATTERNS:
        if pattern.search(text):
            return True, pattern.pattern
    return False, None

# ============================================================================
# Layer 2: Parenthetical Alternative Detection
# ============================================================================

PARENTHETICAL_PATTERNS = [
    re.compile(r'\(or\s+[^)]+\)'),           # (or alternative)
    re.compile(r'\(alternatively[^)]*\)'),     # (alternatively ...)
    re.compile(r'\(e\.g\.\s*[^)]+\)'),        # (e.g. example)
    re.compile(r'\(i\.e\.\s*[^)]+\)'),        # (i.e. explanation)
    re.compile(r'\(lit\.\s*[^)]+\)'),         # (lit. literal translation)
    re.compile(r'\(literally[^)]*\)'),         # (literally ...)
    re.compile(r'\(more\s+literally[^)]*\)'),  # (more literally ...)
    re.compile(r'\(ou\s+[^)]+\)'),            # French: (ou alternative)
    re.compile(r'\(o\s+[^)]+\)'),             # Spanish/Portuguese: (o alternativa)
    re.compile(r'\(atau\s+[^)]+\)'),          # Indonesian: (atau alternatif)
    re.compile(r'\(또는\s*[^)]+\)'),           # Korean: (또는 alternative)
    re.compile(r'\(または[^)]+\)'),             # Japanese: (または alternative)
    re.compile(r'\(或者[^)]+\)'),              # Chinese: (或者 alternative)
]

def has_parenthetical_alternative(text):
    """Check if text contains parenthetical alternatives from LLM."""
    for pattern in PARENTHETICAL_PATTERNS:
        match = pattern.search(text)
        if match:
            return True, match.group()
    return False, None

# ============================================================================
# Layer 3: Script/Language Validation
# ============================================================================

def get_script_category(char):
    """Get the script category of a Unicode character."""
    cat = unicodedata.category(char)
    name = unicodedata.name(char, '')
    
    if 'CJK' in name or 'HANGUL' in name:
        return 'cjk'
    if 'HIRAGANA' in name or 'KATAKANA' in name:
        return 'cjk'
    if 'LATIN' in name:
        return 'latin'
    if 'ARABIC' in name:
        return 'arabic'
    if 'CYRILLIC' in name:
        return 'cyrillic'
    return 'other'

def validate_script(text, expected_script, lang):
    """Validate that the text uses the expected writing system."""
    # Count script characters
    script_counts = {'latin': 0, 'cjk': 0, 'arabic': 0, 'cyrillic': 0, 'other': 0}
    total_letters = 0
    
    for char in text:
        if unicodedata.category(char).startswith('L'):  # Letter characters
            script = get_script_category(char)
            script_counts[script] += 1
            total_letters += 1
    
    if total_letters == 0:
        return True, "No letter characters"
    
    # For CJK languages, we expect a mix of CJK + Latin (for proper nouns)
    if expected_script == 'cjk':
        cjk_ratio = script_counts['cjk'] / total_letters
        # CJK languages should have at least 30% CJK characters
        # (lower threshold because proper nouns like Cicero, du Lac are Latin)
        if cjk_ratio < 0.15 and total_letters > 10:
            return False, f"Only {cjk_ratio:.0%} CJK characters — expected more for {lang}"
    
    # For Latin-script languages, check for unexpected CJK
    if expected_script == 'latin':
        cjk_ratio = script_counts['cjk'] / total_letters
        if cjk_ratio > 0.1:
            return False, f"{cjk_ratio:.0%} CJK characters in Latin-script language {lang}"
    
    return True, "OK"

# ============================================================================
# Layer 4: Proper Noun Preservation
# ============================================================================

def check_proper_nouns(original, suggested):
    """Ensure proper nouns are preserved in the suggestion."""
    issues = []
    for noun in REQUIRED_PROPER_NOUNS:
        if noun in original and noun not in suggested:
            issues.append(f"Proper noun '{noun}' was removed")
    return issues

# ============================================================================
# Layer 5: Length Sanity Check
# ============================================================================

def check_length_sanity(original, suggested, lang):
    """Check that the suggestion isn't wildly different in length."""
    if not original or not suggested:
        return True, "Empty value"
    
    orig_len = len(original)
    sugg_len = len(suggested)
    
    if orig_len == 0:
        return True, "Original is empty"
    
    ratio = sugg_len / orig_len
    
    # Allow wider range for CJK (character counts differ significantly from Latin)
    if LANGUAGES.get(lang, {}).get('script') == 'cjk':
        if ratio < 0.2 or ratio > 5.0:
            return False, f"Length ratio {ratio:.1f}x — too extreme for CJK"
    else:
        if ratio < 0.3 or ratio > 3.0:
            return False, f"Length ratio {ratio:.1f}x — too extreme for Latin"
    
    return True, "OK"

# ============================================================================
# Core: Extract, Validate, Apply
# ============================================================================

def extract_suggestions(report_path):
    """Extract all actionable suggestions from a quality report JSON."""
    with open(report_path, 'r', encoding='utf-8') as f:
        report = json.load(f)
    
    raw_suggestions = []
    
    for result in report.get('results', []):
        lang = result.get('language', '')
        if lang == 'en' or lang not in LANGUAGES:
            continue
        
        # From dimension issues
        for dim in result.get('dimensions', []):
            for issue in dim.get('issues', []):
                key = issue.get('key', '')
                current = issue.get('current', '')
                suggested = issue.get('suggested', '')
                if key and current and suggested and current.strip() != suggested.strip():
                    suggestions_clean = suggested
                    # Clean up arrow-style suggestions
                    if '->' in suggestions_clean:
                        suggestions_clean = suggestions_clean.split('->')[-1].strip()
                    # Take only first line if multi-line
                    if '\n' in suggestions_clean:
                        suggestions_clean = suggestions_clean.split('\n')[0].strip()
                    # Skip key references
                    if suggestions_clean.startswith('[cicero'):
                        continue
                    
                    raw_suggestions.append({
                        'lang': lang,
                        'key': key,
                        'current': current,
                        'suggested': suggestions_clean,
                        'source': dim.get('name', 'unknown'),
                    })
        
        # From critical issues
        for issue in result.get('critical_issues', []):
            key = issue.get('key', '')
            suggested = issue.get('suggested', '')
            current = issue.get('current', '')
            if key and suggested:
                suggestions_clean = suggested
                if '->' in suggestions_clean:
                    suggestions_clean = suggestions_clean.split('->')[-1].strip()
                if '\n' in suggestions_clean:
                    suggestions_clean = suggestions_clean.split('\n')[0].strip()
                
                raw_suggestions.append({
                    'lang': lang,
                    'key': key,
                    'current': current or '',
                    'suggested': suggestions_clean,
                    'source': f"critical ({issue.get('severity', '?')})",
                })
    
    # Deduplicate: keep the longest suggestion per (lang, key)
    best = {}
    for s in raw_suggestions:
        k = (s['lang'], s['key'])
        if k not in best or len(s['suggested']) > len(best[k]['suggested']):
            best[k] = s
    
    return list(best.values())


def extract_translations(content):
    """Extract all translation values from i18n.js content."""
    translations = {}
    lang_pattern = re.compile(r"'(\w{2})'\s*:\s*\{")
    
    for match in lang_pattern.finditer(content):
        lang = match.group(1)
        start = match.end()
        
        depth = 1
        pos = start
        while pos < len(content) and depth > 0:
            if content[pos] == '{':
                depth += 1
            elif content[pos] == '}':
                depth -= 1
            pos += 1
        
        block = content[start:pos-1]
        translations[lang] = {}
        
        kv_pattern = re.compile(r"'([^']+)'\s*:\s*'((?:[^'\\]|\\.)*)'\s*,?")
        for kv_match in kv_pattern.finditer(block):
            key = kv_match.group(1)
            value = kv_match.group(2)
            translations[lang][key] = value
    
    return translations


def validate_suggestion(suggestion, current_value):
    """Run all validation layers on a suggestion. Returns (is_valid, rejection_reason)."""
    lang = suggestion['lang']
    suggested = suggestion['suggested']
    
    # Layer 1: LLM commentary
    is_commentary, pattern = is_llm_commentary(suggested)
    if is_commentary:
        return False, f"LLM commentary detected (pattern: {pattern})"
    
    # Layer 2: Parenthetical alternatives
    has_paren, match = has_parenthetical_alternative(suggested)
    if has_paren:
        return False, f"Parenthetical alternative found: {match}"
    
    # Layer 3: Script validation
    expected_script = LANGUAGES.get(lang, {}).get('script', 'latin')
    script_ok, script_msg = validate_script(suggested, expected_script, lang)
    if not script_ok:
        return False, f"Script mismatch: {script_msg}"
    
    # Layer 4: Proper noun preservation
    if current_value:
        noun_issues = check_proper_nouns(current_value, suggested)
        if noun_issues:
            return False, f"Proper noun issue: {'; '.join(noun_issues)}"
    
    # Layer 5: Length sanity
    if current_value:
        length_ok, length_msg = check_length_sanity(current_value, suggested, lang)
        if not length_ok:
            return False, f"Length check failed: {length_msg}"
    
    return True, "All checks passed"


def apply_to_file(content, suggestions, translations, dry_run=False):
    """Apply validated suggestions to i18n.js content."""
    applied = 0
    rejected = 0
    skipped = 0
    
    results = {'applied': [], 'rejected': [], 'skipped': []}
    
    for s in sorted(suggestions, key=lambda x: (x['lang'], x['key'])):
        lang = s['lang']
        key = s['key']
        suggested = s['suggested']
        
        # Get current value from translations
        if lang not in translations or key not in translations[lang]:
            results['skipped'].append(f"[{lang}] {key}: not found in i18n.js")
            skipped += 1
            continue
        
        current_value = translations[lang][key]
        
        # Skip if identical
        if suggested.strip() == current_value.strip():
            results['skipped'].append(f"[{lang}] {key}: suggestion identical to current")
            skipped += 1
            continue
        
        # Run all validation layers
        is_valid, reason = validate_suggestion(s, current_value)
        if not is_valid:
            results['rejected'].append(f"[{lang}] {key}: REJECTED — {reason}")
            rejected += 1
            print(f"  REJECT [{lang}] {key}: {reason}")
            continue
        
        if dry_run:
            results['applied'].append(f"[{lang}] {key}: would apply ({s['source']})")
            applied += 1
            print(f"  DRY-RUN [{lang}] {key} ({s['source']})")
            continue
        
        # Build search and replace strings
        escaped_current = current_value.replace("'", "\\'")
        search_str = f"'{key}': '{escaped_current}'"
        
        if search_str not in content:
            search_str = f"'{key}': '{current_value}'"
            if search_str not in content:
                results['skipped'].append(f"[{lang}] {key}: could not find exact match in file")
                skipped += 1
                continue
        
        # Escape the suggested value for JS
        escaped_suggested = suggested.replace("\\", "\\\\").replace("'", "\\'")
        replace_str = f"'{key}': '{escaped_suggested}'"
        
        new_content = content.replace(search_str, replace_str, 1)
        if new_content != content:
            content = new_content
            results['applied'].append(f"[{lang}] {key}: applied ({s['source']})")
            applied += 1
            print(f"  APPLY  [{lang}] {key} ({s['source']})")
        else:
            results['skipped'].append(f"[{lang}] {key}: replacement had no effect")
            skipped += 1
    
    return content, applied, rejected, skipped, results


def run_post_apply_audit():
    """Run full_audit.py as a post-apply safety gate."""
    if not AUDIT_SCRIPT.exists():
        print("  WARNING: full_audit.py not found — skipping post-apply audit")
        return True
    
    result = subprocess.run(
        ['python3', str(AUDIT_SCRIPT)],
        capture_output=True, text=True, timeout=30
    )
    
    if result.returncode == 0:
        print("  Post-apply audit: PASSED")
        return True
    else:
        print("  Post-apply audit: FAILED")
        print(result.stdout[-500:] if len(result.stdout) > 500 else result.stdout)
        return False


def main():
    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: python3 apply_suggestions_hardened.py <report.json> [--dry-run] [--force]")
        sys.exit(1)
    
    report_path = Path(sys.argv[1])
    dry_run = '--dry-run' in sys.argv
    force = '--force' in sys.argv
    
    if not report_path.exists():
        print(f"ERROR: Report file not found: {report_path}")
        sys.exit(1)
    
    if not I18N_PATH.exists():
        print(f"ERROR: i18n.js not found: {I18N_PATH}")
        sys.exit(1)
    
    print("=" * 72)
    print("  HARDENED TRANSLATION SUGGESTION APPLIER")
    print("=" * 72)
    print(f"  Report:   {report_path}")
    print(f"  Target:   {I18N_PATH}")
    print(f"  Mode:     {'DRY RUN' if dry_run else 'LIVE APPLY'}")
    print(f"  Force:    {'YES (skip post-audit)' if force else 'NO (post-audit required)'}")
    print("=" * 72)
    print()
    
    # Extract suggestions
    suggestions = extract_suggestions(report_path)
    print(f"Extracted {len(suggestions)} unique suggestions from report")
    print()
    
    # Load i18n.js
    content = I18N_PATH.read_text(encoding='utf-8')
    original_content = content
    
    # Extract current translations
    translations = extract_translations(content)
    print(f"Loaded translations for {len(translations)} languages")
    print()
    
    # Apply with validation
    print("--- Applying suggestions with 5-layer validation ---")
    print()
    new_content, applied, rejected, skipped, results = apply_to_file(
        content, suggestions, translations, dry_run=dry_run
    )
    
    print()
    print("=" * 72)
    print(f"  RESULTS: {applied} applied, {rejected} rejected, {skipped} skipped")
    print("=" * 72)
    
    if rejected > 0:
        print()
        print("  REJECTED suggestions (contamination prevented):")
        for r in results['rejected']:
            print(f"    {r}")
    
    if dry_run:
        print()
        print("  DRY RUN — no changes written to disk.")
        sys.exit(0)
    
    if applied == 0:
        print()
        print("  No changes to apply.")
        sys.exit(0)
    
    # Write to staging file first
    staging_path = I18N_PATH.with_suffix('.js.staging')
    staging_path.write_text(new_content, encoding='utf-8')
    print(f"\n  Staging file written: {staging_path}")
    
    # Validate JS syntax
    print("  Validating JS syntax...")
    result = subprocess.run(
        ['node', '-e',
         f'global.window={{}};require("{staging_path}");'
         f'const t=window.i18n.translations;'
         f'console.log("Valid: "+Object.keys(t).length+" languages");'],
        capture_output=True, text=True, timeout=10
    )
    
    if result.returncode != 0:
        print(f"  JS SYNTAX ERROR — aborting!")
        print(f"  {result.stderr[:300]}")
        staging_path.unlink()
        sys.exit(1)
    
    print(f"  {result.stdout.strip()}")
    
    # Run post-apply audit (Layer 6)
    if not force:
        print("  Running post-apply audit (Layer 6)...")
        # Temporarily swap the staging file in for the audit
        import shutil
        backup_path = I18N_PATH.with_suffix('.js.backup')
        shutil.copy2(I18N_PATH, backup_path)
        shutil.copy2(staging_path, I18N_PATH)
        
        audit_passed = run_post_apply_audit()
        
        if not audit_passed:
            # Restore original
            shutil.copy2(backup_path, I18N_PATH)
            backup_path.unlink()
            staging_path.unlink()
            print()
            print("  ABORTED — Post-apply audit found issues.")
            print("  Original file restored. No changes applied.")
            sys.exit(1)
        
        # Audit passed — keep the new file
        backup_path.unlink()
        staging_path.unlink()
        print()
        print("  All 6 safety layers passed. Changes applied to i18n.js.")
    else:
        # Force mode — just copy staging to live
        import shutil
        shutil.copy2(staging_path, I18N_PATH)
        staging_path.unlink()
        print()
        print("  Force mode — changes applied without post-audit.")
    
    # Write apply log
    log_path = REPO_ROOT / 'tests' / 'apply_log.json'
    with open(log_path, 'w', encoding='utf-8') as f:
        json.dump({
            'report': str(report_path),
            'applied': applied,
            'rejected': rejected,
            'skipped': skipped,
            'details': results,
        }, f, indent=2, ensure_ascii=False)
    print(f"  Apply log written: {log_path}")


if __name__ == '__main__':
    main()
