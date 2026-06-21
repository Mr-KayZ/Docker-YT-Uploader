// app/src/lib/config.ts
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths.ts";

const CONFIG_PATH = path.join(DATA_DIR, "config.json");

/**
 * Normalise whatever the user typed into a clean base URL with no trailing slash.
 * Accepts any of:
 *   192.168.1.50          → http://192.168.1.50:4321
 *   192.168.1.50:4321     → http://192.168.1.50:4321
 *   http://192.168.1.50:4321/  → http://192.168.1.50:4321
 *   https://yt.myhost.com → https://yt.myhost.com
 */
export function normalisePublicUrl(raw: string): string {
  let s = raw.trim().replace(/\/+$/, ""); // strip trailing slashes

  // If no protocol prefix, add http:// so URL() can parse it
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;

  const u = new URL(s);

  // If user typed a bare IP with no explicit port, default to 4321
  if (!u.port) u.port = "4321";

  // Return just origin (protocol + host + port) - no path
  return u.origin;
}

export async function getPublicUrl(): Promise<string> {
  // 1. Saved via the setup UI
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(await readFile(CONFIG_PATH, "utf-8"));
      if (raw?.publicUrl) return raw.publicUrl;
    } catch {
      // corrupt file - fall through
    }
  }
  // 2. Env var (power users / CI)
  if (process.env.PUBLIC_URL) return normalisePublicUrl(process.env.PUBLIC_URL);
  // 3. Last resort
  return "http://localhost:4321";
}

export async function savePublicUrl(raw: string): Promise<void> {
  const publicUrl = normalisePublicUrl(raw);
  const existing = existsSync(CONFIG_PATH)
    ? (JSON.parse(await readFile(CONFIG_PATH, "utf-8")).catch?.(() => {}) ?? {})
    : {};
  await writeFile(
    CONFIG_PATH,
    JSON.stringify({ ...existing, publicUrl }, null, 2),
  );
}

export async function hasPublicUrl(): Promise<boolean> {
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = JSON.parse(await readFile(CONFIG_PATH, "utf-8"));
      if (raw?.publicUrl) return true;
    } catch {
      /* fall through */
    }
  }
  return !!process.env.PUBLIC_URL;
}

export async function getOAuthRedirectUri(): Promise<string> {
  return `${await getPublicUrl()}/api/auth/callback`;
}
