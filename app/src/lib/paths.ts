// app/src/lib/paths.ts

import path from 'node:path';

const appRoot = path.resolve(process.cwd(), '..');

export const AUTH_DIR = path.resolve(appRoot, 'auth');
export const DATA_DIR = path.resolve(appRoot, 'data');
export const UPLOADS_DIR = path.resolve(appRoot, 'uploads');