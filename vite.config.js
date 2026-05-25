import { defineConfig } from 'vite';

export default defineConfig({
  // Don't merge public/ into root — keep the /public/ prefix intact
  // so asset-base="/public" works the same on dev and on Vercel.
  publicDir: false,
});
