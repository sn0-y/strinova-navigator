import Redis from 'ioredis';

const redisUri = process.env.REDIS_URL;
if (!redisUri) {
  throw new Error('REDIS_URL is missing from environment variables.');
}

export const redis = new Redis(redisUri, {
  retryStrategy(times) {
    return Math.min(times * 50, 2000);
  },
});

redis.on('connect', () => console.log('✅ Connected to DragonflyDB'));
redis.on('error', (err) => console.error('❌ DragonflyDB Error:', err));
