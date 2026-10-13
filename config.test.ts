import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Configuration guards for things that fail silently and expensively.
 * A comment in a config file is not a control; these are.
 */

function readWranglerConfig(): Record<string, unknown> {
  // Strip // comments and trailing commas: wrangler.jsonc is JSONC.
  const raw = readFileSync("wrangler.jsonc", "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("wrangler.jsonc", () => {
  it("runs the Worker first only for /api/*, never for every request", () => {
    const assets = readWranglerConfig().assets as { run_worker_first?: unknown };

    // INVARIANT 14. `true` would invoke the Worker for every app-shell request,
    // moving the whole PWA from "free and unlimited" onto the 100,000/day quota.
    expect(assets.run_worker_first).toEqual(["/api/*"]);
    expect(assets.run_worker_first).not.toBe(true);
  });

  it("turns preview URLs off, so no second host for the Worker can sit outside Access", () => {
    // docs/security.md, "Access bypass". A preview URL is reachable without the
    // Access policy unless someone remembers to cover it in the dashboard; the
    // key must be present and false, not merely absent, so the deploy states it.
    expect(readWranglerConfig().preview_urls).toBe(false);
  });

  it("serves the SPA fallback for unknown paths", () => {
    const assets = readWranglerConfig().assets as { not_found_handling?: string };
    expect(assets.not_found_handling).toBe("single-page-application");
  });

  // ADR-0020 and ADR-0029. `vars` is committed to the repo; these are set by the
  // owner or CI, never here (src/worker/types.ts). Putting one here would
  // publish it in git and in every `wrangler deploy` output, and nothing would
  // fail. OWNER_EMAIL is not secret, but a committed value would override the
  // deployed one on every deploy.
  it.each(["GOOGLE_PLACES_KEY", "AUTH_PEPPER", "BREAK_GLASS", "OWNER_EMAIL"])(
    "never carries %s",
    (name) => {
      const vars = (readWranglerConfig().vars ?? {}) as Record<string, unknown>;
      expect(Object.keys(vars)).not.toContain(name);
      expect(readFileSync("wrangler.jsonc", "utf8")).not.toContain(name);
    },
  );

  it("keeps observability on, which the release checklist depends on", () => {
    const observability = readWranglerConfig().observability as { enabled?: boolean };
    expect(observability.enabled).toBe(true);
  });
});

describe("service worker", () => {
  it("never caches /api", () => {
    const config = readFileSync("vite.config.ts", "utf8");

    // INVARIANT 8. A cached sync response would show a stale today list, or
    // make a failed sync look like it succeeded.
    expect(config).toContain("navigateFallbackDenylist");
    expect(config).toMatch(/runtimeCaching:\s*\[\s*\]/);
  });

  it("exempts the reconnect marker from the SPA fallback so it reaches Access", () => {
    const config = readFileSync("vite.config.ts", "utf8");

    // spec-gh-65: navigateFallback serves every other navigation from
    // precache, which never reaches Access, so "Se reconnecter" would reload
    // an expired session straight back into itself without this entry. The
    // pattern itself lives in reconnect-marker.ts, shared with the client's
    // own navigate/strip code, so this only asserts the two are wired
    // together rather than re-deriving the regex here.
    expect(config).toContain(
      'import { RECONNECT_MARKER_PATTERN } from "./src/client/field/reconnect-marker.ts"',
    );
    expect(config).toMatch(/navigateFallbackDenylist:\s*\[[^\]]*RECONNECT_MARKER_PATTERN/);
  });

  it("precaches the field app only, never the admin chunk", () => {
    const config = readFileSync("vite.config.ts", "utf8");

    // ADR-0019. Without this, every field phone downloads ~299 kB of TanStack
    // Query, Radix, sonner, PapaParse and Leaflet on install, for an app that
    // App.tsx will not render without a network anyway.
    // Extension-less on purpose: Leaflet's stylesheet arrives as a separate
    // `AdminApp-*.css`, which a `.js`-only ignore would keep precaching.
    expect(config).toMatch(/globIgnores:\s*\[\s*"\*\*\/assets\/AdminApp-\*"/);
  });
});

describe("CI", () => {
  /**
   * The `- run:` commands of one job, in order, ignoring commented-out lines.
   * Read off the indented block rather than with `indexOf`, so two commands in
   * *different* jobs — which say nothing about ordering — cannot satisfy it.
   */
  function runStepsOf(ci: string, job: string): string[] {
    const jobAt = ci.indexOf(`\n  ${job}:`);
    if (jobAt === -1) throw new Error(`no ${job} job in ci.yml`);
    const next = ci.slice(jobAt + 1).search(/\n {2}\w[\w-]*:/);
    const body = next === -1 ? ci.slice(jobAt) : ci.slice(jobAt, jobAt + 1 + next);
    return [...body.matchAll(/^\s*- run: (.+)$/gm)].map(([, command]) => command.trim());
  }

  it("runs check:precache after the build in the same job, so the ceiling fails CI rather than waiting for a human to read the build log", () => {
    // ADR-0026 named the CI check as follow-up work; without this assertion,
    // ci.yml could drop the step again and nothing would notice (GH #67).
    const steps = runStepsOf(readFileSync(".github/workflows/ci.yml", "utf8"), "check");
    const buildAt = steps.findIndex((s) => s === "pnpm run build");
    const checkAt = steps.findIndex((s) => s === "pnpm run check:precache");
    expect(buildAt, "the check job never runs pnpm run build").toBeGreaterThan(-1);
    expect(checkAt, "the check job never runs pnpm run check:precache").toBeGreaterThan(-1);
    expect(checkAt, "check:precache must run after the build").toBeGreaterThan(buildAt);
  });

  it("enforces exactly ADR-0026's 1,000 KiB ceiling, not some other number", () => {
    // A substring match would also pass for 10000 or for the digits appearing
    // only in a comment, which is the mistake this guard exists to prevent.
    const script = readFileSync("scripts/check-precache.mjs", "utf8");
    expect(script).toMatch(/if \(override === undefined\) return 1000;/);
  });

  /** A workflow without its comment lines, so a commented-out trigger cannot satisfy a guard. */
  function readWorkflow(name: string): string {
    return readFileSync(`.github/workflows/${name}`, "utf8").replace(/^[ \t]*#.*$/gm, "");
  }

  /** The event names directly under a workflow's `on:`. */
  function triggersOf(workflow: string): string[] {
    const on = /^on:\n((?: {2,}.*\n|\n)+)/m.exec(workflow);
    if (!on) throw new Error("no on: block");
    return [...on[1].matchAll(/^ {2}(\w+):/gm)].map(([, event]) => event);
  }

  it("deploys only the tip of main, after CI passed on a push to it", () => {
    const deploy = readWorkflow("deploy.yml");

    // No `push`: a commit pushed straight to main would deploy before its CI.
    // No `pull_request`: a fork's code would run with the Cloudflare token.
    expect(triggersOf(deploy)).toEqual(["workflow_run", "workflow_dispatch"]);

    // `branches: [main]` also matches a fork's branch called main, so the
    // condition is the control, and every clause of it carries weight: see
    // the comment above it in deploy.yml.
    const condition = /^ {4}if: >\n((?: {6}.*\n)+)/m.exec(deploy);
    expect(condition?.[1].replace(/\s+/g, " ").trim()).toBe(
      "github.event_name == 'workflow_dispatch' || " +
        "(github.event.workflow_run.conclusion == 'success' && " +
        "github.event.workflow_run.event == 'push' && " +
        "github.event.workflow_run.head_branch == 'main' && " +
        "github.event.workflow_run.head_sha == github.sha)",
    );
  });

  it("applies the migrations before it deploys the Worker", () => {
    // docs/deployment.md, "Release process". The other order runs new code
    // against the old schema.
    const lines = readWorkflow("deploy.yml")
      .split("\n")
      .map((line) => line.trim());
    const migrateAt = lines.indexOf("d1 migrations apply captain-prospectus --remote");
    const deployAt = lines.indexOf("deploy");
    expect(migrateAt, "deploy.yml never applies the migrations").toBeGreaterThan(-1);
    expect(deployAt, "the deploy must come after the migrations").toBeGreaterThan(migrateAt);
  });

  it("backs up on a schedule, into R2 and never into a GitHub artifact", () => {
    const backup = readWorkflow("backup.yml");

    expect(triggersOf(backup)).toContain("schedule");
    // ADR-0023, #34: an artifact is a copy of every visit note on a third party.
    expect(backup).not.toContain("upload-artifact");
    expect(backup).toContain("r2 object put");
  });
});
