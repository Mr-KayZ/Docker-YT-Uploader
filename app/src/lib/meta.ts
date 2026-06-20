// app/src/lib/meta.ts
// Reads and validates a .meta.json sidecar file alongside a video file.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export interface VideoMeta {
  title?:       string;
  description?: string;
  tags?:        string[];   // YouTube allows up to 500 chars total
  privacy?:     'public' | 'private' | 'unlisted';
  category?:    string;     // YouTube numeric category ID as string e.g. "22"
  playlistId?:  string;     // Optional YouTube playlist ID to add video to
}

// Returns the expected sidecar path for a given video file path.
export function metaPathFor(videoPath: string): string {
  const ext = path.extname(videoPath);
  return videoPath.slice(0, -ext.length) + '.meta.json';
}

// Returns parsed metadata if a sidecar exists, or null if not.
export async function loadMeta(videoPath: string): Promise<VideoMeta | null> {
  const metaPath = metaPathFor(videoPath);
  if (!existsSync(metaPath)) return null;

  try {
    const raw    = await readFile(metaPath, 'utf-8');
    const parsed = JSON.parse(raw) as VideoMeta;

    // Basic sanitisation - strip unknown keys, coerce types
    return {
      title:       typeof parsed.title       === 'string' ? parsed.title.trim()       : undefined,
      description: typeof parsed.description === 'string' ? parsed.description.trim() : undefined,
      tags:        Array.isArray(parsed.tags)
                     ? parsed.tags.filter((t): t is string => typeof t === 'string')
                     : undefined,
      privacy:     ['public', 'private', 'unlisted'].includes(parsed.privacy as string)
                     ? parsed.privacy
                     : undefined,
      category:    typeof parsed.category    === 'string' ? parsed.category.trim()    : undefined,
      playlistId:  typeof parsed.playlistId  === 'string' ? parsed.playlistId.trim()  : undefined,
    };
  } catch (err) {
    console.warn(`[meta] Failed to parse ${metaPath}:`, err);
    return null;
  }
}