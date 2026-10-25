import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  // .agents holds vendored agent skills (bmad), not our source.
  { ignores: [".agents", "dist", "drizzle", ".wrangler", "worker-configuration.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // CLAUDE.md code conventions: no `any`, no unexplained non-null assertions.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["src/client/**/*.tsx"],
    ...reactHooks.configs.flat["recommended-latest"],
  },
  {
    // Build and tooling scripts run in Node, not in workerd or a browser.
    files: ["scripts/**/*.mjs", "*.config.ts", "*.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    // ADR-0037: the field side has no admin branch. The Worker refuses an admin on
    // /api/agent/* in requireAgent and the shell sends one to /admin before any field
    // code runs, so a comparison with "admin" here is a second, divergent gate.
    // Tests may name the role; the allowed place for the check is auth.ts and App.tsx.
    files: ["src/worker/routes/agent.ts", "src/client/field/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...[
          'BinaryExpression[left.value="admin"]',
          'BinaryExpression[right.value="admin"]',
          'SwitchCase[test.value="admin"]',
        ].map((selector) => ({
          selector,
          message:
            "No admin branch on the field side (ADR-0037): requireAgent and App.tsx decide who gets here.",
        })),
      ],
    },
  },
  {
    // src/shared is imported by the Worker: no DOM, no Worker-only globals.
    files: ["src/shared/**/*.ts"],
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "window", message: "src/shared must stay pure (CLAUDE.md)." },
        { name: "document", message: "src/shared must stay pure (CLAUDE.md)." },
        { name: "localStorage", message: "src/shared must stay pure (CLAUDE.md)." },
        { name: "caches", message: "src/shared must stay pure (CLAUDE.md)." },
      ],
    },
  },
);
