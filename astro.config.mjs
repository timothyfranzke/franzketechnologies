// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';
import AstroPWA from '@vite-pwa/astro';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://franzketechnologies.com',
  output: 'static',
  adapter: netlify(),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin') && !page.includes('/thank-you'),
    }),
    react(),
    AstroPWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      injectRegister: null,
      scope: '/vacation/',
      base: '/vacation/',
      filename: 'sw.js',
      manifestFilename: 'vacation.webmanifest',
      manifest: {
        name: 'Vacation Splitter',
        short_name: 'Vacation',
        description: 'Split shared trip expenses across families.',
        start_url: '/vacation',
        scope: '/vacation/',
        display: 'standalone',
        background_color: '#F3E8D2',
        theme_color: '#C14A33',
        icons: [
          { src: '/vacation/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/vacation/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/vacation/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/vacation',
        navigateFallbackAllowlist: [/^\/vacation/],
        globPatterns: [
          'vacation/**/*.{html,svg,png,ico,webmanifest}',
          'vacation.webmanifest',
          '_astro/**/*.{js,css,woff,woff2}',
        ],
        globIgnores: ['**/games/**', '**/og-*.{png,svg}', '**/bg_nodes.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin && url.pathname.startsWith('/vacation'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'vacation-pages' },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname === 'firestore.googleapis.com' ||
              url.hostname === 'firebaseinstallations.googleapis.com' ||
              url.hostname.endsWith('.firebaseio.com'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});
