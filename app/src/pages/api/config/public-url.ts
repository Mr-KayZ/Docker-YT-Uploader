// app/src/pages/api/config/public-url.ts
// API route for getting and setting the public URL of the app.

import type { APIRoute } from "astro";
import { getPublicUrl, savePublicUrl, normalisePublicUrl } from "../../../lib/config.ts";

export const GET: APIRoute = async () => {
  const url = await getPublicUrl();
  return new Response(JSON.stringify({ publicUrl: url }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { publicUrl } = await request.json();
    if (!publicUrl || typeof publicUrl !== "string" || !publicUrl.trim()) {
      return new Response(JSON.stringify({ ok: false, error: "publicUrl is required." }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const normalised = normalisePublicUrl(publicUrl);
    await savePublicUrl(normalised);
    return new Response(JSON.stringify({ ok: true, publicUrl: normalised }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};