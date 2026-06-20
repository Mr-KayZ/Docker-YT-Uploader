// app/src/lib/queue.ts
// Persistent upload queue and history stored in /data volume.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths.ts";

const QUEUE_PATH = path.join(DATA_DIR, "queue.json");
const HISTORY_PATH = path.join(DATA_DIR, "history.json");

export type PrivacyStatus = "public" | "private" | "unlisted";
export type AudienceType = "general" | "kids" | "age_restricted";
export type UploadStatus = "queued" | "uploading" | "done" | "failed";

export interface QueueEntry {
  id: string;
  filePath: string;
  fileName: string;
  queuedAt: string;
  scheduledUploadAt: string | null;

  // YouTube metadata
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: PrivacyStatus;
  publishAt: string | null;
  audience: AudienceType;
  selfDeclaredMadeForKids: boolean;
  ageRestricted: boolean;
  language: string;

  // Thumbnail - /data/thumbnails/<id>.<ext>
  thumbnailPath: string | null;

  // Captions - /data/captions/<id>.<ext>
  captionPath: string | null;
  captionLanguage: string | null;

  // Runtime state
  status: UploadStatus;
  youtubeVideoId: string | null;
  errorMessage: string | null;
  uploadStartedAt: string | null;
  uploadFinishedAt: string | null;
}

// Directory init (call once at startup)
//-------------------------------------------------------------------------------------------------
let dataDirReady = false;

export async function ensureDataDir(): Promise<void> {
  if (dataDirReady) return;
  // recursive:true is a no-op if the directory already exists - no existsSync needed
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(path.join(DATA_DIR, "thumbnails"), { recursive: true });
  await mkdir(path.join(DATA_DIR, "captions"), { recursive: true });
  dataDirReady = true;
}

// Write lock (prevents concurrent read-modify-write clobbering)
//-------------------------------------------------------------------------------------------------
let writeLock: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeLock.then(fn);
  // Swallow rejections on the shared lock chain so one failure doesn't
  // permanently block future writes
  writeLock = next.then(
    () => {},
    () => {},
  );
  return next;
}

// Queue
//-------------------------------------------------------------------------------------------------
async function readQueue(): Promise<QueueEntry[]> {
  if (!existsSync(QUEUE_PATH)) return [];
  try {
    return JSON.parse(await readFile(QUEUE_PATH, "utf-8"));
  } catch {
    return [];
  }
}

async function writeQueue(entries: QueueEntry[]): Promise<void> {
  await writeFile(QUEUE_PATH, JSON.stringify(entries, null, 2));
}

export function getQueue(): Promise<QueueEntry[]> {
  return readQueue();
}

export function addToQueue(entry: QueueEntry): Promise<void> {
  return withLock(async () => {
    const q = await readQueue();
    q.push(entry);
    await writeQueue(q);
  });
}

export function updateQueueEntry(
  id: string,
  patch: Partial<QueueEntry>,
): Promise<void> {
  return withLock(async () => {
    const q = await readQueue();
    const idx = q.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Queue entry ${id} not found`);
    q[idx] = { ...q[idx], ...patch };
    await writeQueue(q);
  });
}

export function removeFromQueue(id: string): Promise<void> {
  return withLock(async () => {
    const q = await readQueue();
    await writeQueue(q.filter((e) => e.id !== id));
  });
}

// History
//-------------------------------------------------------------------------------------------------
async function readHistory(): Promise<QueueEntry[]> {
  if (!existsSync(HISTORY_PATH)) return [];
  try {
    return JSON.parse(await readFile(HISTORY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

async function writeHistory(entries: QueueEntry[]): Promise<void> {
  await writeFile(HISTORY_PATH, JSON.stringify(entries, null, 2));
}

export function getHistory(): Promise<QueueEntry[]> {
  return readHistory();
}

// moveToHistory removes from queue AND writes history atomically under the same lock
export function moveToHistory(entry: QueueEntry): Promise<void> {
  return withLock(async () => {
    const [q, h] = await Promise.all([readQueue(), readHistory()]);
    await Promise.all([
      writeQueue(q.filter((e) => e.id !== entry.id)),
      writeHistory([entry, ...h]),
    ]);
  });
}
