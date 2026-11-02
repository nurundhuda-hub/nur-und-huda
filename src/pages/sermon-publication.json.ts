import type { APIRoute } from 'astro';
import { sermonRelease } from '../lib/sermons/release';
import { publicReleaseManifest } from '../lib/sermons/scheduled-release';
export const GET: APIRoute = () =>
  new Response(JSON.stringify(publicReleaseManifest(sermonRelease)), {
    headers: { 'Content-Type': 'application/json' },
  });
