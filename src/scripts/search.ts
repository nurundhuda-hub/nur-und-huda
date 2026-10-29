export function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function initSourceDirectories(root: ParentNode): void {
  root
    .querySelectorAll<HTMLElement>('[data-source-directory]')
    .forEach((directory) => {
      if (directory.dataset.initialized) return;
      const input = directory.querySelector<HTMLInputElement>(
        '[data-source-search]',
      );
      const controls = directory.querySelector<HTMLElement>(
        '[data-search-controls]',
      );
      const status = directory.querySelector<HTMLElement>(
        '[data-search-status]',
      );
      const empty = directory.querySelector<HTMLElement>('[data-search-empty]');
      const items = [
        ...directory.querySelectorAll<HTMLElement>('[data-source-item]'),
      ];
      if (!input || !controls || !status || !empty) return;

      const number = new Intl.NumberFormat('ar', { numberingSystem: 'arab' });
      const filter = () => {
        const terms = normalizeSearch(input.value).split(' ').filter(Boolean);
        let count = 0;
        for (const item of items) {
          const text = normalizeSearch(
            item.dataset.searchText ?? item.textContent ?? '',
          );
          item.hidden = !terms.every((term) => text.includes(term));
          if (!item.hidden) count++;
        }
        empty.hidden = count > 0;
        status.textContent = `المصادر المعروضة: ${number.format(count)} من ${number.format(items.length)}`;
      };
      input.addEventListener('input', filter);
      controls.hidden = false;
      directory.dataset.initialized = 'true';
      filter();
    });
}
