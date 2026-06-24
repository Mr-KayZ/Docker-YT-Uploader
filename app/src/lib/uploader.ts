// app/src/lib/uploader.ts
// Handles core upload logic: validating entries, uploading videos to YouTube, and
// updating queue/history status accordingly.
// Uses resumable upload sessions for large-file safety and live progress tracking.

import { google } from "googleapis";
import type { youtube_v3 } from "googleapis";
import { createReadStream, statSync } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import https from "node:https";
import http from "node:http";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getAuthenticatedClient } from "./auth.ts";
import { type QueueEntry, updateQueueEntry, moveToHistory } from "./queue.ts";

export const YT_CATEGORIES: Record<string, string> = {
  "1": "Film & Animation",
  "2": "Autos & Vehicles",
  "10": "Music",
  "15": "Pets & Animals",
  "17": "Sports",
  "19": "Travel & Events",
  "20": "Gaming",
  "22": "People & Blogs",
  "23": "Comedy",
  "24": "Entertainment",
  "25": "News & Politics",
  "26": "Howto & Style",
  "27": "Education",
  "28": "Science & Technology",
  "29": "Nonprofits & Activism",
};

const MAX_TITLE_LEN = 100;
const MAX_DESCRIPTION_LEN = 5000;
const MAX_FILE_BYTES = 128 * 1024 * 1024 * 1024; // 128 GB

// How often (in bytes) to write progress to queue.json.
// 4 MB chunks = ~every few seconds on a fast LAN, not spammy on disk.
const PROGRESS_WRITE_INTERVAL_BYTES = 4 * 1024 * 1024;

// Returns an error string if the entry is invalid, null if valid.
export function validateEntry(entry: QueueEntry): string | null {
  if (!entry.title.trim()) return "Title is required.";
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
  if (size > MAX_FILE_BYTES) return `File exceeds YouTube's 128 GB limit.`;

  return null;
}

// Initiates a resumable upload session with YouTube and returns the session URI.
async function initiateResumableSession(
  auth: any,
  resource: youtube_v3.Schema$Video,
  fileSize: number,
): Promise<string> {
  // Get a fresh access token from the auth client
  const tokenResponse = await auth.getAccessToken();
  const accessToken = tokenResponse.token ?? tokenResponse.res?.data?.access_token;
  if (!accessToken) throw new Error("Failed to obtain access token for resumable upload.");

  const metadata = JSON.stringify({
    snippet: resource.snippet,
    status: resource.status,
  });

  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/*",
        "X-Upload-Content-Length": String(fileSize),
      },
      body: metadata,
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Resumable session initiation failed (${response.status}): ${errText}`);
  }

  const sessionUri = response.headers.get("location");
  if (!sessionUri) throw new Error("YouTube did not return a resumable session URI.");

  return sessionUri;
}

// Streams the video file to the resumable session URI, writing progress periodically.
async function streamFileToSession(
  sessionUri: string,
  filePath: string,
  fileSize: number,
  onProgress: (bytesUploaded: number) => Promise<void>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = new URL(sessionUri);
    const transport = url.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "PUT",
        headers: {
          "Content-Type": "video/*",
          "Content-Length": String(fileSize),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        res.on("end", () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try {
              const parsed = JSON.parse(body);
              if (!parsed.id) {
                reject(new Error("YouTube did not return a video ID."));
              } else {
                resolve(parsed.id as string);
              }
            } catch {
              reject(new Error(`Failed to parse YouTube response: ${body}`));
            }
          } else {
            reject(new Error(`Upload PUT failed (${res.statusCode}): ${body}`));
          }
        });
      },
    );

    req.on("error", reject);

    // Progress-tracking Transform stream
    let bytesSent = 0;
    let bytesAtLastWrite = 0;

    const tracker = new Transform({
      transform(chunk, _encoding, callback) {
        bytesSent += chunk.length;
        this.push(chunk);

        // Write progress to queue.json at intervals to avoid hammering disk
        if (bytesSent - bytesAtLastWrite >= PROGRESS_WRITE_INTERVAL_BYTES) {
          bytesAtLastWrite = bytesSent;
          onProgress(bytesSent).catch(() => {});
        }

        callback();
      },
      flush(callback) {
        // Final progress write when stream ends
        onProgress(bytesSent).catch(() => {});
        callback();
      },
    });

    const fileStream = createReadStream(filePath);
    fileStream.pipe(tracker).pipe(req);

    fileStream.on("error", reject);
    tracker.on("error", reject);
  });
}

// Uploads a single queue entry to YouTube using a resumable session.
export async function uploadEntry(entry: QueueEntry): Promise<void> {
  const validationError = validateEntry(entry);
  if (validationError) {
    await moveToHistory({
      ...entry,
      status: "failed",
      errorMessage: validationError,
      uploadFinishedAt: new Date().toISOString(),
    });
    return;
  }

  const fileSize = statSync(entry.filePath).size;

  await updateQueueEntry(entry.id, {
    status: "uploading",
    uploadStartedAt: new Date().toISOString(),
    bytesUploaded: 0,
    totalBytes: fileSize,
  });

  // Core upload logic
  try {
    const auth = await getAuthenticatedClient();
    const youtube = google.youtube({ version: "v3", auth });

    const resource: youtube_v3.Schema$Video = {
      snippet: {
        title: entry.title.trim(),
        description: entry.description,
        tags: entry.tags,
        categoryId: entry.categoryId,
        defaultLanguage: entry.language || "en",
      },
      status: {
        privacyStatus: entry.publishAt ? "private" : entry.privacyStatus,
        selfDeclaredMadeForKids: entry.selfDeclaredMadeForKids,
        ...(entry.publishAt ? { publishAt: entry.publishAt } : {}),
        ...(entry.ageRestricted
          ? { contentRating: { ytRating: "ytAgeRestricted" } }
          : {}),
      },
    };

    // Step 1: Initiate resumable session
    console.log(`[uploader] Initiating resumable session for ${entry.fileName} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);
    const sessionUri = await initiateResumableSession(auth, resource, fileSize);

    // Step 2: Stream file with progress tracking
    console.log(`[uploader] Streaming to resumable session: ${entry.fileName}`);
    const videoId = await streamFileToSession(
      sessionUri,
      entry.filePath,
      fileSize,
      async (bytesUploaded) => {
        await updateQueueEntry(entry.id, { bytesUploaded });
      },
    );

    console.log(`[uploader] Upload complete: https://youtu.be/${videoId}`);

    // Thumbnail upload - non-fatal
    if (entry.thumbnailPath && existsSync(entry.thumbnailPath)) {
      try {
        const mimeType = entry.thumbnailPath.toLowerCase().endsWith(".png")
          ? "image/png"
          : "image/jpeg";
        await youtube.thumbnails.set({
          videoId,
          media: { mimeType, body: createReadStream(entry.thumbnailPath) },
        });
        console.log(`[uploader] Thumbnail uploaded for ${videoId}`);
      } catch (err) {
        console.warn("[uploader] Thumbnail upload failed (non-fatal):", err);
      }
    }

    // Caption upload - non-fatal
    if (entry.captionPath && existsSync(entry.captionPath)) {
      try {
        const mimeType = entry.captionPath.toLowerCase().endsWith(".vtt")
          ? "text/vtt"
          : "application/x-subrip";
        await youtube.captions.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              videoId,
              language: entry.captionLanguage ?? "en",
              name: "Subtitles",
              isDraft: false,
            },
          },
          media: { mimeType, body: createReadStream(entry.captionPath) },
        });
        console.log(`[uploader] Captions uploaded for ${videoId}`);
      } catch (err) {
        console.warn("[uploader] Caption upload failed (non-fatal):", err);
      }
    }

    await moveToHistory({
      ...entry,
      status: "done",
      youtubeVideoId: videoId,
      bytesUploaded: fileSize,
      totalBytes: fileSize,
      errorMessage: null,
      uploadFinishedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[uploader] Upload failed for ${entry.fileName}:`, err);
    await moveToHistory({
      ...entry,
      status: "failed",
      errorMessage: err?.message ?? "Unknown error",
      uploadFinishedAt: new Date().toISOString(),
    });
  }
}
