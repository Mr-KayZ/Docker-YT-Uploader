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
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true; // IPv4
  if (/^\[?[a-fA-F0-9:]+\]?$/.test(hostname) && hostname.includes(":")) return true; // IPv6-ish
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
  return labels.every((label) => /^[a-z0-9-]+$/i.test(label) && !label.startsWith("-") && !label.endsWith("-"));
}

/**
 * Normalize and validate the externally reachable base URL used for OAuth callbacks.
 *
 * Allowed examples:
 *   localhost                          -> http://localhost:4321
 *   http://localhost                   -> http://localhost:4321
 *   myuploader.duckdns.org             -> https://myuploader.duckdns.org:4321
 *   https://myuploader.duckdns.org     -> https://myuploader.duckdns.org:4321
 *   https://yt.myhost.com:8443         -> https://yt.myhost.com:8443
 *
 * Rejected examples:
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
    throw new Error("Enter a valid server address, such as localhost or https://yt.myhost.com.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only http and https server addresses are supported.");
  }

  if (!isValidRedirectHost(url.hostname)) {
    throw new Error(
      "Use localhost for local setup, or a real domain name such as https://yt.myhost.com. IP addresses and .local domains are not supported for Google OAuth redirects.",
    );
  }

  // Localhost may use http; real domains should use https
  if (url.hostname !== "localhost" && url.protocol !== "https:") {
    url.protocol = "https:";
  }

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

export async function getPublicUrl(): Promise<string> {
  const config = await loadConfig();

  if (config.publicUrl) {
    return normalisePublicUrl(config.publicUrl);
  }

  if (process.env.PUBLIC_URL) {
    return normalisePublicUrl(process.env.PUBLIC_URL);
  }

  return "http://localhost:4321";
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
  const base = await getPublicUrl();
  return `${base}/api/auth/callback`;
}