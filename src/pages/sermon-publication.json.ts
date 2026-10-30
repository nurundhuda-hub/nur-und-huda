import type { APIRoute } from 'astro';
import { sermonRelease } from '../lib/sermons/release';
import { releasePaths } from '../lib/sermons/publication';
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      asOf: sermonRelease.asOf,
      ...releasePaths(sermonRelease),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
