// app/src/lib/notifications.ts
// Handles storing and retrieving notifications for the app, such as upload completion messages.

import { promises as fs } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./paths.ts";

export type AppNotification = {
  id: string;
  type: "upload_complete";
  level: "success";
  title: string;
  message: string;
  videoTitle: string;
  youtubeUrl: string;
  createdAt: string;
};

const NOTIFICATIONS_FILE = path.join(DATA_DIR, "notifications.json");
const MAX_NOTIFICATIONS = 100;

async function ensureNotificationsFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(NOTIFICATIONS_FILE);
  } catch {
    await fs.writeFile(NOTIFICATIONS_FILE, "[]", "utf-8");
  }
}

export async function readNotifications(): Promise<AppNotification[]> {
  await ensureNotificationsFile();

  try {
    const raw = await fs.readFile(NOTIFICATIONS_FILE, "utf-8");
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

async function writeNotifications(
  notifications: AppNotification[],
): Promise<void> {
  await ensureNotificationsFile();
  await fs.writeFile(
    NOTIFICATIONS_FILE,
    JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS), null, 2),
    "utf-8",
  );
}

export async function addNotification(
  notification: Omit<AppNotification, "id" | "createdAt">,
): Promise<AppNotification> {
  const next: AppNotification = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...notification,
  };

  const existing = await readNotifications();
  existing.unshift(next);
  await writeNotifications(existing);

  return next;
}

export async function getRecentNotifications(
  limit = 20,
): Promise<AppNotification[]> {
  const notifications = await readNotifications();
  return notifications.slice(0, Math.max(1, limit));
}