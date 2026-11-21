#!/usr/bin/env node
/**
 * mobile.mjs — `npm run test:mobile` (ticket M0, docs/mobile-spec.md §8)
 *
 * Opens the built site (out/, served like Vercel) in Chrome at three phone
 * sizes, first-visit state, and FAILS on:
 *   - sideways scroll (document wider than the screen)
 *   - visible buttons / links / inputs smaller than 44×44 CSS px
 *     (links inside running text are exempt, as WCAG 2.5.8 allows)
 *   - visible text under 12px
 *   - any image wider than 1000px loaded on a 375px screen
 *   - console errors or uncaught exceptions
 * Full-page screenshots go to tests/screenshots/<page>-<width>.png, plus one
 * desktop shot at 1440×900 per page for comparison.
 *
 * Uses playwright-core with the Chrome already installed on the machine
 * (no browser download). Set CHROME_PATH to use a different binary.
 * Build first: `npm run preflight` (or stage-output) fills out/.
 *
 *   npm run test:mobile                 all pages, all sizes
 *   npm run test:mobile -- --only=/     one page
 *   npm run test:mobile -- --report     list every offender, not just counts
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './serve.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SHOTS = join(ROOT, 'tests', 'screenshots');
const PORT = 4179;
const BASE = `http://localhost:${PORT}`;
const args = process.argv.slice(2);
const only = args.find(a => a.startsWith('--only='))?.slice(7);
const report = args.includes('--report');

const PAGES = ['/', '/entry/mcqueen-ss99', '/entry/coperni-ss23', '/glossary', '/about']
  .filter(p => !only || p === only);
const PHONES = [
  { width: 320, height: 640 },
  { width: 375, height: 812 },
  { width: 430, height: 932 },
];
const PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
// Requests the static test server can't answer (serverless API routes).
const IGNORE_CONSOLE = [/\/api\//, /Failed to load resource.*404/];

/** Runs inside the page: collects layout problems. */
function inspectPage(maxImageWidth) {
  const vw = innerWidth;
  const visible = (el) => {
    if (el.closest('[inert],[aria-hidden="true"],.sr-only,[hidden]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    if (r.right <= 0 || r.left >= vw) return false; // off-canvas (closed drawers)
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    }
    return true;
  };
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const txt = (el.getAttribute('aria-label') || el.textContent || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls} "${txt}"`;
  };
  const inRunningText = (el) => {
    if (el.tagName !== 'A') return false;
    const parent = el.parentElement;
    return !!parent && /^(P|LI|DD|TD|FIGCAPTION|BLOCKQUOTE|SPAN)$/.test(parent.tagName)
      && parent.textContent.trim().length > el.textContent.trim().length + 10;
  };

  const sideways = document.documentElement.scrollWidth > vw + 1;

  // The tappable area is the element's box plus any absolutely positioned
  // ::before/::after that sticks out of it (a common way to give a small
  // visual a 44px touch area), so measure that, not just the box.
  const hitArea = (el) => {
    const r = el.getBoundingClientRect();
    let { top, right, bottom, left } = r;
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle(el, pseudo);
      if (cs.content === 'none' || cs.position !== 'absolute' || cs.pointerEvents === 'none') continue;
      const px = (v) => (v.endsWith('px') ? parseFloat(v) : 0);
      top = Math.min(top, r.top + px(cs.top));
      left = Math.min(left, r.left + px(cs.left));
      bottom = Math.max(bottom, r.bottom - px(cs.bottom));
      right = Math.max(right, r.right - px(cs.right));
    }
    return { width: right - left, height: bottom - top };
  };
  const smallTargets = [];
  for (const el of document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=link]')) {
    if (!visible(el) || inRunningText(el)) continue;
    if (el.getBoundingClientRect().bottom <= 0) continue; // parked above the page (skip links until focused)
    const a = hitArea(el);
    if (a.width < 44 - 0.5 || a.height < 44 - 0.5) smallTargets.push(`${describe(el)} ${Math.round(a.width)}×${Math.round(a.height)}`);
  }

  const smallText = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n; (n = walker.nextNode());) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (!visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 12 - 0.01) smallText.push(`${describe(el)} ${size}px`);
  }

  const bigImages = [...document.images]
    .filter(img => img.complete && img.naturalWidth > maxImageWidth)
    .map(img => `${img.currentSrc.split('/').pop()} ${img.naturalWidth}px`);

  return { sideways, scrollWidth: document.documentElement.scrollWidth, smallTargets, smallText, bigImages };
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  const server = await startServer(PORT);
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  const results = [];
  try {
    for (const path of PAGES) {
      const name = path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-');
      for (const vp of PHONES) {
        const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: PHONE_UA });
        const page = await ctx.newPage();
        const errors = [];
        page.on('console', m => { if (m.type() === 'error' && !IGNORE_CONSOLE.some(re => re.test(m.text()))) errors.push(m.text().slice(0, 160)); });
        page.on('pageerror', e => errors.push(`uncaught: ${String(e.message || e).slice(0, 160)}`));
        await page.goto(BASE + path, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500); // let fades and view transitions settle
        const found = await page.evaluate(inspectPage, vp.width === 375 ? 1000 : Infinity);
        await page.screenshot({ path: join(SHOTS, `${name}-${vp.width}.png`), fullPage: true });
        results.push({ page: path, width: vp.width, ...found, errors });
        await ctx.close();
      }
      const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const dp = await desk.newPage();
      await dp.goto(BASE + path, { waitUntil: 'networkidle' });
      await dp.waitForTimeout(1200);
      await dp.screenshot({ path: join(SHOTS, `${name}-1440.png`) });
      await desk.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  let failures = 0;
  console.log('\npage                         width  sideways  targets<44  text<12  images>1000  errors');
  for (const r of results) {
    const bad = (r.sideways ? 1 : 0) + r.smallTargets.length + r.smallText.length + r.bigImages.length + r.errors.length;
    failures += bad;
    console.log(`${r.page.padEnd(28)} ${String(r.width).padStart(5)}  ${(r.sideways ? `YES ${r.scrollWidth}px` : 'no').padEnd(8)}  ${String(r.smallTargets.length).padStart(10)}  ${String(r.smallText.length).padStart(7)}  ${String(r.bigImages.length).padStart(11)}  ${String(r.errors.length).padStart(6)}`);
    if (report && bad) {
      for (const [label, list] of [['small target', r.smallTargets], ['small text', r.smallText], ['big image', r.bigImages], ['console', r.errors]]) {
        for (const item of list) console.log(`    ${label}: ${item}`);
      }
    }
  }
  console.log(`\nScreenshots: ${SHOTS}`);
  if (failures) {
    console.log(`TEST_MOBILE FAIL (${failures} problem(s); rerun with --report for the list)`);
    process.exitCode = 1;
  } else {
    console.log('TEST_MOBILE ok');
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
