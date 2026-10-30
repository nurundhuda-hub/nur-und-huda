import { sermonCatalog } from '../../content/sermons.ts';
import { selectPublicCatalog, publicBuildInstant } from './publication.ts';

const asOf = publicBuildInstant(process.env.SERMON_BUILD_AT);
export const sermonRelease = selectPublicCatalog(sermonCatalog, asOf);
