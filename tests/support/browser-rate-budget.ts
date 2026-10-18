import "./isolated";
import Redis from "ioredis";

/** Independent browser accounts share the isolated harness's loopback IP. */
export async function resetBrowserFixtureRateBudget() {
  const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1 });
  try {
    for (const pattern of ["rate:auth:*", "rate:api:*"]) {
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = next;
        if (keys.length) await redis.del(...keys);
      } while (cursor !== "0");
    }
  } finally { redis.disconnect(); }
}
