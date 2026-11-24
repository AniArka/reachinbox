import { redisClient } from '../config/redis';

// Atomic Redis Lua Script for distributed hourly rate limiting and minimum delay pacing
const RATE_LIMIT_LUA_SCRIPT = `
  local rateLimitKey = KEYS[1]
  local pacingKey = KEYS[2]

  local hourlyLimit = tonumber(ARGV[1])
  local minDelayMs = tonumber(ARGV[2])
  local nowMs = tonumber(ARGV[3])
  local ttlSeconds = tonumber(ARGV[4])

  -- 1. Check hourly capacity
  local currentCount = tonumber(redis.call('GET', rateLimitKey) or '0')
  if currentCount >= hourlyLimit then
    -- Capacity exhausted for this hour window
    return {0, currentCount}
  end

  -- 2. Check minimum send interval (pacing)
  local lastSent = tonumber(redis.call('GET', pacingKey) or '0')
  local elapsed = nowMs - lastSent
  if elapsed < minDelayMs then
    local waitMs = minDelayMs - elapsed
    return {2, waitMs}
  end

  -- 3. Atomically reserve hourly capacity
  local newCount = redis.call('INCR', rateLimitKey)
  if newCount == 1 then
    redis.call('EXPIRE', rateLimitKey, ttlSeconds)
  end

  -- 4. Atomically update pacing timestamp
  redis.call('SET', pacingKey, nowMs, 'PX', math.max(60000, minDelayMs * 2))

  return {1, newCount}
`;

export interface RateLimitCheckResult {
  allowed: boolean;
  deferred: boolean;
  deferDurationMs?: number;
  currentCount: number;
  hourlyLimit: number;
  windowKey: string;
}

export class DistributedRateLimiter {
  static getHourlyWindowKey(date = new Date()): { windowKey: string; ttlSeconds: number } {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');

    // e.g. "20261125-01"
    const windowKey = `${year}${month}${day}-${hour}`;

    // Seconds until top of the next hour
    const nextHour = new Date(date);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
    const ttlSeconds = Math.max(60, Math.ceil((nextHour.getTime() - date.getTime()) / 1000));

    return { windowKey, ttlSeconds };
  }

  static async reserveSendCapacity(
    senderId: string,
    hourlyLimit: number,
    minDelayMs: number
  ): Promise<RateLimitCheckResult> {
    const now = new Date();
    const { windowKey, ttlSeconds } = this.getHourlyWindowKey(now);

    const rateLimitKey = `rate-limit:sender:${senderId}:${windowKey}`;
    const pacingKey = `pacing:sender:${senderId}`;

    // Execute atomic Lua script
    const result = (await redisClient.eval(
      RATE_LIMIT_LUA_SCRIPT,
      2,
      rateLimitKey,
      pacingKey,
      hourlyLimit,
      minDelayMs,
      now.getTime(),
      ttlSeconds
    )) as [number, number];

    const statusCode = result[0];
    const value = result[1];

    if (statusCode === 1) {
      // Allowed & capacity reserved
      return {
        allowed: true,
        deferred: false,
        currentCount: value,
        hourlyLimit,
        windowKey,
      };
    } else if (statusCode === 2) {
      // Pacing wait needed (milliseconds)
      return {
        allowed: false,
        deferred: true,
        deferDurationMs: value,
        currentCount: 0,
        hourlyLimit,
        windowKey,
      };
    } else {
      // Hourly limit hit (statusCode === 0)
      // Defer to start of next hour
      const nextHour = new Date(now);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
      const deferDurationMs = nextHour.getTime() - now.getTime();

      return {
        allowed: false,
        deferred: true,
        deferDurationMs,
        currentCount: value,
        hourlyLimit,
        windowKey,
      };
    }
  }

  // Release capacity in case SMTP completely fails before sending
  static async releaseCapacity(senderId: string): Promise<void> {
    const { windowKey } = this.getHourlyWindowKey();
    const rateLimitKey = `rate-limit:sender:${senderId}:${windowKey}`;
    await redisClient.decr(rateLimitKey);
  }
}
