// astro.config.mjs
// This configuration file sets up Astro to run in server mode using the Node adapter.

import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    {
      name: 'app-init',
      hooks: {
        'astro:server:start': async () => {
          const { ensureDataDir }  = await import('./src/lib/queue.js');
          const { ensureAuthDir }  = await import('./src/lib/auth.js');
          const { initWatcher }    = await import('./src/lib/watcher.js');
          const { startScheduler } = await import('./src/lib/scheduler.js');

          await Promise.all([ensureDataDir(), ensureAuthDir()]);
          await initWatcher();
          await startScheduler();
        },
      },
    },
  ],
});