/**
 * Fails the build over the field precache ceiling ADR-0026 sets: 1,000 KiB.
 *
 * ADR-0026 named that ceiling as a line a human reads off `pnpm build`'s own
 * Workbox output ("harder: the ceiling is still read by hand" — its
 * consequences, and the follow-up work at the end of that ADR). This is that
 * follow-up: it reads the manifest Workbox wrote to `dist/client/sw.js`, sums
 * the bytes of every entry a phone downloads on install, and exits non-zero
 * instead of leaving the number for review to catch. That is more than
 * Workbox's own printed total, which leaves out the web-manifest icons and
 * `manifest.webmanifest` (ADR-0031).
 *
 * It also fails when a precached chunk holds an admin-only package (GH #95)
 * or admin-only source module such as the admin copy (GH #20),
 * read from the chunk-module map `vite.config.ts` writes beside dist/client:
 * a leak like that would otherwise pass silently until it crossed the ceiling.
 *
 * Run after `pnpm build` (wired as `check:precache` in package.json and
 * ci.yml), never instead of it: this script trusts the build's own output
 * rather than re-running Rollup or Workbox itself.
 *
 * `CHECK_PRECACHE_ROOT`/`CHECK_PRECACHE_CEILING_KIB` are a seam for
 * `check-precache.test.mjs` only — the real CLI (package.json, ci.yml) never
 * sets them, so its behaviour and output are unchanged.
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CEILING_KIB = (() => {
  const override = process.env.CHECK_PRECACHE_CEILING_KIB;
  if (override === undefined) return 1000;
  const parsed = Number(override);
  // Fail closed: a NaN ceiling would make every comparison below false, so the
  // guard would pass while claiming to enforce — the one outcome it must never
  // have.
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.error(
      `check:precache — CHECK_PRECACHE_CEILING_KIB is not a positive number: "${override}".`,
    );
    process.exit(1);
  }
  return parsed;
})();
const ROOT = process.env.CHECK_PRECACHE_ROOT
  ? resolve(process.env.CHECK_PRECACHE_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_CLIENT = join(ROOT, "dist", "client");
const SW_PATH = join(DIST_CLIENT, "sw.js");
const MAP_PATH = join(ROOT, "dist", "client-chunk-modules.json");

// Packages and source modules (as `src/client/...` paths) only the admin side
// imports. Leaflet, Radix and sonner are left out
// on purpose: the field shares them (ADR-0026) or may. Recharts' chart-only
// dependencies are listed too, so a chunk split that moves them out of
// AdminApp without Recharts itself still fails (GH #110); its generic ones
// (immer, es-toolkit, react-is…) are not, since the field may use them.
const ADMIN_ONLY = [
  "@tanstack/*",
  "cmdk",
  "recharts",
  "victory-vendor",
  "@reduxjs/*",
  "react-redux",
  "redux",
  "decimal.js-light",
  "papaparse",
  "@dnd-kit/*",
  // Admin French strings: field-reachable modules import copy/field.ts instead (GH #20).
  "src/client/copy/admin.ts",
  "src/client/copy.ts",
];
const isAdminOnly = (name) =>
  ADMIN_ONLY.some((p) => (p.endsWith("/*") ? name.startsWith(p.slice(0, -1)) : name === p));

let sw;
try {
  sw = readFileSync(SW_PATH, "utf8");
} catch {
  console.error(
    `check:precache — no ${SW_PATH}. Run "pnpm build" first; this script reads its output, it does not build.`,
  );
  process.exit(1);
}

// Workbox's generateSW writes one precacheAndRoute([{url,revision}, …], …)
// call; URLs are relative to dist/client/. No JSON parse: revision is either
// a quoted hash or the bare literal `null`.
const call = /precacheAndRoute\(\[([\s\S]*?)\],\s*\{/.exec(sw);
if (call === null) {
  console.error(`check:precache — no precacheAndRoute([...]) call found in ${SW_PATH}.`);
  process.exit(1);
}

// An empty manifest (`precacheAndRoute([], …)`) captures "" — falsy, but a
// real match — so this is checked on the array, not on `call[1]` itself.
const urls = [...call[1].matchAll(/\{url:"([^"]+)"/g)].map(([, url]) => url);
if (urls.length === 0) {
  console.error(`check:precache — precacheAndRoute([...]) in ${SW_PATH} lists no entries.`);
  process.exit(1);
}

// Fail closed if the pattern above matched only some of the manifest: a future
// Workbox or minifier that quotes an entry differently would otherwise yield a
// plausible subtotal and pass a ceiling it is no longer measuring.
const declared = (call[1].match(/\burl:/g) ?? []).length;
if (declared !== urls.length) {
  console.error(
    `check:precache — parsed ${urls.length} of ${declared} manifest entries in ${SW_PATH}. The precacheAndRoute format changed; update this script rather than trusting a partial total.`,
  );
  process.exit(1);
}

const entries = urls.map((url) => {
  // Decode and stat in one try: a bad escape (a lone "%") must report its own
  // message, not fall through into `join()` with `undefined` and throw a
  // second, unrelated TypeError before the process actually exits.
  let path;
  let bytes;
  try {
    path = decodeURIComponent(url);
    bytes = statSync(join(DIST_CLIENT, path)).size;
  } catch (error) {
    if (error instanceof URIError) {
      console.error(`check:precache — ${SW_PATH} lists "${url}", which is not a valid URI.`);
    } else {
      // A manifest entry with no file behind it is a broken build, not a
      // precache problem — say which, rather than throwing a raw ENOENT stack
      // that reads as a crashed CI step.
      console.error(
        `check:precache — ${SW_PATH} lists "${url}", which is not a file under ${DIST_CLIENT}.`,
      );
    }
    process.exit(1);
  }
  return { url, path, bytes };
});

const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
const totalKiB = totalBytes / 1024;

// Self-describing: with the env-var seam set (only ever true under
// check-precache.test.mjs), a passing run would otherwise say nothing about
// measuring a different tree or a different ceiling than the real one.
const overrides = [
  process.env.CHECK_PRECACHE_ROOT ? `root ${ROOT}` : null,
  process.env.CHECK_PRECACHE_CEILING_KIB ? `ceiling overridden` : null,
]
  .filter(Boolean)
  .join(", ");
console.log(
  `check:precache — ${entries.length} entries (${totalKiB.toFixed(2)} KiB) against a ${CEILING_KIB} KiB ceiling${overrides ? ` [${overrides}]` : ""}`,
);
for (const entry of [...entries].sort((a, b) => b.bytes - a.bytes)) {
  console.log(`  ${(entry.bytes / 1024).toFixed(2)} KiB  ${entry.url}`);
}

// Every check below reports before the script exits, so one run names both an
// overweight precache and the leak behind it.
let failed = false;

if (totalKiB > CEILING_KIB) {
  console.error(
    `check:precache — ${totalKiB.toFixed(2)} KiB exceeds the ${CEILING_KIB} KiB ceiling (ADR-0026). Move the new weight to a lazy admin chunk, or renegotiate the ADR.`,
  );
  failed = true;
}

// Fails closed: without a map, or with a precached chunk it does not list,
// the leak check would pass while checking nothing.
let chunkModules;
try {
  chunkModules = JSON.parse(readFileSync(MAP_PATH, "utf8"));
} catch {
  console.error(
    `check:precache — no readable ${MAP_PATH}. Run "pnpm build" first; the chunkModuleMap plugin in vite.config.ts writes it.`,
  );
  process.exit(1);
}
if (typeof chunkModules !== "object" || chunkModules === null || Array.isArray(chunkModules)) {
  console.error(`check:precache — ${MAP_PATH} is not a { chunk: modules[] } object.`);
  process.exit(1);
}

for (const { url, path } of entries.filter((e) => e.path.endsWith(".js"))) {
  const modules = Object.hasOwn(chunkModules, path) ? chunkModules[path] : undefined;
  if (!Array.isArray(modules)) {
    console.error(
      `check:precache — "${url}" is precached but has no entry in ${MAP_PATH}. Either the map is stale (run "pnpm build" again) or the file is not a chunk the build emitted, which this check cannot vouch for.`,
    );
    failed = true;
    continue;
  }
  const leaked = modules.filter((name) => typeof name === "string" && isAdminOnly(name));
  if (leaked.length > 0) {
    console.error(
      `check:precache — precached "${url}" holds admin-only ${leaked.join(", ")}. Move the import behind the lazy AdminApp import; for a copy module, import copy/field instead. Only a chunk that is admin-only as a whole belongs in globIgnores in vite.config.ts (ADR-0019); ignoring a shared chunk like index-*.js breaks the field route offline.`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
