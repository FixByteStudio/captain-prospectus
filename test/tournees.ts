import { env } from "cloudflare:test";
import { getDb } from "../src/worker/db/client";
import { tournees } from "../src/worker/db/schema";
import { brusselsMidnightDaysFromNow } from "../src/shared/period";

/** One agent's swipe at `startedAt`, with no stops: enough for « started today » (ADR-0036). */
export async function seedTournee(agentEmail: string, startedAt: number): Promise<void> {
  await getDb(env.DB)
    .insert(tournees)
    .values({
      id: crypto.randomUUID(),
      agentEmail,
      dayStart: brusselsMidnightDaysFromNow(startedAt, 0),
      startedAt,
      clientStartedAt: startedAt,
      receivedAt: startedAt,
    });
}
