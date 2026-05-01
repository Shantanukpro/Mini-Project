import Redis from 'ioredis';

const hasRedisConfig = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);

const noopRedisClient = {
  async get() {
    return null;
  },
  async set() {
    return 'OK';
  },
};

const redisClient = hasRedisConfig ? new Redis(process.env.REDIS_URL || {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
}) : noopRedisClient;

if (hasRedisConfig) {
  redisClient.on('connect', () => {
    console.log('Redis connected');
  });

  redisClient.on('error', (error) => {
    console.warn('Redis unavailable:', error.message);
  });
} else {
  console.warn('Redis is not configured. Logout token blacklist is disabled.');
}

export default redisClient;

