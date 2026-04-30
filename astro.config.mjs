// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://franzketechnologies.com',
  integrations: [sitemap({
    filter: (page) => !page.includes('/admin') && !page.includes('/thank-you'),
  }), react()],
  vite: {
    plugins: [tailwindcss()]
  }
});