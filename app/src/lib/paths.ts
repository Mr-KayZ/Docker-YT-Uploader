// app/src/lib/paths.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// __dirname equivalent in ESM
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// lib/ -> src/ -> app/ -> repo root
const appRoot = path.resolve(__dirname, '../../..');

export const AUTH_DIR    = path.join(appRoot, 'auth');
export const DATA_DIR    = path.join(appRoot, 'data');
export const UPLOADS_DIR = path.join(appRoot, 'uploads');