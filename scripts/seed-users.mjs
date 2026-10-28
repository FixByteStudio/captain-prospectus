/**
 * Seed the LOCAL database with its users only: admin@example.com (admin, what
 * DEV_USER_EMAIL names) and agent@example.com. No prospects, no script, no
 * second agent: a clean start for trying an import or a script by hand.
 * `pnpm db:seed:local` adds 10 blank prospects and the script;
 * `pnpm db:seed:local:full` loads the 300 places and 180 days of seed.mjs.
 *
 * Posts to the dev-only /api/dev/seed route, like seed.mjs. Running it twice
 * inserts nothing the second time.
 *
 * Usage: pnpm dev   (in one terminal)
 *        pnpm db:seed:local:users
 */

const URL_BASE = process.env.SEED_URL ?? "http://localhost:5173";

const response = await fetch(`${URL_BASE}/api/dev/seed`, {
  method: "POST",
  // The Worker refuses a POST without its own Origin (src/worker/origin.ts).
  headers: { "Content-Type": "application/json", Origin: new URL(URL_BASE).origin },
  body: JSON.stringify({ prospects: [], orphans: false, secondAgent: false }),
}).catch((error) => {
  console.error(`Could not reach ${URL_BASE}. Is \`pnpm dev\` running?`);
  console.error(String(error));
  process.exit(1);
});

if (!response.ok) {
  console.error(`Seed failed: ${response.status} ${await response.text()}`);
  process.exit(1);
}

const body = await response.json();
console.log(`Inserted ${body.inserted.users} users: admin@example.com and agent@example.com.`);
