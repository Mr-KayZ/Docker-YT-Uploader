// app/src/lib/config.ts
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths.ts";

const CONFIG_PATH = path.join(DATA_DIR, "config.json");

type AppConfig = {
  publicUrl?: string;
};

function isIpAddress(hostname: string): boolean {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  if (/^\[?[a-fA-F0-9:]+\]?$/.test(hostname) && hostname.includes(":"))
    return true;
  return false;
}

function isValidRedirectHost(hostname: string): boolean {
  const host = hostname.toLowerCase();

  // Explicitly allow localhost for same-machine development/use
  if (host === "localhost") return true;

  // Reject raw IPs (Google OAuth web app redirect URIs do not allow these)
  if (isIpAddress(host)) return false;

  // Reject .local hostnames for OAuth redirect usage
  if (host.endsWith(".local")) return false;

  // Require something domain-like: at least one dot and sensible labels
  if (!host.includes(".")) return false;

  const labels = host.split(".");
  return labels.every(
    (label) =>
      /^[a-z0-9-]+$/i.test(label) &&
      !label.startsWith("-") &&
      !label.endsWith("-"),
  );
}

/**
 * Normalize and validate the externally reachable base URL used for OAuth callbacks.
 *
 * Allowed:
 *   localhost                          -> http://localhost:4321
 *   http://localhost                   -> http://localhost:4321
 *   myuploader.duckdns.org             -> https://myuploader.duckdns.org:4321
 *   https://myuploader.duckdns.org     -> https://myuploader.duckdns.org:4321
 *   https://yt.myhost.com:8443         -> https://yt.myhost.com:8443
 *
 * Rejected:
 *   192.168.1.40
 *   http://192.168.1.40:4321
 *   yt-uploader.local
 */
export function normalisePublicUrl(raw: string): string {
  const input = raw.trim();
  if (!input) throw new Error("Server address is required.");

  let candidate = input.replace(/\/+$/, "");

  // If no protocol is provided:
  // - localhost defaults to http
  // - real domains default to https
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = candidate.toLowerCase().startsWith("localhost")
      ? `http://${candidate}`
      : `https://${candidate}`;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(
      "Enter a valid server address, such as localhost or https://yt.myhost.com.",
    );
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https server addresses are supported.");
  }

  if (!isValidRedirectHost(url.hostname)) {
    throw new Error(
      "Use localhost for local setup, or a real domain name such as https://yt.myhost.com. IP addresses and .local domains are not supported for Google OAuth redirects.",
    );
  }

  // Remove this block entirely for now - no TLS cert, http is correct for LAN use
  // if (url.hostname !== "localhost" && url.protocol !== "https:") {
  //   url.protocol = "https:";
  // }

  if (!url.port) {
    url.port = "4321";
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.origin;
}

export async function loadConfig(): Promise<AppConfig> {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as AppConfig;
  } catch {
    return {};
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * Returns the validated public URL, or null if nothing is configured yet.
 *
 * Safe to call during setup page load - will NOT throw when PUBLIC_URL is
 * absent or when the container is running on a NAS with no env var set.
 * Will still throw if a value IS present but fails validation (IP, .local, etc.)
 * so misconfiguration is still surfaced immediately.
 *
 * Use this in setup.astro. Use requirePublicUrl() / getPublicUrl() everywhere else.
 */
export async function tryGetPublicUrl(): Promise<string | null> {
  const config = await loadConfig();

  if (config.publicUrl) {
    return normalisePublicUrl(config.publicUrl); // stored - validate and return
  }

  if (process.env.PUBLIC_URL) {
    return normalisePublicUrl(process.env.PUBLIC_URL); // env var - validate and return
  }

  return null; // nothing configured yet - safe, no throw
}

/**
 * Returns the validated public URL.
 * Falls back to http://localhost:4321 when nothing is configured.
 *
 * Use this anywhere a URL is needed but localhost is an acceptable fallback
 * (e.g. display purposes, non-OAuth routes).
 */
export async function getPublicUrl(): Promise<string> {
  return (await tryGetPublicUrl()) ?? "http://localhost:4321";
}

/**
 * Returns the validated public URL.
 * Throws if nothing is configured or if the configured value is invalid.
 *
 * Use this in auth.ts and anywhere the OAuth redirect URI is constructed -
 * places where a missing URL is a hard error, not a recoverable state.
 */
export async function requirePublicUrl(): Promise<string> {
  const url = await tryGetPublicUrl();
  if (!url) {
    throw new Error(
      "No server address configured. Complete Step 1 of the setup page before authenticating.",
    );
  }
  return url;
}

export async function hasPublicUrl(): Promise<boolean> {
  const config = await loadConfig();
  return !!(config.publicUrl || process.env.PUBLIC_URL);
}

export async function savePublicUrl(raw: string): Promise<string> {
  const publicUrl = normalisePublicUrl(raw);
  const config = await loadConfig();
  config.publicUrl = publicUrl;
  await saveConfig(config);
  return publicUrl;
}

export async function getOAuthRedirectUri(): Promise<string> {
  const base = await requirePublicUrl(); // OAuth URI needs a real URL - throws if missing
  return `${base}/api/auth/callback`;
}
