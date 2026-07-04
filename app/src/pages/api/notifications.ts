// app/src/pages/api/notifications.ts
// API route for fetching recent notifications, such as upload completion messages.

import type { APIRoute } from "astro";
import { getRecentNotifications } from "../../lib/notifications.ts";

export const GET: APIRoute = async ({ url }) => {
  const limitParam = Number(url.searchParams.get("limit") ?? "20");
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 100)
    : 20;

  const notifications = await getRecentNotifications(limit);

  return new Response(JSON.stringify({ notifications }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
};