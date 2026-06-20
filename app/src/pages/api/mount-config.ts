// app/src/pages/api/mount-config.ts
// GET  /api/mount-config  — returns current active paths + whether they are user-overridden
// POST /api/mount-config  — saves new paths to /data/mount-config.json

import type { APIRoute } from "astro";
import { VIDEOS_DIR, AUTH_DIR, DATA_DIR } from "../../lib/paths.js";
import { loadMountConfig, saveMountConfig } from "../../lib/mountConfig.js";

export const GET: APIRoute = async () => {
  const saved = await loadMountConfig();
  return new Response(
    JSON.stringify({
      active: { videosDir: VIDEOS_DIR, authDir: AUTH_DIR, dataDir: DATA_DIR },
      saved,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as {
      videosDir?: string;
      authDir?: string;
      dataDir?: string;
    };

    // Strip empty strings — treat blank submission as "use default"
    const config = {
      videosDir: body.videosDir?.trim() || undefined,
      authDir:   body.authDir?.trim()   || undefined,
      dataDir:   body.dataDir?.trim()   || undefined,
    };

    await saveMountConfig(config);

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Mount config saved. Restart the container for changes to take effect.",
        saved: config,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
};