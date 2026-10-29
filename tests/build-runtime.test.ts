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
      // Astro currently emits tiny inline modules. Each VM context isolates their
      // bindings like a module. No browser layout or native modal behavior implied.
      expect(script.src).toBe('');
      expect(() =>
        runInNewContext(script.textContent ?? '', { document, Intl }),
      ).not.toThrow();
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
