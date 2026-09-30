/**
 * Seed the LOCAL database with 10 blank prospects: status new, assigned to
 * nobody, no visits, nothing quarantined. The default `pnpm db:seed:local`;
 * `pnpm db:seed:local:full` loads the 300 places and 180 days of seed.mjs.
 *
 * The users are those of .dev.vars: ADMIN_EMAILS (admin@example.com) and
 * AGENT_EMAILS (agent@example.com). The active script goes in too, so the agent
 * can record a visit once the admin assigns a prospect.
 *
 * Posts to the dev-only /api/dev/seed route, like seed.mjs. Running it twice
 * inserts nothing the second time.
 *
 * Usage: pnpm dev   (in one terminal)
 *        pnpm db:seed:local
 */

import { script } from "./seed-script.mjs";

const URL_BASE = process.env.SEED_URL ?? "http://localhost:5173";

// Around the Grand-Place, Brussels — the area this canvasses (docs/vision.md).
const CENTER = { lat: 50.8467, lng: 4.3525 };

const NAMES = [
  ["Le Coin Gourmand", "restaurant"],
  ["Café du Sablon", "cafe"],
  ["Frites de la Bourse", "fast_food"],
  ["Bar de l'Ilot Sacré", "bar"],
  ["Le Food Truck du Mont des Arts", "food_truck"],
  ["Brasserie des Galeries", "restaurant"],
  ["Pita Midi", "fast_food"],
  ["Salon de thé Manneken", "cafe"],
  ["La Table du Béguinage", "restaurant"],
  ["Épicerie fine Saint-Jacques", "other"],
];

const prospects = NAMES.map(([name, type], i) => ({
  name,
  type,
  // A ring ~700 m across: every pair sits well past the 50 m duplicate radius.
  lat: Number((CENTER.lat + Math.sin((i * Math.PI) / 5) * 0.004).toFixed(6)),
  lng: Number((CENTER.lng + Math.cos((i * Math.PI) / 5) * 0.006).toFixed(6)),
  address: null,
  assignedTo: null,
}));

const response = await fetch(`${URL_BASE}/api/dev/seed`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ prospects, script, orphans: false }),
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
console.log(
  `Seeded ${body.seeded} blank prospects, unassigned, and 1 active script. ` +
    `Inserted ${body.inserted.prospects} prospects.`,
);
