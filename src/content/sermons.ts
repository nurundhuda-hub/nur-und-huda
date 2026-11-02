import type { SermonCatalog } from '../lib/sermons/model.ts';
import { educationalSeries } from './educational-series.ts';

// The authorized pair stays local until the embargo expires. The release CLI
// injects only its sealed public catalog into an isolated build after the deadline.
// Private review wrappers are never imported here or shipped by Astro.
export const sermonCatalog: SermonCatalog = {
  series: [educationalSeries],
  sermons: [],
  studies: [],
  announcements: [],
  history: [],
};
