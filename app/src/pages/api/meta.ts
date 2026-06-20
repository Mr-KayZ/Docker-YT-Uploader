// app/src/pages/api/meta.ts
// GET /api/meta?file=my-video.mp4
// Returns the parsed .meta.json sidecar for a given video file, or {} if none exists.

import type { APIRoute } from "astro";
import path from "node:path";
import { VIDEOS_DIR } from "../../lib/paths.ts";
import { loadVideoMeta } from "../../lib/videoMeta.ts";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const fileName = url.searchParams.get("file");

  if (!fileName) {
    return new Response(JSON.stringify({ error: "Missing file parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Guard against path traversal
  const safeName = path.basename(fileName);
  const videoPath = path.join(VIDEOS_DIR, safeName);

  const meta = await loadVideoMeta(videoPath);

  return new Response(JSON.stringify(meta ?? {}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
