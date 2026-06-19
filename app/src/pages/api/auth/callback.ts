// This API route handles the OAuth callback from Google after the user authorizes the app. It exchanges the authorization code for access tokens and saves them.

// Import necessary modules and functions
import type { APIRoute } from 'astro';
import { createOAuthClient, saveTokens, hasClientSecret } from '../../../lib/auth';

// Handle GET requests to process the OAuth callback
export const GET: APIRoute = async ({ url }) => {
  
  // Extract the authorization code and any error from the query parameters
  const code  = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  // If there was an error or no code was provided, redirect to the setup page with an error message
  if (error || !code) {
    return new Response(null, {
      status: 302,
      headers: { Location: `/setup?error=${encodeURIComponent(error ?? 'no_code')}` },
    });
  }

  // If the client secret is not set up, redirect to the setup page
  if (!hasClientSecret()) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/setup' },
    });
  }

  // Exchange the authorization code for access tokens and save them
  try {
    const client        = await createOAuthClient();
    const { tokens }    = await client.getToken(code);
    await saveTokens(tokens);

    // Successfully authenticated and saved tokens, redirect to the home page
    return new Response(null, {
      status: 302,
      headers: { Location: '/' },
    });
    // Note: We don't handle token exchange errors in detail here - if it fails, we just redirect back to setup with a generic error message. The user can then try the auth flow again.
  } catch (err) {
    console.error('[auth] Token exchange failed:', err);
    return new Response(null, {
      status: 302,
      headers: { Location: '/setup?error=token_exchange_failed' },
    });
  }
};