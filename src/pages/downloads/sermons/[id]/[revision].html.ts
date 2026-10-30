import type { APIRoute } from 'astro';
import { sermonRelease } from '../../../../lib/sermons/release';
import { renderOfflineSermon } from '../../../../lib/sermons/offline';
export function getStaticPaths() {
  return sermonRelease.published.map(({ sermon }) => ({
    params: { id: sermon.id, revision: sermon.revision },
  }));
}
export const GET: APIRoute = ({ params }) =>
  new Response(
    renderOfflineSermon(sermonRelease, params.id!, params.revision!),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
