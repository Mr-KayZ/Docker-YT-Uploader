// app/src/pages/api/auth/start.ts
// Initiates the Google OAuth2 flow - redirects to Google's consent screen.

import type { APIRoute } from "astro";
import {
  createOAuthClient,
  SCOPES,
  hasClientSecret,
} from "../../../lib/auth.ts";

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { Location: location } });

export const GET: APIRoute = async () => {
  if (!hasClientSecret()) return redirect("/setup");

  try {
    const client = await createOAuthClient();
    const authUrl = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: SCOPES,
    });
    return redirect(authUrl);
  } catch (err) {
    console.error("[auth] Failed to generate auth URL:", err);
    return redirect("/setup?error=auth_init_failed");
  }
};
