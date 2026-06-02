/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './js/**/*.js',
    './js/**/*.mjs',
  ],
  theme: {
    extend: {
      colors: {
        bone: '#FAF9F6',
        overlay: '#FDFCF0',
        darkBase: '#0A0A0A',
        darkSurface: '#111111',
        acid: '#CCFF00',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Cascadia Code"', '"Fira Code"', 'monospace'],
        serif: ['"EB Garamond"', 'Georgia', 'serif'],
      },
    },
  },
  // Safelist: arbitrary values used in HTML/JS that static scanning may miss
  safelist: [
    // Arbitrary size values from index.html and JS render templates
    'min-h-[44px]', 'min-h-[48px]', 'min-w-[44px]', 'min-w-[48px]', 'min-w-[160px]',
    'w-[220px]', 'w-[280px]', 'w-[480px]', 'w-[40%]', 'w-[60%]', 'w-[85%]',
    'max-h-[60vh]', 'max-h-[70vh]', 'max-h-[80vh]', 'max-h-[85vh]', 'max-h-[90vh]',
    'border-[1px]', 'border-b-[1px]', 'border-r-[1px]', 'border-t-[1px]', 'border-t-[3px]',
    'h-[2px]', 'gap-[6px]', 'leading-[1.75]',
    // Text sizes used in render templates
    'text-[7px]', 'text-[8px]', 'text-[9px]', 'text-[0.5rem]', 'text-[0.7rem]',
    // Letter spacing (most commonly used values in templates)
    'tracking-[0.04em]', 'tracking-[0.05em]', 'tracking-[0.06em]',
    'tracking-[0.08em]', 'tracking-[0.1em]', 'tracking-[0.15em]',
    'tracking-[0.18em]', 'tracking-[0.2em]', 'tracking-[0.25em]', 'tracking-[0.3em]',
    // Z-index layers
    'z-[1]', 'z-[5]', 'z-[60]', 'z-[100]', 'z-[200]', 'z-[210]', 'z-[300]',
    'z-[1000]', 'z-[2000]', 'z-[3000]', 'z-[5000]', 'z-[6000]', 'z-[9000]', 'z-[10000]',
    // Aspect ratio from render-detail.js
    'aspect-[3/4]',
    // Opacity steps used in conditional ternaries
    { pattern: /^opacity-(0|10|20|30|40|50|60|70|80|90|100)$/ },
    // Color/opacity combinations for dynamic tag colors
    { pattern: /^(bg|text|border)-(white|black|acid|bone|darkBase|darkSurface)(\/\d+)?$/ },
    { pattern: /^text-white\/\d+$/ },
    { pattern: /^text-black\/\d+$/ },
    // Animation classes toggled by JS
    'animate-pulse', 'animate-spin',
    // Layout toggled by JS
    'hidden', 'block', 'flex', 'inline', 'inline-flex', 'grid',
    // Transform states toggled by JS
    'translate-y-0', 'translate-y-full', '-translate-y-full',
    '-translate-x-full', 'translate-x-0',
  ],
  plugins: [],
};
