// This module sets up a file watcher on the /uploads directory to detect new video files added for upload. It uses the chokidar library to watch for file changes and maintains an in-memory list of currently watched files, which can be accessed via an API route.

// Import libraries
import chokidar from 'chokidar';
import path from 'node:path';

// Directory to watch for new video files
const UPLOADS_DIR = '/uploads';

// Video file extensions to watch for
const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.mov', '.avi', '.webm',
  '.flv', '.wmv', '.m4v', '.ts', '.mts'
]);

// Type definition for a watched file
export interface WatchedFile {
  name: string;
  path: string;
  addedAt: Date;
}

// In-memory store - persists for the lifetime of the server process
const watchedFiles = new Map<string, WatchedFile>();

let watcherInitialised = false;

export function getWatchedFiles(): WatchedFile[] {
  return Array.from(watchedFiles.values());
}

// Initialize the file watcher - safe to call multiple times
export function initWatcher() {
  if (watcherInitialised) return;
  watcherInitialised = true;

  console.log(`[watcher] Starting - watching ${UPLOADS_DIR}`);

  const watcher = chokidar.watch(UPLOADS_DIR, {
    persistent: true,
    ignoreInitial: false,       // Pick up files already in the folder on boot
    awaitWriteFinish: {
      stabilityThreshold: 2000, // Wait 2s after last write before treating as ready
      pollInterval: 500,
    },
    ignored: /(^|[/\\])\../,    // Ignore dotfiles like .gitkeep
  });

  // Handle file events
  watcher
    .on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) return;

      const name = path.basename(filePath);
      watchedFiles.set(filePath, { name, path: filePath, addedAt: new Date() });
      console.log(`[watcher] File added: ${name}`);
    })
    .on('unlink', (filePath) => {
      watchedFiles.delete(filePath);
      console.log(`[watcher] File removed: ${path.basename(filePath)}`);
    })
    .on('error', (err) => {
      console.error(`[watcher] Error:`, err);
    });
}