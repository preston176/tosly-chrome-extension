// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// No framework integration: every interactive piece on the site is a small
// inline script, so there are no islands to hydrate.
export default defineConfig({
  integrations: [tailwind({ nesting: true })],
});
