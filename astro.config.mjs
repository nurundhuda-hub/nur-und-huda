import { defineConfig } from 'astro/config';
import localSermonPreview from './scripts/local-sermon-preview.ts';

export default defineConfig({
  site:
    process.env.PUBLIC_PRAYER_MODE === 'group'
      ? 'https://nour-und-huda.web.app'
      : 'https://nurundhuda-hub.github.io',
  base: '/nur-und-huda',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  devToolbar: { enabled: false },
  integrations: [localSermonPreview()],
});
