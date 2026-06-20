// app/src/lib/videoMeta.ts
// Reads and validates a .meta.json sidecar file alongside a video file.
// Named videoMeta.ts to avoid collision with the API route at pages/api/meta.ts.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface VideoMeta {
  title?: string;
  description?: string;
  tags?: string[]; // YouTube allows up to 500 chars total across all tags
  privacy?: "public" | "private" | "unlisted";
  categoryId?: string; // YouTube numeric category ID as string, e.g. "22"
  language?: string; // BCP-47 language code, e.g. "en"
  audience?: "general" | "kids" | "age_restricted";
}

/** Returns the expected sidecar path for a given video file path. */
export function metaPathFor(videoPath: string): string {
  const ext = path.extname(videoPath);
  return videoPath.slice(0, -ext.length) + ".meta.json";
}

/** Returns true if a sidecar file exists alongside the given video path. */
export function hasMeta(videoPath: string): boolean {
  return existsSync(metaPathFor(videoPath));
}

/** Returns parsed + sanitised metadata if a sidecar exists, or null if not. */
export async function loadVideoMeta(
  videoPath: string,
): Promise<VideoMeta | null> {
  const metaPath = metaPathFor(videoPath);
  if (!existsSync(metaPath)) return null;

  try {
    const raw = await readFile(metaPath, "utf-8");
    const parsed = JSON.parse(raw) as VideoMeta;

    const VALID_PRIVACY = new Set(["public", "private", "unlisted"]);
    const VALID_AUDIENCE = new Set(["general", "kids", "age_restricted"]);

    return {
      title: typeof parsed.title === "string" ? parsed.title.trim() : undefined,
      description:
        typeof parsed.description === "string"
          ? parsed.description.trim()
          : undefined,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim())
        : undefined,
      privacy: VALID_PRIVACY.has(parsed.privacy as string)
        ? parsed.privacy
        : undefined,
      categoryId:
        typeof parsed.categoryId === "string"
          ? parsed.categoryId.trim()
          : undefined,
      language:
        typeof parsed.language === "string"
          ? parsed.language.trim()
          : undefined,
      audience: VALID_AUDIENCE.has(parsed.audience as string)
        ? parsed.audience
        : undefined,
    };
  } catch (err) {
    console.warn(
      `[videoMeta] Failed to parse sidecar for ${path.basename(videoPath)}:`,
      err,
    );
    return null;
  }
}
