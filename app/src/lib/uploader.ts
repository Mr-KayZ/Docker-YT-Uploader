// app/src/lib/uploader.ts
// Handles core upload logic: validating entries, uploading videos to YouTube, and 
// updating queue/history status accordingly.

import { google } from 'googleapis';
import type { youtube_v3 } from 'googleapis';
import { createReadStream, statSync } from 'node:fs';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { getAuthenticatedClient } from './auth.js';
import { type QueueEntry, updateQueueEntry, moveToHistory } from './queue.js';

export const YT_CATEGORIES: Record<string, string> = {
  '1':  'Film & Animation',
  '2':  'Autos & Vehicles',
  '10': 'Music',
  '15': 'Pets & Animals',
  '17': 'Sports',
  '19': 'Travel & Events',
  '20': 'Gaming',
  '22': 'People & Blogs',
  '23': 'Comedy',
  '24': 'Entertainment',
  '25': 'News & Politics',
  '26': 'Howto & Style',
  '27': 'Education',
  '28': 'Science & Technology',
  '29': 'Nonprofits & Activism',
};

const MAX_TITLE_LEN       = 100;
const MAX_DESCRIPTION_LEN = 5000;
const MAX_FILE_BYTES      = 128 * 1024 * 1024 * 1024; // 128 GB

// Returns an error string if the entry is invalid, null if valid.
export function validateEntry(entry: QueueEntry): string | null {
  if (!entry.title.trim())
    return 'Title is required.';
  if (entry.title.length > MAX_TITLE_LEN)
    return `Title must be ≤ ${MAX_TITLE_LEN} characters.`;
  if (entry.description.length > MAX_DESCRIPTION_LEN)
    return `Description must be ≤ ${MAX_DESCRIPTION_LEN} characters.`;

  // Single stat call covers both "file missing" and "file too large"
  let size: number;
  try {
    size = statSync(entry.filePath).size;
  } catch {
    return `Video file not found: ${entry.filePath}`;
  }
  if (size > MAX_FILE_BYTES)
    return `File exceeds YouTube's 128 GB limit.`;

  return null;
}

// Uploads a single queue entry to YouTube, updating its status in the queue/history accordingly.
export async function uploadEntry(entry: QueueEntry): Promise<void> {
  const validationError = validateEntry(entry);
  if (validationError) {
    await moveToHistory({
      ...entry,
      status:           'failed',
      errorMessage:     validationError,
      uploadFinishedAt: new Date().toISOString(),
    });
    return;
  }

  await updateQueueEntry(entry.id, {
    status:          'uploading',
    uploadStartedAt: new Date().toISOString(),
  });

  // Core upload logic
  try {
    const auth    = await getAuthenticatedClient();
    const youtube = google.youtube({ version: 'v3', auth });

    const resource: youtube_v3.Schema$Video = {
      snippet: {
        title:           entry.title.trim(),
        description:     entry.description,
        tags:            entry.tags,
        categoryId:      entry.categoryId,
        defaultLanguage: entry.language || 'en',
      },
      status: {
        privacyStatus:           entry.publishAt ? 'private' : entry.privacyStatus,
        selfDeclaredMadeForKids: entry.selfDeclaredMadeForKids,
        ...(entry.publishAt     ? { publishAt: entry.publishAt } : {}),
        ...(entry.ageRestricted ? { contentRating: { ytRating: 'ytAgeRestricted' } } : {}),
      },
    };

    const uploadRes = await youtube.videos.insert({
      part:        ['snippet', 'status'],
      requestBody: resource,
      media:       { body: createReadStream(entry.filePath) },
    });

    // The media upload overload types .data as Readable; cast back to Schema$Video
    const videoId = (uploadRes.data as youtube_v3.Schema$Video).id;
    if (!videoId) throw new Error('YouTube did not return a video ID after upload.');

    console.log(`[uploader] Upload complete: https://youtu.be/${videoId}`);

    // Thumbnail upload - non-fatal
    if (entry.thumbnailPath && existsSync(entry.thumbnailPath)) {
      try {
        const mimeType = entry.thumbnailPath.toLowerCase().endsWith('.png')
          ? 'image/png'
          : 'image/jpeg';
        await youtube.thumbnails.set({
          videoId,
          media: { mimeType, body: createReadStream(entry.thumbnailPath) },
        });
        console.log(`[uploader] Thumbnail uploaded for ${videoId}`);
      } catch (err) {
        console.warn('[uploader] Thumbnail upload failed (non-fatal):', err);
      }
    }

    // Caption upload - non-fatal
    if (entry.captionPath && existsSync(entry.captionPath)) {
      try {
        const mimeType = entry.captionPath.toLowerCase().endsWith('.vtt')
          ? 'text/vtt'
          : 'application/x-subrip';
        await youtube.captions.insert({
          part:        ['snippet'],
          requestBody: {
            snippet: {
              videoId,
              language: entry.captionLanguage ?? 'en',
              name:     'Subtitles',
              isDraft:  false,
            },
          },
          media: { mimeType, body: createReadStream(entry.captionPath) },
        });
        console.log(`[uploader] Captions uploaded for ${videoId}`);
      } catch (err) {
        console.warn('[uploader] Caption upload failed (non-fatal):', err);
      }
    }

    await moveToHistory({
      ...entry,
      status:           'done',
      youtubeVideoId:   videoId,
      errorMessage:     null,
      uploadFinishedAt: new Date().toISOString(),
    });

  } catch (err: any) {
    console.error(`[uploader] Upload failed for ${entry.fileName}:`, err);
    await moveToHistory({
      ...entry,
      status:           'failed',
      errorMessage:     err?.message ?? 'Unknown error',
      uploadFinishedAt: new Date().toISOString(),
    });
  }
}