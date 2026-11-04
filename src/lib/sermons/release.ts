import { sermonCatalog } from '../../content/sermons.ts';
import { selectPublicCatalog, publicBuildInstant } from './publication.ts';
import { loadPrivateRelease } from '../../../scripts/private-sermon-release.ts';

const asOf = publicBuildInstant(process.env.SERMON_BUILD_AT);
export const sermonRelease =
  process.env.NUR_PRIVATE_SERMON_RELEASE === 'true'
    ? loadPrivateRelease(process.env.PUBLIC_PRAYER_MODE === 'group').release
    : selectPublicCatalog(sermonCatalog, asOf);
