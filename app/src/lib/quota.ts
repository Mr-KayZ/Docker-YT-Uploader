// app/src/lib/quota.ts
// Local quota tracker - the YouTube Data API does not expose usage programmatically.
// We track it ourselves: each successful upload costs 1,600 units.
// Resets daily at midnight UTC. Stored in /data/quota.json.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths.ts";

const DAILY_LIMIT = 10_000;
const UPLOAD_COST = 1_600;

interface QuotaStore {
  date: string; // YYYY-MM-DD UTC
  used: number;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function quotaPath(): string {
  return path.join(DATA_DIR, "quota.json");
}

function load(): QuotaStore {
  const p = quotaPath();
  if (!existsSync(p)) return { date: todayUTC(), used: 0 };
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as QuotaStore;
    // Reset counter if it's a new UTC day
    if (raw.date !== todayUTC()) return { date: todayUTC(), used: 0 };
    return raw;
  } catch {
    return { date: todayUTC(), used: 0 };
  }
}

function save(store: QuotaStore): void {
  // Ensure /data exists (it always should, but be safe)
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(quotaPath(), JSON.stringify(store, null, 2));
}

/** Call once after each successful upload completes. */
export function recordUpload(): void {
  const store = load();
  store.used += UPLOAD_COST;
  save(store);
}

/** Returns current quota usage for the UI. */
export function getQuotaStatus(): { used: number; limit: number; remaining: number } {
  const store = load();
  return {
    used: store.used,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - store.used),
  };
}