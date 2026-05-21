/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve existing asset folders from /public
  // Images are at /public/THE-LEXICON-ASSETS/<slug>/
  images: {
    unoptimized: true, // we manage our own webp optimisation via optimize-images.mjs
  },
  // Allow the existing database.js and content/ to coexist
  pageExtensions: ['js', 'jsx'],
};

export default nextConfig;
