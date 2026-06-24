// app/src/pages/api/youtube-meta.ts
// GET /api/youtube-meta?videoId=xxx
// Returns live YouTube metadata for a completed upload (read-only view).
// Costs 1 quota unit (videos.list).

import type { APIRoute } from "astro";
import { google } from "googleapis";
import { getAuthenticatedClient } from "../../lib/auth.ts";

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const videoId = url.searchParams.get("videoId");
  if (!videoId) return json({ error: "videoId is required" }, 400);

  try {
    const auth = await getAuthenticatedClient();
    const youtube = google.youtube({ version: "v3", auth });

    const res = await youtube.videos.list({
      part: ["snippet", "status", "statistics"],
      id: [videoId],
    });

    const video = res.data.items?.[0];
    if (!video) return json({ error: "Video not found on YouTube" }, 404);

    return json({
      id: video.id,
      title: video.snippet?.title ?? "",
      description: video.snippet?.description ?? "",
      tags: video.snippet?.tags ?? [],
      categoryId: video.snippet?.categoryId ?? "",
      publishedAt: video.snippet?.publishedAt ?? "",
      privacyStatus: video.status?.privacyStatus ?? "",
      viewCount: video.statistics?.viewCount ?? "0",
      likeCount: video.statistics?.likeCount ?? "0",
      youtubeUrl: `https://youtu.be/${video.id}`,
    });
  } catch (err: any) {
    console.error("[youtube-meta] Failed to fetch video metadata:", err);
    return json(
      { error: err?.message ?? "Failed to fetch video metadata" },
      500,
    );
  }
};
