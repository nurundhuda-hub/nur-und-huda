import type { SermonCatalog } from '../lib/sermons/model.ts';
import { educationalSeries } from './educational-series.ts';

// No religious content is approved for public release. Private review drafts
// stay in ignored .sermon-review/ and are never imported here or by Astro.
export const sermonCatalog: SermonCatalog = {
  series: [educationalSeries],
  sermons: [],
  studies: [],
  announcements: [],
  history: [],
};
