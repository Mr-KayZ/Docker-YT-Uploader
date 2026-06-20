// app/src/lib/mountConfig.ts
// Persists user-defined mount path overrides to /data/mount-config.json.
// paths.ts reads this file at startup; changes require a container restart to take effect.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

// DATA_DIR itself can't come from the file we're configuring, so read it from
// the env/default directly - this is the one path that must stay hardcoded.
const DATA_DIR = process.env.DATA_DIR ?? path.resolve(process.cwd(), "../data");
const CONFIG_PATH = path.join(DATA_DIR, "mount-config.json");

export interface MountConfig {
  videosDir?: string; // Override for the watched video folder
  authDir?: string; // Override for the auth credential folder
  dataDir?: string; // Override for the data/state folder
}

export async function loadMountConfig(): Promise<MountConfig> {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    const raw = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as MountConfig;
  } catch {
    return {};
  }
}

export async function saveMountConfig(config: MountConfig): Promise<void> {
  // Validate: paths must be absolute
  for (const [key, val] of Object.entries(config)) {
    if (val !== undefined && !path.isAbsolute(val as string)) {
      throw new Error(`${key} must be an absolute path (got: "${val}")`);
    }
  }

  // Ensure /data exists on first run (fresh container before scheduler has started)
  await mkdir(DATA_DIR, { recursive: true });

  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}
