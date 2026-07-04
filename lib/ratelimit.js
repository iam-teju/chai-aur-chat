// lib/ratelimit.js
// Layer 1 of cost protection: 25 messages / day / IP, enforced SERVER-SIDE.
// Uses Upstash Redis when configured (survives serverless restarts on Vercel).
// Falls back to in-memory counting for local dev — same interface either way.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const LIMIT = 25;
const WINDOW = '1 d';

let upstash = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  upstash = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(LIMIT, WINDOW),
    prefix: 'persona-chat',
  });
}

// In-memory fallback: { ip -> { day, count } }. Fine for dev; best-effort in prod.
const mem = new Map();

export async function checkRateLimit(ip) {
  if (upstash) {
    const { success, remaining } = await upstash.limit(ip);
    return { success, remaining, limit: LIMIT };
  }
  const today = new Date().toISOString().slice(0, 10);
  const entry = mem.get(ip);
  if (!entry || entry.day !== today) {
    mem.set(ip, { day: today, count: 1 });
    return { success: true, remaining: LIMIT - 1, limit: LIMIT };
  }
  if (entry.count >= LIMIT) return { success: false, remaining: 0, limit: LIMIT };
  entry.count += 1;
  return { success: true, remaining: LIMIT - entry.count, limit: LIMIT };
}
