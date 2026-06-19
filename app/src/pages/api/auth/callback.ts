// app/src/pages/api/auth/callback.ts
// Handles the Google OAuth2 callback - exchanges the auth code for tokens and saves them.

import type { APIRoute } from 'astro';
import { createOAuthClient, saveTokens } from '../../../lib/auth.js';

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { Location: location } });

export const GET: APIRoute = async ({ url }) => {
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code)
    return redirect(`/setup?error=${encodeURIComponent(error ?? 'no_code')}`);

  try {
    const client     = await createOAuthClient();
    const { tokens } = await client.getToken(code);
    await saveTokens(tokens);
    return redirect('/');
  } catch (err) {
    console.error('[auth] Token exchange failed:', err);
    return redirect('/setup?error=token_exchange_failed');
  }
};