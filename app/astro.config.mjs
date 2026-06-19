// astro.config.mjs
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
          const { ensureDataDir }  = await import('./src/lib/queue.ts');
          const { ensureAuthDir }  = await import('./src/lib/auth.ts');
          const { initWatcher }    = await import('./src/lib/watcher.ts');
          const { startScheduler } = await import('./src/lib/scheduler.ts');

          await Promise.all([ensureDataDir(), ensureAuthDir()]);
          await initWatcher();
          await startScheduler();
        },
      },
    },
  ],
});