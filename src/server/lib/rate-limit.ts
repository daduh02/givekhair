import IORedis from "ioredis";
import { NextResponse } from "next/server";
import { TRPCError } from "@trpc/server";

type RateLimitInput = {
  namespace: string;
  key: string;
  limit: number;
  windowSec: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

type MemoryEntry = {
  count: number;
  resetAt: number;
};

const memoryStore = globalThis.__givekhairRateLimitStore ?? new Map<string, MemoryEntry>();

if (!globalThis.__givekhairRateLimitStore) {
  globalThis.__givekhairRateLimitStore = memoryStore;
}

let redisConnection: IORedis | null | undefined;

function getRedisConnection() {
  if (redisConnection !== undefined) {
    return redisConnection;
  }

  if (!process.env.REDIS_URL) {
    redisConnection = null;
    return redisConnection;
  }

  redisConnection = new IORedis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  redisConnection.on("error", () => {
    // Fall back to the in-memory limiter when Redis is unavailable.
  });

  return redisConnection;
}

async function consumeRedisRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const redis = getRedisConnection();
  if (!redis) {
    throw new Error("Redis unavailable");
  }

  const namespacedKey = `rate-limit:${input.namespace}:${input.key}`;
  await redis.connect().catch(() => undefined);

  const incremented = await redis.incr(namespacedKey);
  if (incremented === 1) {
    await redis.expire(namespacedKey, input.windowSec);
  }

  const ttl = await redis.ttl(namespacedKey);
  const retryAfterSec = ttl > 0 ? ttl : input.windowSec;

  return {
    allowed: incremented <= input.limit,
    remaining: Math.max(0, input.limit - incremented),
    retryAfterSec,
  };
}

function consumeMemoryRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const namespacedKey = `rate-limit:${input.namespace}:${input.key}`;
  const current = memoryStore.get(namespacedKey);

  if (!current || current.resetAt <= now) {
    memoryStore.set(namespacedKey, {
      count: 1,
      resetAt: now + input.windowSec * 1000,
    });

    return {
      allowed: true,
      remaining: Math.max(0, input.limit - 1),
      retryAfterSec: input.windowSec,
    };
  }

  current.count += 1;
  memoryStore.set(namespacedKey, current);

  return {
    allowed: current.count <= input.limit,
    remaining: Math.max(0, input.limit - current.count),
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export async function consumeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  try {
    if (process.env.REDIS_URL) {
      return await consumeRedisRateLimit(input);
    }
  } catch {
    // Ignore Redis limiter errors and fall back to memory.
  }

  return consumeMemoryRateLimit(input);
}

export function buildRateLimitResponse(message = "Too many requests. Please try again later.", retryAfterSec = 60) {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    },
  );
}

export async function enforceRateLimitResponse(input: RateLimitInput, message?: string) {
  const result = await consumeRateLimit(input);
  if (result.allowed) {
    return null;
  }

  return buildRateLimitResponse(message, result.retryAfterSec);
}

export async function enforceRateLimitTrpc(input: RateLimitInput, message = "Too many requests. Please try again later.") {
  const result = await consumeRateLimit(input);
  if (result.allowed) {
    return;
  }

  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message,
  });
}

export async function closeRateLimitConnections() {
  memoryStore.clear();

  if (redisConnection) {
    await redisConnection.quit().catch(() => {
      redisConnection?.disconnect();
    });
  }

  redisConnection = undefined;
}

declare global {
  // eslint-disable-next-line no-var
  var __givekhairRateLimitStore: Map<string, MemoryEntry> | undefined;
}
