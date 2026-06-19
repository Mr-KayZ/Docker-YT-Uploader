// app/src/lib/auth.ts
// This module handles Google OAuth2 authentication for the YouTube Uploader app.

import { google } from 'googleapis';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const AUTH_DIR         = '/auth';
const SECRET_PATH      = path.join(AUTH_DIR, 'client_secret.json');
const TOKENS_PATH      = path.join(AUTH_DIR, 'tokens.json');
const REDIRECT_URI     = 'http://localhost:4321/api/auth/callback';

// Define the scopes required for YouTube API access
export const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly',
];

export function hasClientSecret(): boolean {
  return existsSync(SECRET_PATH);
}

export function hasTokens(): boolean {
  return existsSync(TOKENS_PATH);
}

// Load the client secret from the JSON file
export async function loadClientSecret() {
  const raw = await readFile(SECRET_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  // Google downloads credentials as either { installed: ... } or { web: ... }
  return parsed.installed ?? parsed.web;
}

// Create an OAuth2 client using the loaded client secret
export async function createOAuthClient() {
  const { client_id, client_secret } = await loadClientSecret();
  return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

// Get an authenticated OAuth2 client, loading tokens from file and setting up auto-refresh
export async function getAuthenticatedClient() {
  const client = await createOAuthClient();
  const raw    = await readFile(TOKENS_PATH, 'utf-8');
  const tokens = JSON.parse(raw);
  client.setCredentials(tokens);

  // Auto-save refreshed tokens if Google rotates them
  client.on('tokens', async (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    await writeFile(TOKENS_PATH, JSON.stringify(merged, null, 2));
    console.log('[auth] Tokens refreshed and saved.');
  });

  return client;
}

export async function saveTokens(tokens: object) {
  await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

// Clear all authentication data (for testing or re-authentication purposes)
export async function saveClientSecret(content: string) {
  // Validate it's a real Google credential file before saving
  const parsed = JSON.parse(content);
  const creds  = parsed.installed ?? parsed.web;

  if (!creds?.client_id || !creds?.client_secret) {
    throw new Error('Invalid client_secret.json - missing client_id or client_secret');
  }

  // Ensure the auth directory exists
  await writeFile(SECRET_PATH, content, 'utf-8');
}