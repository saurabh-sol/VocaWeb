import type { IntegrationProvider } from '@theo/db';
import { integrationConfigured } from './token-store.js';

const PROVIDERS: IntegrationProvider[] = ['notion', 'canva', 'figma'];

export function logIntegrationSetupHints(): void {
  if (process.env.NODE_ENV === 'test') return;

  const missing = PROVIDERS.filter((p) => !integrationConfigured(p));
  if (missing.length === 0) return;

  console.warn(
    `[integrations] OAuth not configured for: ${missing.join(', ')}. ` +
      'Set {PROVIDER}_CLIENT_ID and {PROVIDER}_CLIENT_SECRET on the API (see .env.example).',
  );
}
