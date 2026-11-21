#!/usr/bin/env node
/**
 * flows.mjs — `npm run test:flows`
 *
 * Phone interaction checks that a static page inspection can't catch.
 * Each flow runs at 375×812 in a fresh, first-visit browser context and
 * fails with a message saying what a reader would have seen go wrong.
 *
 *   1. The page scrolls (not an inner panel), so Safari's bar can collapse.
 *   2. Opening a show from deep in the grid shows it at the top, in the
 *      normal page flow, with exactly one visible <h1>.
 *   3. Back returns to the grid at the same scroll position.
 *   4. The menu opens on the first tap, in Grid and in Timeline.
 *   5. Grid / Timeline / Index never show two views at once.
 *   6. Theme switch: no text left in the old theme's colour.
 *
 * Uses the machine's Chrome via playwright-core (see tests/mobile.mjs).
 */
import { chromium } from 'playwright-core';
import { startServer } from './serve.mjs';

const PORT = 4180;
const BASE = `http://localhost:${PORT}`;
const PHONE = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const results = [];
const DESKTOP = { viewport: { width: 1440, height: 900 } };
async function flow(name, browser, fn, { desktop = false } = {}) {
  const ctx = await browser.newContext(desktop ? DESKTOP : PHONE);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message || e)));
  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await fn(page);
    if (errors.length) throw new Error('uncaught error: ' + errors[0]);
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, why: String(e.message || e).split('\n')[0] });
  } finally {
    await ctx.close();
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const visibleViews = (page) => page.evaluate(() => ['grid-view', 'index-table-view', 'timeline-view', 'folders-view']
  .filter(id => { const e = document.getElementById(id); return e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; }));
const tap = async (page, sel) => { await page.locator(sel).first().click(); await page.waitForTimeout(700); };

async function main() {
  const server = await startServer(PORT);
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
  try {
    await flow('page scrolls, not an inner panel', browser, async (page) => {
      const s = await page.evaluate(() => {
        const se = document.scrollingElement, ip = document.getElementById('image-panel');
        window.scrollTo({ top: 600, behavior: 'instant' });
        return { doc: se.scrollTop, panelScrollable: ip.scrollHeight > ip.clientHeight + 2 && getComputedStyle(ip).overflowY !== 'visible' };
      });
      expect(s.doc > 0, 'the document did not scroll');
      expect(!s.panelScrollable, '#image-panel is still its own scroll box');
    });

    await flow('open a show from deep in the grid, then Back restores the grid position', browser, async (page) => {
      await tap(page, '#btn-dismiss-orientation');
      await page.evaluate(() => window.scrollTo({ top: 2400, behavior: 'instant' }));
      await page.waitForTimeout(300);
      // Tap a card that is already on screen, as a reader would. (A
      // Playwright click scrolls its target into view first, which would
      // change the position we are trying to measure.)
      const { before, id } = await page.evaluate(() => {
        const card = [...document.querySelectorAll('#image-grid .grid-cell')]
          .find(c => { const r = c.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight; });
        const at = document.scrollingElement.scrollTop;
        card.click();
        return { before: at, id: card.dataset.entryId };
      });
      expect(before > 1000, `could not scroll the grid (scrollTop ${before})`);
      await page.waitForTimeout(1500);
      const d = await page.evaluate(() => {
        const dv = document.getElementById('detail-image-view');
        return {
          open: document.getElementById('app-root').classList.contains('detail-mode-active'),
          inFlow: getComputedStyle(dv).position !== 'absolute',
          titleTop: Math.round((document.querySelector('.dmi-title') || dv).getBoundingClientRect().top),
          h1s: [...document.querySelectorAll('h1')].filter(h => h.offsetParent && h.getBoundingClientRect().height > 1).map(h => h.textContent.trim().slice(0, 40)),
          grid: getComputedStyle(document.getElementById('grid-view')).display,
        };
      });
      expect(d.open, `tapping ${id} did not open the show`);
      expect(d.inFlow, 'the show page is still an overlay (position: absolute)');
      expect(d.titleTop >= 0 && d.titleTop < 400, `the show's title is not near the top of the screen (at ${d.titleTop}px)`);
      expect(d.h1s.length === 1, `expected one visible <h1>, found ${d.h1s.length}: ${d.h1s.join(' | ')}`);
      expect(d.grid === 'none', 'the grid is still laid out behind the show');
      await page.goBack();
      await page.waitForTimeout(1500);
      const after = await page.evaluate(() => ({
        open: document.getElementById('app-root').classList.contains('detail-mode-active'),
        top: document.scrollingElement.scrollTop,
      }));
      expect(!after.open, 'Back did not close the show');
      expect(Math.abs(after.top - before) < 60, `Back returned to scroll ${after.top}, not ${before}`);
    });

    await flow('desktop: open a show and Back restores the image panel position', browser, async (page) => {
      await tap(page, '#btn-dismiss-orientation');
      const { before, id } = await page.evaluate(() => {
        const panel = document.getElementById('image-panel');
        panel.scrollTo({ top: 1800, behavior: 'instant' });
        const card = [...document.querySelectorAll('#image-grid .grid-cell')]
          .find(c => { const r = c.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight; });
        const at = panel.scrollTop;
        card.click();
        return { before: at, id: card.dataset.entryId };
      });
      expect(before > 1000, `could not scroll the desktop panel (scrollTop ${before})`);
      await page.waitForTimeout(1500);
      expect(await page.evaluate(() => document.getElementById('app-root').classList.contains('detail-mode-active')), `${id} did not open`);
      await page.goBack();
      await page.waitForTimeout(1500);
      const after = await page.evaluate(() => document.getElementById('image-panel').scrollTop);
      expect(Math.abs(after - before) < 60, `desktop Back returned to ${after}, not ${before}`);
    }, { desktop: true });

    await flow('a search link (as on the 404 page) filters the archive', browser, async (page) => {
      const all = await page.evaluate(() => document.querySelectorAll('#image-grid .grid-cell').length);
      await page.goto(BASE + '/#?q=robots', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const r = await page.evaluate(() => ({
        n: document.querySelectorAll('#image-grid .grid-cell').length,
        box: document.getElementById('search-input')?.value,
      }));
      expect(r.box === 'robots', `the search box shows "${r.box}", not "robots"`);
      expect(r.n > 0 && r.n < all, `searching "robots" showed ${r.n} of ${all} shows`);
    });

    await flow('menu opens on the first tap, in Grid and in Timeline', browser, async (page) => {
      const openOnce = async (where) => {
        await tap(page, '#btn-hamburger');
        const ok = await page.evaluate(() => {
          const p = document.getElementById('index-panel');
          const r = p.getBoundingClientRect();
          return getComputedStyle(p).display !== 'none' && r.left > -5 && r.width > 200;
        });
        expect(ok, `the menu did not open in ${where}`);
        await tap(page, '#btn-hamburger');
      };
      await openOnce('Grid');
      await tap(page, '#btn-dismiss-orientation');
      await tap(page, '#btn-toggle-timeline');
      await openOnce('Timeline');
    });

    await flow('Grid / Timeline / Index never stack', browser, async (page) => {
      await tap(page, '#btn-dismiss-orientation');
      const steps = [['#btn-mode-index', 'index-table-view'], ['#btn-toggle-timeline', 'timeline-view'], ['#btn-mode-index', 'index-table-view'],
        ['#btn-mode-visual', 'grid-view'], ['#btn-toggle-timeline', 'timeline-view'], ['#btn-toggle-grid', 'grid-view']];
      for (const [sel, want] of steps) {
        await tap(page, sel);
        const v = await visibleViews(page);
        expect(v.length === 1 && v[0] === want, `after ${sel}: showing [${v.join(', ')}], expected ${want}`);
      }
    });

    await flow('theme switch leaves no text in the old colour', browser, async (page) => {
      for (const target of ['light', 'dark']) {
        // On phones the theme button lives in the menu; trigger it directly.
        await page.evaluate(() => document.querySelector('[aria-label="Toggle light/dark theme"]').click());
        await page.waitForTimeout(120); // well inside the old 2.4s lag
        const stuck = await page.evaluate(() => {
          const dark = document.documentElement.classList.contains('dark');
          const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return null; const [r, g, b] = m.map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
          const bad = [];
          for (const el of document.querySelectorAll('#index-panel-title, .hero-headline, .hero-sub, .sec-title, .how-step h2')) {
            const r = el.getBoundingClientRect();
            if (!r.width) continue;
            const L = lum(getComputedStyle(el).color);
            if (L !== null && (dark ? L < 0.35 : L > 0.65)) bad.push(el.className || el.id);
          }
          return { dark, bad };
        });
        expect(stuck.bad.length === 0, `switching to ${target}: text still in the old colour: ${stuck.bad.join(', ')}`);
      }
    });
  } finally {
    await browser.close();
    server.close();
  }

  let failed = 0;
  for (const r of results) {
    console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      ${r.why}`}`);
    if (!r.ok) failed++;
  }
  console.log(failed ? `TEST_FLOWS FAIL (${failed} of ${results.length})` : `TEST_FLOWS ok (${results.length} flows)`);
  if (failed) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
