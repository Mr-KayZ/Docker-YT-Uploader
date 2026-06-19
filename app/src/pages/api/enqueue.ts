// app/src/pages/api/enqueue.ts
// POST /api/enqueue - validate and queue a video for upload
// GET  /api/enqueue - return current queue + history

import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  addToQueue,
  getQueue,
  getHistory,
  type QueueEntry,
  type PrivacyStatus,
  type AudienceType,
} from '../../lib/queue.js';
import { validateEntry } from '../../lib/uploader.js';

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async () => {
  const [queue, history] = await Promise.all([getQueue(), getHistory()]);
  return json({ queue, history });
};

export const POST: APIRoute = async ({ request }) => {
  let thumbnailPath: string | null = null;
  let captionPath:   string | null = null;

  try {
    const form     = await request.formData();
    const fileName = form.get('fileName') as string | null;
    const title    = form.get('title')    as string | null;

    if (!fileName || !title?.trim())
      return json({ error: 'fileName and title are required.' }, 400);

    // Guard against path traversal
    const filePath = path.join('/uploads', path.basename(fileName));
    if (filePath !== path.join('/uploads', fileName))
      return json({ error: 'Invalid fileName.' }, 400);

    const description       = (form.get('description')      as string) ?? '';
    const tagsRaw           = (form.get('tags')              as string) ?? '';
    const categoryId        = (form.get('categoryId')        as string) ?? '22';
    const privacyStatus     = ((form.get('privacyStatus')    as string) ?? 'private') as PrivacyStatus;
    const publishAt         = (form.get('publishAt')         as string) || null;
    const audience          = ((form.get('audience')         as string) ?? 'general') as AudienceType;
    const language          = (form.get('language')          as string) ?? 'en';
    const scheduledUploadAt = (form.get('scheduledUploadAt') as string) || null;
    const captionLanguage   = (form.get('captionLanguage')   as string) || null;

    const tags = tagsRaw
      ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    // Build the entry first so we can validate before touching disk
    const entry: QueueEntry = {
      id:                      randomUUID(),
      filePath,
      fileName:                path.basename(fileName),
      queuedAt:                new Date().toISOString(),
      scheduledUploadAt,
      title:                   title.trim(),
      description,
      tags,
      categoryId,
      privacyStatus,
      publishAt,
      audience,
      selfDeclaredMadeForKids: audience === 'kids',
      ageRestricted:           audience === 'age_restricted',
      language,
      thumbnailPath:           null, // filled in below after validation
      captionPath:             null,
      captionLanguage,
      status:                  'queued',
      youtubeVideoId:          null,
      errorMessage:            null,
      uploadStartedAt:         null,
      uploadFinishedAt:        null,
    };

    // Validate before writing any files to disk
    const validationError = validateEntry(entry);
    if (validationError)
      return json({ error: validationError }, 422);

    // Save thumbnail
    const thumbFile = form.get('thumbnail') as File | null;
    if (thumbFile && thumbFile.size > 0) {
      const ext = path.extname(thumbFile.name).toLowerCase() || '.jpg';
      thumbnailPath = path.join('/data', 'thumbnails', `${entry.id}${ext}`);
      await writeFile(thumbnailPath, Buffer.from(await thumbFile.arrayBuffer()));
      entry.thumbnailPath = thumbnailPath;
    }

    // Save caption
    const capFile = form.get('caption') as File | null;
    if (capFile && capFile.size > 0) {
      const ext = path.extname(capFile.name).toLowerCase() || '.srt';
      captionPath = path.join('/data', 'captions', `${entry.id}${ext}`);
      await writeFile(captionPath, Buffer.from(await capFile.arrayBuffer()));
      entry.captionPath = captionPath;
    }

    await addToQueue(entry);

    const message = scheduledUploadAt
      ? 'Queued for scheduled upload.'
      : 'Queued - upload will begin shortly.';

    return json({ message, id: entry.id }, 202);

  } catch (err: any) {
    // Clean up any files already written if something went wrong
    await Promise.allSettled([
      thumbnailPath ? unlink(thumbnailPath) : Promise.resolve(),
      captionPath   ? unlink(captionPath)   : Promise.resolve(),
    ]);
    console.error('[enqueue API] Error:', err);
    return json({ error: err?.message ?? 'Internal server error.' }, 500);
  }
};