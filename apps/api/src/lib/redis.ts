import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL?.trim();

/** Redis only backs the conversation cache, so the API runs without it. */
export const redisConfigured = Boolean(redisUrl);

export const redis = redisUrl
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        if (times > 10) return null;
        return Math.min(times * 200, 5000);
      },
    })
  : // No URL: never dial out, and reject commands at once so callers use their fallback.
    new Redis({
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });

redis.on('error', (err) => {
  if (redisConfigured) console.error('[redis] connection error:', err.message);
});
