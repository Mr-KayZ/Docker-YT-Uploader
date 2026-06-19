// app/src/pages/api/auth/start.ts
// This API route initiates the OAuth flow by redirecting the user to the Google authorization URL. It checks if the client secret is available, and if not, it redirects to the setup page.

import type { APIRoute } from 'astro';
import { createOAuthClient, SCOPES, hasClientSecret } from '../../../lib/auth';

// Handle GET requests to start the OAuth flow
export const GET: APIRoute = async () => {

  // If the client secret is not set up, redirect to the setup page
  if (!hasClientSecret()) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/setup' },
    });
  }

  // Create an OAuth client and generate the authorization URL
  const client  = await createOAuthClient();
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope:       SCOPES,
  });

  // Redirect the user to the Google authorization URL
  return new Response(null, {
    status: 302,
    headers: { Location: authUrl },
  });
};