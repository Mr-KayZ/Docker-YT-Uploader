import type { APIRoute } from 'astro';
import { initWatcher, getWatchedFiles } from '../../lib/watcher';

// Ensure the watcher is running - safe to call multiple times
initWatcher();

export const GET: APIRoute = () => {
  const files = getWatchedFiles();
  return new Response(JSON.stringify(files), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};