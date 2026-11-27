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
 *   7. In both themes no text blends into its background (home, a show,
 *      the Provenance / Critique / Strategy panel, the Nexus tabs and the
 *      sign-in box).
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
const toggleTheme = (page) => page.evaluate(() => document.querySelector('[aria-label="Toggle light/dark theme"]').click());

// Every visible piece of text whose colour is too close to the background
// behind it (luminance gap < 0.25, roughly under 3:1). Translucent text and
// backgrounds are composited first: white at 30% on paper is pale grey,
// not white. Text over a photo is skipped (its background can't be read
// reliably; gradients count as decoration), as is text covered by
// something else, and one- or two-character ornaments such as "/"
// separators and arrows.
const lowContrastText = (page) => page.evaluate(() => {
  const rgba = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number); return [r, g, b, a]; };
  const L = ([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const bgOf = (el) => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const img = cs.backgroundImage;
      if (img.includes('url(')) return null; // a photo: unknowable
      // An opaque gradient is the surface: use its first colour. One with
      // transparent stops is an overlay, so look through it.
      const stops = img.includes('gradient') ? img.match(/rgba?\([^)]*\)/g) || [] : [];
      if (stops.length && stops.every(x => (rgba(x)[3] ?? 1) >= 0.95)) { layers.push(rgba(stops[0])); break; }
      const c = rgba(cs.backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.95) break; }
    }
    let col = (layers.length && layers[layers.length - 1][3] >= 0.95) ? layers.pop() : (rgba(getComputedStyle(document.body).backgroundColor) || [255, 255, 255, 1]);
    while (layers.length) { const t = layers.pop(); col = [0, 1, 2].map(i => t[i] * t[3] + col[i] * (1 - t[3])); }
    return col;
  };
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('');
    if (own.length < 3 && !/[a-z0-9]/i.test(own)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    if (op < 0.05) continue;
    const hit = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 8))));
    if (hit && !el.contains(hit) && !hit.contains(el)) continue;
    const bg = bgOf(el);
    if (!bg) continue;
    const f = rgba(cs.color);
    if (!f) continue;
    const a = f[3] * op;
    const fg = [0, 1, 2].map(i => f[i] * a + bg[i] * (1 - a));
    if (Math.abs(L(fg) - L(bg)) < 0.25) bad.push(`"${el.textContent.trim().replace(/\s+/g, ' ').slice(0, 30)}" (${el.id || el.className || el.tagName})`);
  }
  return [...new Set(bad)].slice(0, 5);
});

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

    await flow('both themes: no text blends into its background (home, show page)', browser, async (page) => {
      for (const path of ['/', '/entry/gaultier-ss94']) {
        if (path !== '/') { await page.goto(BASE + path, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000); }
        for (let i = 0; i < 2; i++) {
          const theme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
          const bad = await lowContrastText(page);
          expect(bad.length === 0, `${path} in ${theme}: ${bad.join(', ')}`);
          await toggleTheme(page);
          await page.waitForTimeout(300);
        }
      }
    });

    await flow('both themes: Nexus (graph, timeline, list) and sign-in box are readable', browser, async (page) => {
      await page.goto(BASE + '/entry/gaultier-ss94', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const click = (sel) => page.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.offsetParent || getComputedStyle(x).position === 'fixed'); if (e) e.click(); return !!e; }, sel);
      for (let i = 0; i < 2; i++) {
        const theme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        expect(await click('#btn-nexus-mobile, #btn-related-open-nexus'), 'no button opens the Nexus');
        for (const tab of ['#nexus-tab-graph', '#nexus-tab-timeline', '#nexus-tab-list']) {
          await click(tab);
          await page.waitForTimeout(500);
          const seen = await page.evaluate(() => [...document.querySelectorAll('#matrix-content *')].some(e => { const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 8)); return r.width > 2 && r.top >= 0 && r.top < innerHeight && h && (e.contains(h) || h.contains(e)); }));
          expect(seen, `Nexus ${tab.slice(11)} tab in ${theme}: its contents are not visible (covered or not open)`);
          const bad = await lowContrastText(page);
          expect(bad.length === 0, `Nexus ${tab.slice(11)} tab in ${theme}: ${bad.join(', ')}`);
        }
        await click('#btn-close-matrix');
        await page.waitForTimeout(400);
        if (await click('#btn-save-folder-mobile, #btn-save-to-folder')) {
          await page.waitForTimeout(500);
          const bad = await lowContrastText(page);
          expect(bad.length === 0, `sign-in box in ${theme}: ${bad.join(', ')}`);
          await click('[data-modal-close="auth"]');
          await page.waitForTimeout(300);
          expect(await page.evaluate(() => document.getElementById('auth-modal').classList.contains('hidden')), 'the sign-in box did not close');
        }
        await toggleTheme(page);
        await page.waitForTimeout(300);
      }
    });

    await flow('desktop: Provenance / Critique / Strategy panel is readable in both themes', browser, async (page) => {
      await page.goto(BASE + '/entry/gaultier-ss94', { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      for (const sq of ['sq-provenance', 'sq-critique', 'sq-strategy']) {
        await page.evaluate((c) => document.querySelector('.' + c).click(), sq);
        await page.waitForTimeout(300);
        for (let i = 0; i < 2; i++) {
          const theme = await page.evaluate(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light');
          const bad = await lowContrastText(page);
          expect(bad.length === 0, `${sq} panel in ${theme}: ${bad.join(', ')}`);
          await toggleTheme(page);
          await page.waitForTimeout(300);
        }
        await page.evaluate((c) => document.querySelector('.' + c).click(), sq); // close
      }
    }, { desktop: true });
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
