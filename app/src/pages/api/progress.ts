// app/src/pages/api/progress.ts
// GET /api/progress - returns the currently uploading entry's progress, or null if idle.

import type { APIRoute } from "astro";
import { getQueue } from "../../lib/queue.ts";

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export const GET: APIRoute = async () => {
  const queue = await getQueue();
  const uploading = queue.find((e) => e.status === "uploading") ?? null;

  if (!uploading) {
    return json({ active: false });
  }

  const { fileName, bytesUploaded, totalBytes, uploadStartedAt } = uploading;

  // Compute upload speed (bytes/sec) from elapsed time
  let speedBps: number | null = null;
  if (uploadStartedAt && bytesUploaded != null && bytesUploaded > 0) {
    const elapsedSec = (Date.now() - new Date(uploadStartedAt).getTime()) / 1000;
    if (elapsedSec > 0) speedBps = bytesUploaded / elapsedSec;
  }

  return json({
    active: true,
    fileName,
    bytesUploaded: bytesUploaded ?? 0,
    totalBytes: totalBytes ?? 0,
    percent:
      totalBytes && totalBytes > 0
        ? Math.min(100, Math.round(((bytesUploaded ?? 0) / totalBytes) * 100))
        : 0,
    speedBps,
  });
};