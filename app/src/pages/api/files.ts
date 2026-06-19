// app/src/pages/api/files.ts
// GET /api/files - list video files available in /uploads

import type { APIRoute } from 'astro';
import { getWatchedFiles, isWatcherReady } from '../../lib/watcher.ts';

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({
      ready: isWatcherReady(),
      files: getWatchedFiles(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};