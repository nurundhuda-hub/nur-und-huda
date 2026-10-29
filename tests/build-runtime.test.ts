import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it.each(['index', 'together', 'sermons', 'quran', 'library', 'legal'])(
  '%s shipped scripts initialize and wire up the built HTML',
  (page) => {
    const parsed = new DOMParser().parseFromString(
      readFileSync(`dist/${page}.html`, 'utf8'),
      'text/html',
    );
    document.body.innerHTML = parsed.body.innerHTML;
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.showModal = () => {
        dialog.open = true;
      };
      dialog.close = () => {
        dialog.open = false;
        dialog.dispatchEvent(new Event('close'));
      };
    }
    for (const script of document.querySelectorAll('script')) {
      // Execute the actual emitted inline/standalone modules. The build currently
      // has no imports between chunks. Do not skip execution if bundling changes.
      const src = script.getAttribute('src');
      if (src) expect(src).toMatch(/^\/nur-und-huda\/_astro\/[\w.-]+\.js$/);
      const code = src
        ? readFileSync(`dist/${src.slice('/nur-und-huda/'.length)}`, 'utf8')
        : (script.textContent ?? '');
      expect(() => runInNewContext(code, { document, Intl })).not.toThrow();
    }
    const input = document.querySelector<HTMLInputElement>(
      '[data-source-search]',
    );
    if (input) {
      input.value = 'Deutsch';
      input.dispatchEvent(new Event('input'));
      const visible = [
        ...document.querySelectorAll<HTMLElement>('[data-source-item]'),
      ].filter((item) => !item.hidden);
      expect(visible).toHaveLength(1);
      expect(visible[0]!.textContent).toContain('Deutsch');
    }
    const trigger =
      document.querySelector<HTMLButtonElement>('[data-imam-open]');
    if (trigger) {
      expect(trigger.hidden).toBe(false);
      trigger.click();
      expect(document.querySelector('dialog')!.open).toBe(true);
      document.querySelector<HTMLButtonElement>('[data-imam-close]')!.click();
      expect(document.querySelector('dialog')!.open).toBe(false);
      expect(document.activeElement).toBe(trigger);
    }
  },
);
