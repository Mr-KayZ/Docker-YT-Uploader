// app/src/lib/watcher.ts
// Watches /videos for new video files and maintains an in-memory registry
// of files available to queue for upload.

import chokidar, { type FSWatcher } from "chokidar";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { VIDEOS_DIR } from "./paths.ts";
import { hasMeta } from "./videoMeta.ts";

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mkv",
  ".mov",
  ".avi",
  ".webm",
  ".flv",
  ".wmv",
  ".m4v",
  ".ts",
  ".mts",
]);

export interface WatchedFile {
  name: string;
  path: string;
  addedAt: string; // ISO string - survives JSON serialisation
  hasMeta: boolean; // true if a .meta.json sidecar exists alongside this file
}

const watchedFiles = new Map<string, WatchedFile>();

let watcherInstance: FSWatcher | null = null;
let watcherInitialised: boolean = false;
let initialScanDone: boolean = false;

export function getWatchedFiles(): WatchedFile[] {
  return Array.from(watchedFiles.values());
}

/* True once chokidar has finished its initial directory scan. */
export function isWatcherReady(): boolean {
  return initialScanDone;
}

export async function initWatcher(): Promise<void> {
  if (watcherInitialised) return;
  watcherInitialised = true;

  await mkdir(VIDEOS_DIR, { recursive: true });

  console.log(`[watcher] Starting - watching ${VIDEOS_DIR}`);

  watcherInstance = chokidar.watch(VIDEOS_DIR, {
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 500,
    },
    ignored: /(^|[/\\])\../,
  });

  watcherInstance
    .on("add", (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (!VIDEO_EXTENSIONS.has(ext)) return;

      const name = path.basename(filePath);
      const sidecar = hasMeta(filePath);
      watchedFiles.set(filePath, {
        name,
        path: filePath,
        addedAt: new Date().toISOString(),
        hasMeta: sidecar,
      });
      console.log(
        `[watcher] File added: ${name}${sidecar ? " (+.meta.json)" : ""}`,
      );
    })
    .on("unlink", (filePath) => {
      if (watchedFiles.has(filePath)) {
        console.log(`[watcher] File removed: ${path.basename(filePath)}`);
        watchedFiles.delete(filePath);
      }
    })
    .on("ready", () => {
      initialScanDone = true;
      console.log(
        `[watcher] Initial scan complete - ${watchedFiles.size} video file(s) found.`,
      );
    })
    .on("error", (err) => {
      console.error("[watcher] Error:", err);
    });
}

export async function stopWatcher(): Promise<void> {
  if (watcherInstance) {
    await watcherInstance.close();
    watcherInstance = null;
    watcherInitialised = false;
    initialScanDone = false;
    console.log("[watcher] Stopped.");
  }
}
