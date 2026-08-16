import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(process.cwd(), '../../.env') });
config();

import { validateEnv } from './lib/env.js';
validateEnv();

const port = Number(process.env.PORT) || 3001;
const host = '0.0.0.0';

async function start() {
  const { buildApp } = await import('./app.js');
  const app = await buildApp();

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port, host });
    app.log.info(`API server running at http://${host}:${port}`);
    const { logIntegrationSetupHints } = await import('./lib/integrations/setup-hints.js');
    logIntegrationSetupHints();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
