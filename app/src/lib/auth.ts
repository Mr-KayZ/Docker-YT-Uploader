// app/src/lib/auth.ts
// Google OAuth2 authentication for the YouTube Uploader app.

import { google } from 'googleapis';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const AUTH_DIR     = '/auth';
const SECRET_PATH  = path.join(AUTH_DIR, 'client_secret.json');
const TOKENS_PATH  = path.join(AUTH_DIR, 'tokens.json');
const REDIRECT_URI = 'http://localhost:4321/api/auth/callback';

export const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

// Directory init
// ------------------------------------------------------------------------------------------------
export async function ensureAuthDir(): Promise<void> {
  // mkdir with recursive:true is a no-op if the directory already exists
  await mkdir(AUTH_DIR, { recursive: true });
}

// Presence checks
// ------------------------------------------------------------------------------------------------
export function hasClientSecret(): boolean {
  return existsSync(SECRET_PATH);
}

export function hasTokens(): boolean {
  return existsSync(TOKENS_PATH);
}

// Client secret
// ------------------------------------------------------------------------------------------------
export async function loadClientSecret() {
  const raw    = await readFile(SECRET_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  // Google downloads credentials as either { installed: ... } or { web: ... }
  return parsed.installed ?? parsed.web;
}

export async function saveClientSecret(content: string): Promise<void> {
  const parsed = JSON.parse(content);
  const creds  = parsed.installed ?? parsed.web;
  if (!creds?.client_id || !creds?.client_secret) {
    throw new Error('Invalid client_secret.json - missing client_id or client_secret');
  }
  await ensureAuthDir();
  await writeFile(SECRET_PATH, content, 'utf-8');
}

// OAuth2 client
// ------------------------------------------------------------------------------------------------
export async function createOAuthClient() {
  const { client_id, client_secret } = await loadClientSecret();
  return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

export async function getAuthenticatedClient() {
  const client = await createOAuthClient();
  const raw    = await readFile(TOKENS_PATH, 'utf-8');
  const tokens = JSON.parse(raw);

  // Sanity-check: a stored token set must have a refresh_token to be usable
  if (!tokens?.refresh_token) {
    throw new Error(
      'tokens.json is missing a refresh_token - please re-authenticate.'
    );
  }

  client.setCredentials(tokens);

  // Auto-save rotated tokens. Read fresh from disk first to avoid the stale
  // closure problem (a concurrent request may have already updated tokens.json).
  client.once('tokens', async (newTokens) => {
    try {
      const current = JSON.parse(await readFile(TOKENS_PATH, 'utf-8'));
      await writeFile(
        TOKENS_PATH,
        JSON.stringify({ ...current, ...newTokens }, null, 2)
      );
      console.log('[auth] Tokens refreshed and saved.');
    } catch (err) {
      console.error('[auth] Failed to save refreshed tokens:', err);
    }
  });

  return client;
}

// Token persistence
// ------------------------------------------------------------------------------------------------
export async function saveTokens(tokens: object): Promise<void> {
  await ensureAuthDir();
  await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}