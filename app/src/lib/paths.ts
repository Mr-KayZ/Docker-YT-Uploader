// app/src/lib/paths.ts
import path from 'node:path';

// Docker sets these explicitly via docker-compose environment block.
// Local dev falls back to sibling folders at the repo root (one level above /app).
export const AUTH_DIR    = process.env.AUTH_DIR    ?? path.resolve(process.cwd(), '../auth');
export const DATA_DIR    = process.env.DATA_DIR    ?? path.resolve(process.cwd(), '../data');
export const VIDEOS_DIR  = process.env.VIDEOS_DIR  ?? path.resolve(process.cwd(), '../videos');