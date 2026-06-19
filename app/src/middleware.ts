// app/src/middleware.ts
// This middleware checks if the user is authenticated (i.e., has valid tokens) before allowing access to protected routes. If not authenticated, it redirects the user to the setup page. It also allows certain public routes to be accessed without authentication.

import { defineMiddleware } from 'astro:middleware';
import { hasTokens, hasClientSecret } from './lib/auth';

// Routes that are always accessible regardless of auth state
const PUBLIC_PATHS = [
  '/setup',
  '/api/setup/upload',
  '/api/auth/start',
  '/api/auth/callback',
];

// Define the middleware function to check authentication
export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;

  // Always allow public paths through
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return next();
  }

  // Redirect to setup if not authenticated
  if (!hasTokens()) {
    return new Response(null, {
      status: 302,
      headers: { Location: '/setup' },
    });
  }

  return next();
});