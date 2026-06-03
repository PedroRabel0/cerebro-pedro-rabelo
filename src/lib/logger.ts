/**
 * Structured logger using Pino.
 * Replaces all console.log/error/warn across the codebase.
 *
 * Usage:
 *   import { log } from '@/lib/logger';
 *   log.info('[Module] message');
 *   log.error('[Module] error:' + " " + String(err));
 *   log.warn('[Module] warning');
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const log = pino({
  level: isProduction ? 'info' : 'debug',
  // In production: JSON logs (Vercel parses these natively)
  // In dev: pretty format
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino/file',
          options: { destination: 1 }, // stdout
        },
      }),
});

export default log;
