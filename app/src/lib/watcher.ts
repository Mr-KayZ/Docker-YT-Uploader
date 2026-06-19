// app/src/lib/watcher.ts
// Watches /uploads for new video files and maintains an in-memory registry
// of files available to queue for upload.

import chokidar, { type FSWatcher } from 'chokidar';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_DIR } from './paths.ts';

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.mov', '.avi', '.webm',
  '.flv', '.wmv', '.m4v', '.ts', '.mts',
]);

export interface WatchedFile {
  name:    string;
  path:    string;
  addedAt: string; // ISO string - survives JSON serialisation
}

// In-memory store - persists for the lifetime of the server process
const watchedFiles = new Map<string, WatchedFile>();

let watcherInstance:    FSWatcher | null = null;
let watcherInitialised: boolean = false;
let initialScanDone:    boolean = false;

export function getWatchedFiles(): WatchedFile[] {
  return Array.from(watchedFiles.values());
}

/** True once chokidar has finished its initial directory scan. */
export function isWatcherReady(): boolean {
  return initialScanDone;
}

export async function initWatcher(): Promise<void> {
  if (watcherInitialised) return;
  watcherInitialised = true;

  // Ensure the uploads directory exists before chokidar tries to watch it
  await mkdir(UPLOADS_DIR, { recursive: true });

  console.log(`[watcher] Starting - watching ${UPLOADS_DIR}`);

  watcherInstance = chokidar.watch(UPLOADS_DIR, {
    persistent:     true,
    ignoreInitial:  false, // Pick up files already present on boot
    awaitWriteFinish: {
      stabilityThreshold: 2000, // Wait 2s of no writes before treating file as stable
      pollInterval:       500,
    },
    ignored: /(^|[/\\])\../, // Ignore dotfiles (.gitkeep etc.)
  });

  watcherInstance
    .on('add', (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) return;

      const name = path.basename(filePath);
      watchedFiles.set(filePath, { name, path: filePath, addedAt: new Date().toISOString() });
      console.log(`[watcher] File added: ${name}`);
    })
    .on('unlink', (filePath) => {
      if (watchedFiles.has(filePath)) {
        console.log(`[watcher] File removed: ${path.basename(filePath)}`);
        watchedFiles.delete(filePath);
      }
    })
    .on('ready', () => {
      initialScanDone = true;
      console.log(`[watcher] Initial scan complete - ${watchedFiles.size} video file(s) found.`);
    })
    .on('error', (err) => {
      console.error('[watcher] Error:', err);
    });
}

export async function stopWatcher(): Promise<void> {
  if (watcherInstance) {
    await watcherInstance.close();
    watcherInstance    = null;
    watcherInitialised = false;
    initialScanDone    = false;
    console.log('[watcher] Stopped.');
  }
}