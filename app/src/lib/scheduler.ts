// app/src/lib/scheduler.ts
// Background scheduler - polls queue.json and fires uploads when their
// scheduledUploadAt time arrives (or immediately if scheduledUploadAt is null).

import { ensureDataDir, getQueue } from "./queue.ts";
import { ensureAuthDir } from "./auth.ts";
import { uploadEntry } from "./uploader.ts";

const POLL_INTERVAL_MS = 60_000;
const MAX_CONCURRENT = 2; // max simultaneous uploads

let schedulerStarted = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

// Track entries currently being uploaded in-process so the next tick doesn't
// re-dispatch them before their status has been persisted to queue.json.
const inFlight = new Set<string>();

export async function startScheduler(): Promise<void> {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Ensure data directories exist before the first tick
  await Promise.all([ensureDataDir(), ensureAuthDir()]);

  console.log(
    `[scheduler] Started - polling every ${POLL_INTERVAL_MS / 1000}s (max ${MAX_CONCURRENT} concurrent uploads).`,
  );

  const tick = async () => {
    try {
      const queue = await getQueue();
      const now = new Date();

      for (const entry of queue) {
        // Skip if not ready or already in-flight (in this process)
        if (entry.status !== "queued") continue;
        if (inFlight.has(entry.id)) continue;

        // Respect MAX_CONCURRENT
        if (inFlight.size >= MAX_CONCURRENT) break;

        const shouldUploadNow =
          entry.scheduledUploadAt === null ||
          new Date(entry.scheduledUploadAt) <= now;

        if (!shouldUploadNow) continue;

        console.log(
          `[scheduler] Dispatching: ${entry.fileName} (in-flight: ${inFlight.size + 1}/${MAX_CONCURRENT})`,
        );

        inFlight.add(entry.id);

        uploadEntry(entry)
          .catch((err) =>
            console.error(
              `[scheduler] uploadEntry threw for ${entry.fileName}:`,
              err,
            ),
          )
          .finally(() => inFlight.delete(entry.id));
      }
    } catch (err) {
      console.error("[scheduler] Tick error:", err);
    }
  };

  // Run once immediately on start, then on interval
  tick();
  intervalHandle = setInterval(tick, POLL_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  schedulerStarted = false;
  console.log("[scheduler] Stopped.");
}
