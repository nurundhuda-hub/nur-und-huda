import type { SermonCatalog } from '../lib/sermons/model.ts';
import { educationalSeries } from './educational-series.ts';

// No religious content has been supplied or approved. Add immutable revisions
// only after external drafting and documented human review. Never import tests.
export const sermonCatalog: SermonCatalog = {
  series: [educationalSeries],
  sermons: [],
  studies: [],
  announcements: [],
  history: [],
};
