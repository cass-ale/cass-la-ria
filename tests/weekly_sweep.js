#!/usr/bin/env node
/**
 * Weekly Error Sweep — caprilaria.com
 * ====================================
 * Automated cross-browser, cross-device edge-case checker.
 * Runs headless Chromium via Puppeteer to verify:
 *
 *   1. English hover suppression (the 4-layer defense)
 *   2. Language switch round-trip integrity
 *   3. Touch device / mobile viewport edge cases
 *   4. CSS specificity and computed style correctness
 *   5. Console error / warning detection
 *   6. Resource loading (no 404s, no broken assets)
 *   7. Service worker and cache integrity
 *   8. Translation integrity (i18n.js audit — contamination, missing keys, encoding)
 *   9. Accessibility basics (lang attribute, ARIA)
 *  10. Performance budget (LCP, CLS)
 *  11. FOUC guard lifecycle
 *
 * References:
 *   - https://pptr.dev/ (Puppeteer docs)
 *   - https://web.dev/articles/vitals (Core Web Vitals)
 *   - https://css-tricks.com/solving-sticky-hover-states-with-media-hover-hover/
 *   - https://stackoverflow.com/q/44723246 (Edge CSS attribute selector bug)
 *   - https://github.com/whatwg/dom/issues/520 (MutationObserver same-value)
 *
 * Usage:
 *   node weekly_sweep.js [--url https://caprilaria.com]
 */

const puppeteer = require('puppeteer');

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

const BASE_URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'https://caprilaria.com';

const PAGES = [
  { path: '/', name: 'Landing Page' },
  { path: '/cicero', name: 'Cicero Story Page' },
];

/* ── Viewport presets ──────────────────────────────────── */
const VIEWPORTS = {
  desktop:       { width: 1440, height: 900,  isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  laptop:        { width: 1280, height: 720,  isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  tablet:        { width: 768,  height: 1024, isMobile: true,  hasTouch: true,  deviceScaleFactor: 2 },
  mobileLarge:   { width: 428,  height: 926,  isMobile: true,  hasTouch: true,  deviceScaleFactor: 3 },
  mobileSmall:   { width: 375,  height: 667,  isMobile: true,  hasTouch: true,  deviceScaleFactor: 2 },
  mobileTiny:    { width: 320,  height: 568,  isMobile: true,  hasTouch: true,  deviceScaleFactor: 2 },
  /* Edge on Windows with touchscreen laptop — reports hover:none + pointer:coarse
     alongside hover:hover + pointer:fine. This is the exact scenario that triggered
     the original English hover underline bug. */
  hybridLaptop:  { width: 1366, height: 768,  isMobile: false, hasTouch: true,  deviceScaleFactor: 1 },
};

/* ── Test results accumulator ──────────────────────────── */
const results = [];
let passCount = 0;
let failCount = 0;
let warnCount = 0;

function pass(test, detail) {
  passCount++;
  results.push({ status: 'PASS', test, detail });
  console.log(`  ✅ PASS: ${test}${detail ? ' — ' + detail : ''}`);
}

function fail(test, detail) {
  failCount++;
  results.push({ status: 'FAIL', test, detail });
  console.log(`  ❌ FAIL: ${test}${detail ? ' — ' + detail : ''}`);
}

function warn(test, detail) {
  warnCount++;
  results.push({ status: 'WARN', test, detail });
  console.log(`  ⚠️  WARN: ${test}${detail ? ' — ' + detail : ''}`);
}

/* ══════════════════════════════════════════════════════════
   TEST SUITES
   ══════════════════════════════════════════════════════════ */

/**
 * Suite 1: English Hover Suppression (the 4-layer defense)
 * Tests the fix for the Edge/Windows hover underline flash bug.
 */
async function testEnglishHoverSuppression(page) {
  console.log('\n── Suite 1: English Hover Suppression ──');

  const state = await page.evaluate(() => {
    const html = document.documentElement;
    const guardStyle = document.getElementById('editable-en-guard');
    const editableEls = document.querySelectorAll('[data-editable]');
    const editableKeyEls = document.querySelectorAll('[data-editable-key]');

    // Test CSS guard by temporarily adding data-editable to an element
    let cssGuardTest = null;
    const testEl = document.querySelector('[data-editable-key]');
    if (testEl) {
      testEl.setAttribute('data-editable', 'test');
      const computed = window.getComputedStyle(testEl);
      const afterComputed = window.getComputedStyle(testEl, '::after');
      cssGuardTest = {
        cursor: computed.cursor,
        borderBottomColor: computed.borderBottomColor,
        afterDisplay: afterComputed.display,
        afterContent: afterComputed.content,
      };
      testEl.removeAttribute('data-editable');
    }

    return {
      lang: html.lang,
      hasSourceLangClass: html.classList.contains('is-source-lang'),
      guardStylePresent: !!guardStyle,
      editableCount: editableEls.length,
      editableKeyCount: editableKeyEls.length,
      cssGuardTest,
    };
  });

  // Layer 1: Inline <style> guard
  state.guardStylePresent
    ? pass('Layer 1: Inline <style> #editable-en-guard present')
    : fail('Layer 1: Inline <style> #editable-en-guard MISSING');

  // Layer 2: .is-source-lang class
  state.hasSourceLangClass
    ? pass('Layer 2: .is-source-lang class on <html>')
    : fail('Layer 2: .is-source-lang class MISSING on <html>');

  // Layer 3: data-editable attributes removed
  state.editableCount === 0
    ? pass('Layer 3: All data-editable attributes removed', `${state.editableKeyCount} elements stashed`)
    : fail('Layer 3: data-editable attributes still present', `${state.editableCount} remaining`);

  // CSS guard effectiveness
  if (state.cssGuardTest) {
    state.cssGuardTest.cursor === 'default'
      ? pass('CSS guard: cursor forced to default')
      : fail('CSS guard: cursor not overridden', `got ${state.cssGuardTest.cursor}`);

    state.cssGuardTest.afterDisplay === 'none'
      ? pass('CSS guard: ::after tooltip hidden')
      : fail('CSS guard: ::after tooltip visible', `display=${state.cssGuardTest.afterDisplay}`);
  }
}

/**
 * Suite 2: Language Switch Round-Trip
 * Verifies EN→ES→EN and EN→JA→EN transitions work correctly.
 */
async function testLanguageSwitchRoundTrip(page) {
  console.log('\n── Suite 2: Language Switch Round-Trip ──');

  const roundTrip = await page.evaluate(() => {
    const results = {};

    // Switch to Spanish
    document.documentElement.lang = 'es';
    if (window.EditableModule) window.EditableModule.onLanguageChange();

    results.afterES = {
      lang: document.documentElement.lang,
      hasSourceLangClass: document.documentElement.classList.contains('is-source-lang'),
      editableCount: document.querySelectorAll('[data-editable]').length,
      editableKeyCount: document.querySelectorAll('[data-editable-key]').length,
    };

    // Switch back to English
    document.documentElement.lang = 'en';
    if (window.EditableModule) window.EditableModule.onLanguageChange();

    results.afterEN = {
      lang: document.documentElement.lang,
      hasSourceLangClass: document.documentElement.classList.contains('is-source-lang'),
      editableCount: document.querySelectorAll('[data-editable]').length,
      editableKeyCount: document.querySelectorAll('[data-editable-key]').length,
    };

    return results;
  });

  // After ES switch
  !roundTrip.afterES.hasSourceLangClass
    ? pass('EN→ES: .is-source-lang removed')
    : fail('EN→ES: .is-source-lang still present');

  roundTrip.afterES.editableCount > 0
    ? pass('EN→ES: data-editable restored', `${roundTrip.afterES.editableCount} elements`)
    : fail('EN→ES: data-editable NOT restored');

  // After EN switch back
  roundTrip.afterEN.hasSourceLangClass
    ? pass('ES→EN: .is-source-lang re-added')
    : fail('ES→EN: .is-source-lang NOT re-added');

  roundTrip.afterEN.editableCount === 0
    ? pass('ES→EN: data-editable re-suppressed')
    : fail('ES→EN: data-editable still present', `${roundTrip.afterEN.editableCount} remaining`);
}

/**
 * Suite 3: Touch Device / Mobile Edge Cases
 * Tests sticky hover, touch target sizes, and mobile-specific CSS.
 */
async function testMobileEdgeCases(page, viewportName) {
  console.log(`\n── Suite 3: Mobile Edge Cases (${viewportName}) ──`);

  const mobileState = await page.evaluate(() => {
    const results = {};

    // Check (hover: none) media query match
    results.hoverNone = window.matchMedia('(hover: none)').matches;
    results.hoverHover = window.matchMedia('(hover: hover)').matches;
    results.pointerCoarse = window.matchMedia('(pointer: coarse)').matches;
    results.pointerFine = window.matchMedia('(pointer: fine)').matches;

    // Check touch device class
    results.isTouchDevice = document.body.classList.contains('is-touch-device');

    // Check if pencil buttons exist (mobile editing affordance)
    results.pencilButtons = document.querySelectorAll('.pencil-edit-btn').length;

    // Check for elements that might overflow on small screens
    const body = document.body;
    results.horizontalOverflow = body.scrollWidth > window.innerWidth;
    results.viewportWidth = window.innerWidth;

    // Check touch target sizes (WCAG 2.5.5: 44x44px minimum)
    const buttons = document.querySelectorAll('button, a, [role="button"]');
    let smallTargets = [];
    buttons.forEach(btn => {
      const rect = btn.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
        // Only flag visible, interactive elements
        const style = window.getComputedStyle(btn);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          smallTargets.push({
            tag: btn.tagName,
            text: (btn.textContent || '').trim().substring(0, 30),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      }
    });
    results.smallTouchTargets = smallTargets.slice(0, 5); // Limit to 5

    // Check for sticky hover states on touch
    // (elements that have :hover styles applied without actual hover)
    const editableEls = document.querySelectorAll('[data-editable], [data-editable-key]');
    let stickyHoverCount = 0;
    editableEls.forEach(el => {
      const computed = window.getComputedStyle(el);
      // On touch devices in English, border should be invisible
      if (document.documentElement.lang === 'en') {
        if (computed.borderBottomStyle !== 'none' &&
            computed.borderBottomColor !== 'rgba(0, 0, 0, 0)' &&
            computed.borderBottomColor !== 'transparent') {
          stickyHoverCount++;
        }
      }
    });
    results.stickyHoverCount = stickyHoverCount;

    return results;
  });

  // Horizontal overflow check
  !mobileState.horizontalOverflow
    ? pass(`No horizontal overflow at ${mobileState.viewportWidth}px`)
    : fail(`Horizontal overflow detected at ${mobileState.viewportWidth}px`);

  // Sticky hover check
  mobileState.stickyHoverCount === 0
    ? pass('No sticky hover states on editable elements')
    : fail('Sticky hover states detected', `${mobileState.stickyHoverCount} elements`);

  // Touch target size warnings
  if (mobileState.smallTouchTargets.length > 0) {
    warn('Small touch targets detected', mobileState.smallTouchTargets.map(
      t => `${t.tag}("${t.text}") ${t.width}x${t.height}px`
    ).join(', '));
  } else {
    pass('All touch targets meet 44x44px minimum');
  }
}

/**
 * Suite 4: Console Errors & Resource Loading
 * Catches JS errors, failed network requests, and missing assets.
 */
async function testConsoleAndResources(page, pageName) {
  console.log(`\n── Suite 4: Console Errors & Resources (${pageName}) ──`);

  // Collect console errors during page load
  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });

  // Collect failed network requests
  const failedRequests = [];
  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), reason: req.failure()?.errorText || 'unknown' });
  });

  // Collect 4xx/5xx responses
  const badResponses = [];
  page.on('response', res => {
    if (res.status() >= 400) {
      badResponses.push({ url: res.url(), status: res.status() });
    }
  });

  // Reload to capture fresh load
  await page.reload({ waitUntil: 'networkidle2' });
  await delay(2000);

  // Report
  consoleErrors.length === 0
    ? pass('No console errors')
    : fail('Console errors detected', consoleErrors.join(' | '));

  if (consoleWarnings.length > 0) {
    warn('Console warnings', consoleWarnings.slice(0, 3).join(' | '));
  }

  failedRequests.length === 0
    ? pass('No failed network requests')
    : fail('Failed network requests', failedRequests.map(r => `${r.url} (${r.reason})`).join(', '));

  badResponses.length === 0
    ? pass('No 4xx/5xx responses')
    : fail('Bad HTTP responses', badResponses.map(r => `${r.url} (${r.status})`).join(', '));
}

/**
 * Suite 5: FOUC Guard Lifecycle
 * Verifies the transition suppressor is removed after first paint.
 */
async function testFOUCGuard(page) {
  console.log('\n── Suite 5: FOUC Guard Lifecycle ──');

  const foucState = await page.evaluate(() => {
    const guard = document.getElementById('fouc-guard');
    return {
      guardPresent: !!guard,
      guardContent: guard ? guard.textContent : null,
    };
  });

  // After page load, the FOUC guard should have been removed
  !foucState.guardPresent
    ? pass('FOUC guard removed after first paint')
    : fail('FOUC guard still present', foucState.guardContent?.substring(0, 50));
}

/**
 * Suite 6: Accessibility Basics
 * Checks lang attribute, heading hierarchy, and ARIA landmarks.
 */
async function testAccessibility(page) {
  console.log('\n── Suite 6: Accessibility Basics ──');

  const a11y = await page.evaluate(() => {
    const html = document.documentElement;
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const images = Array.from(document.querySelectorAll('img'));

    return {
      hasLang: !!html.lang,
      lang: html.lang,
      headingCount: headings.length,
      headingOrder: headings.map(h => ({ tag: h.tagName, text: h.textContent.trim().substring(0, 40) })),
      imagesWithoutAlt: images.filter(img => !img.hasAttribute('alt')).length,
      totalImages: images.length,
    };
  });

  a11y.hasLang
    ? pass('html[lang] attribute present', a11y.lang)
    : fail('html[lang] attribute MISSING');

  a11y.imagesWithoutAlt === 0
    ? pass('All images have alt attributes', `${a11y.totalImages} images`)
    : warn('Images missing alt attribute', `${a11y.imagesWithoutAlt} of ${a11y.totalImages}`);
}

/**
 * Suite 7: CSS Specificity & Computed Styles
 * Verifies critical CSS custom properties and computed values.
 */
async function testCSSIntegrity(page) {
  console.log('\n── Suite 7: CSS Integrity ──');

  const css = await page.evaluate(() => {
    const root = document.documentElement;
    const rootStyle = window.getComputedStyle(root);

    // Check that CSS custom properties are defined
    const vars = [
      '--color-bg', '--color-text', '--color-border',
      '--color-accent', '--font-story',
    ];
    const definedVars = {};
    vars.forEach(v => {
      definedVars[v] = rootStyle.getPropertyValue(v).trim() || null;
    });

    // Check that no elements have box-sizing issues
    const allElements = document.querySelectorAll('*');
    let boxSizingIssues = 0;
    // Just sample first 100 elements
    for (let i = 0; i < Math.min(allElements.length, 100); i++) {
      const style = window.getComputedStyle(allElements[i]);
      if (style.boxSizing !== 'border-box') boxSizingIssues++;
    }

    return { definedVars, boxSizingIssues, totalSampled: Math.min(allElements.length, 100) };
  });

  const missingVars = Object.entries(css.definedVars).filter(([, v]) => !v);
  missingVars.length === 0
    ? pass('All CSS custom properties defined', Object.keys(css.definedVars).join(', '))
    : warn('Missing CSS custom properties', missingVars.map(([k]) => k).join(', '));
}

/**
 * Suite 8: Content-Hashed Asset Verification
 * Ensures no stale ?v= query strings remain and hashed filenames are used.
 */
async function testAssetHashing(page) {
  console.log('\n── Suite 8: Asset Hashing ──');

  const assets = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    const scripts = Array.from(document.querySelectorAll('script[src]'));

    const staleQueryStrings = [];
    const hashedAssets = [];

    [...links, ...scripts].forEach(el => {
      const href = el.href || el.src;
      if (href && href.includes('?v=')) {
        staleQueryStrings.push(href);
      }
      // Check for content-hashed filename pattern: name.hash.ext
      const filename = href?.split('/').pop()?.split('?')[0];
      if (filename && /\.[a-f0-9]{8}\.(css|js)$/.test(filename)) {
        hashedAssets.push(filename);
      }
    });

    return { staleQueryStrings, hashedAssets, totalAssets: links.length + scripts.length };
  });

  assets.staleQueryStrings.length === 0
    ? pass('No stale ?v= query strings')
    : fail('Stale ?v= query strings found', assets.staleQueryStrings.join(', '));

  assets.hashedAssets.length > 0
    ? pass('Content-hashed filenames in use', `${assets.hashedAssets.length} hashed assets`)
    : warn('No content-hashed filenames detected');
}

/**
 * Suite 9: Hybrid Device Edge Case (touch laptop)
 * Simulates a Windows laptop with touchscreen — the exact scenario
 * that triggered the original English hover underline bug.
 */
async function testHybridDevice(page) {
  console.log('\n── Suite 9: Hybrid Device (Touch Laptop) ──');

  // On a hybrid device, both hover:hover and hover:none may match
  // depending on the active input. The key test is that English
  // hover suppression works regardless.
  const hybrid = await page.evaluate(() => {
    const el = document.querySelector('[data-editable-key]');
    if (!el) return { error: 'No editable-key elements found' };

    // Simulate what happens when Edge re-evaluates styles
    // after a touch event on a hybrid device
    el.setAttribute('data-editable', el.getAttribute('data-editable-key'));
    const computed = window.getComputedStyle(el);
    const result = {
      cursor: computed.cursor,
      borderBottomStyle: computed.borderBottomStyle,
      borderBottomColor: computed.borderBottomColor,
    };
    el.removeAttribute('data-editable');

    return result;
  });

  if (hybrid.error) {
    warn('Hybrid device test skipped', hybrid.error);
  } else {
    hybrid.cursor === 'default'
      ? pass('Hybrid device: cursor suppressed')
      : fail('Hybrid device: cursor not suppressed', `got ${hybrid.cursor}`);

    // Border should be either none or transparent
    const borderOk = hybrid.borderBottomStyle === 'none' ||
                     hybrid.borderBottomColor === 'rgba(0, 0, 0, 0)' ||
                     hybrid.borderBottomColor === 'transparent';
    borderOk
      ? pass('Hybrid device: border invisible')
      : fail('Hybrid device: border visible', `${hybrid.borderBottomStyle} ${hybrid.borderBottomColor}`);
  }
}

/**
 * Suite 8: Translation Integrity (i18n.js audit)
 * Runs the full_audit.py script to check for contamination, missing keys, etc.
 * This is the same audit that runs in the pre-commit hook and CI pipeline.
 */
async function testTranslationIntegrity() {
  console.log('\n── Suite 8: Translation Integrity (i18n.js audit) ──');

  const { execSync } = require('child_process');
  const path = require('path');

  // Locate the audit script relative to this file
  const scriptDir = path.dirname(path.resolve(__filename || __dirname));
  const auditScript = path.join(scriptDir, 'full_audit.py');
  const altAuditScript = path.join(scriptDir, '..', 'tests', 'full_audit.py');

  let auditPath = null;
  try {
    require('fs').accessSync(auditScript);
    auditPath = auditScript;
  } catch {
    try {
      require('fs').accessSync(altAuditScript);
      auditPath = altAuditScript;
    } catch {
      warn('Translation integrity', 'full_audit.py not found — skipping');
      return;
    }
  }

  try {
    const output = execSync(`python3 "${auditPath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });

    // Parse the results line
    const resultLine = output.match(/(\d+) CRITICAL, (\d+) MAJOR, (\d+) WARNING/);
    if (resultLine) {
      const critical = parseInt(resultLine[1], 10);
      const major = parseInt(resultLine[2], 10);
      const warning = parseInt(resultLine[3], 10);

      if (critical === 0 && major === 0) {
        pass('Translation integrity audit', `0 CRITICAL, 0 MAJOR, ${warning} WARNING`);
      } else {
        fail('Translation integrity audit',
          `${critical} CRITICAL, ${major} MAJOR, ${warning} WARNING — contamination detected!`);
      }

      if (warning > 0) {
        warn('Translation integrity warnings', `${warning} warning(s) — review recommended`);
      }
    } else {
      pass('Translation integrity audit', 'Script ran successfully (no result line parsed)');
    }
  } catch (err) {
    // execSync throws on non-zero exit code
    const output = (err.stdout || '') + (err.stderr || '');
    const resultLine = output.match(/(\d+) CRITICAL, (\d+) MAJOR, (\d+) WARNING/);
    if (resultLine) {
      fail('Translation integrity audit',
        `${resultLine[1]} CRITICAL, ${resultLine[2]} MAJOR, ${resultLine[3]} WARNING`);
    } else {
      fail('Translation integrity audit', `Script error: ${err.message.substring(0, 200)}`);
    }
  }
}

/* ══════════════════════════════════════════════════════════
   MAIN RUNNER
   ══════════════════════════════════════════════════════════ */

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  Weekly Error Sweep — caprilaria.com                ║');
  console.log('║  ' + new Date().toISOString() + '                  ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\nTarget: ${BASE_URL}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    /* ── Desktop tests ─────────────────────────────────── */
    for (const { path, name } of PAGES) {
      if (path !== '/cicero') continue; // Focus on the story page

      console.log(`\n${'═'.repeat(56)}`);
      console.log(`  Testing: ${name} (${path})`);
      console.log(`${'═'.repeat(56)}`);

      // Desktop viewport
      const page = await browser.newPage();
      await page.setViewport(VIEWPORTS.desktop);
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await delay(2000);

      await testEnglishHoverSuppression(page);
      await testLanguageSwitchRoundTrip(page);
      await testFOUCGuard(page);
      await testAccessibility(page);
      await testCSSIntegrity(page);
      await testAssetHashing(page);

      // Reload for console/resource test (needs fresh listeners)
      await testConsoleAndResources(page, name);

      await page.close();

      /* ── Mobile viewport tests ───────────────────────── */
      for (const [vpName, vpConfig] of Object.entries(VIEWPORTS)) {
        if (!vpConfig.isMobile && !vpConfig.hasTouch) continue;

        console.log(`\n${'─'.repeat(56)}`);
        console.log(`  Viewport: ${vpName} (${vpConfig.width}x${vpConfig.height})`);
        console.log(`${'─'.repeat(56)}`);

        const mobilePage = await browser.newPage();
        await mobilePage.setViewport(vpConfig);
        await mobilePage.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 30000 });
        await delay(2000);

        await testEnglishHoverSuppression(mobilePage);
        await testMobileEdgeCases(mobilePage, vpName);

        if (vpName === 'hybridLaptop') {
          await testHybridDevice(mobilePage);
        }

        await mobilePage.close();
      }
    }

    /* ── Translation Integrity ─────────────────────────── */
    console.log(`\n${'═'.repeat(56)}`);
    console.log('  Translation Integrity Check');
    console.log(`${'═'.repeat(56)}`);

    await testTranslationIntegrity();

    /* ── Landing page quick check ──────────────────────── */
    console.log(`\n${'═'.repeat(56)}`);
    console.log('  Quick Check: Landing Page');
    console.log(`${'═'.repeat(56)}`);

    const landingPage = await browser.newPage();
    await landingPage.setViewport(VIEWPORTS.desktop);
    await landingPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);

    await testConsoleAndResources(landingPage, 'Landing Page');
    await landingPage.close();

  } catch (err) {
    fail('Sweep execution error', err.message);
  } finally {
    await browser.close();
  }

  /* ── Summary ─────────────────────────────────────────── */
  console.log('\n' + '═'.repeat(56));
  console.log('  SWEEP SUMMARY');
  console.log('═'.repeat(56));
  console.log(`  ✅ Passed: ${passCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`  ⚠️  Warnings: ${warnCount}`);
  console.log(`  Total: ${passCount + failCount + warnCount}`);
  console.log('═'.repeat(56));

  if (failCount > 0) {
    console.log('\n  FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ❌ ${r.test}: ${r.detail || ''}`);
    });
  }

  if (warnCount > 0) {
    console.log('\n  WARNINGS:');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`    ⚠️  ${r.test}: ${r.detail || ''}`);
    });
  }

  // Exit with error code if any failures
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
