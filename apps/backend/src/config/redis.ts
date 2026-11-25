import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

const redisUrl = env.REDIS_URL && env.REDIS_URL.trim() !== ''
  ? new URL(env.REDIS_URL)
  : null;

export const redisConfig: RedisOptions = {
  host: redisUrl?.hostname || env.REDIS_HOST,
  port: Number(redisUrl?.port || env.REDIS_PORT),

  username: redisUrl?.username
    ? decodeURIComponent(redisUrl.username)
    : undefined,

  password: redisUrl?.password
    ? decodeURIComponent(redisUrl.password)
    : undefined,

  tls: redisUrl?.protocol === 'rediss:'
    ? {}
    : undefined,

  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => {
  console.log('Connected to Redis successfully');
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

