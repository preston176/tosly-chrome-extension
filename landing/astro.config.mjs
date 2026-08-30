// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

/*
  React is here for exactly one island: the live demo, which renders the
  extension's real ResultPanel (vendored into src/vendor/tosly-ui by
  scripts/sync-extension-ui.mjs). Every other part of the site is static HTML
  with small inline scripts, so React only ships for that demo.
*/
export default defineConfig({
  integrations: [tailwind({ nesting: true }), react()],
});
