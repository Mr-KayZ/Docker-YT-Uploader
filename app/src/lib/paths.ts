// app/src/lib/paths.ts
// Resolves runtime paths for videos, auth, and data directories.
// Priority order:
//   1. /data/mount-config.json   (user-configured via the setup UI)
//   2. Environment variables     (set in docker-compose.yml)
//   3. Hardcoded dev defaults    (sibling folders relative to /app)

import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

// DATA_DIR has no override layer - it's always env-var or default.
export const DATA_DIR =
  process.env.DATA_DIR ?? path.resolve(process.cwd(), '../data');

// Load user config synchronously at module init (startup cost is negligible).
const CONFIG_PATH = path.join(DATA_DIR, 'mount-config.json');
let userConfig: { videosDir?: string; authDir?: string } = {};

if (existsSync(CONFIG_PATH)) {
  try {
    userConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    console.warn('[paths] Failed to parse mount-config.json - using defaults.');
  }
}

export const VIDEOS_DIR =
  userConfig.videosDir ??
  process.env.VIDEOS_DIR ??
  path.resolve(process.cwd(), '../videos');

export const AUTH_DIR =
  userConfig.authDir ??
  process.env.AUTH_DIR ??
  path.resolve(process.cwd(), '../auth');