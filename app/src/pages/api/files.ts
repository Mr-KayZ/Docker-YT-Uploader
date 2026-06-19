// app/src/pages/api/files.ts
// This API route returns the list of files currently being watched by the file watcher, which is used to trigger automatic uploads when changes are detected.

import type { APIRoute } from 'astro';
import { initWatcher, getWatchedFiles } from '../../lib/watcher';

// Ensure the watcher is running - safe to call multiple times
initWatcher();

// Handle GET requests to return the list of watched files
export const GET: APIRoute = () => {
  const files = getWatchedFiles();
  return new Response(JSON.stringify(files), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};