import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://nurundhuda-hub.github.io',
  base: '/nur-und-huda',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  devToolbar: { enabled: false },
});
