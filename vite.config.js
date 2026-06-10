import { defineConfig } from 'vite';

export default defineConfig({
  // Don't merge public/ into root — keep the /public/ prefix intact
  // so asset-base="/public" works the same on dev and on Vercel.
  publicDir: false,
  // Keep the dep scanner out of the generated /entry/** static pages —
  // their script srcs are root-relative and don't resolve from those dirs.
  optimizeDeps: { entries: ['index.html'] },
  plugins: [
    {
      // The ?v=<sha> cache-bust on the app.js script tag (stamped by
      // bust-cache.mjs for production) makes Vite's dev server fork the
      // module graph: app.js's direct imports get ?v appended while the
      // modules' own imports don't, producing TWO core-state.js instances
      // and a split AppState (search/Escape/arrow keys silently break in
      // dev only). Static hosting is unaffected — browsers drop the query
      // when resolving relative imports. Stripping ?v in dev keeps the
      // graph unified.
      name: 'strip-cache-bust-in-dev',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace(/(src="js\/app\.js)\?v=[^"]*(")/, '$1$2')
                   .replace(/(href="index\.css)\?v=[^"]*(")/, '$1$2');
      },
    },
  ],
});
