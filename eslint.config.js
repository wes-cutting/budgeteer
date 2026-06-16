import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Flat config (ESLint 9). Syntactic rules only — typescript-eslint's `recommended` (not the
// type-checked variant), so no per-package tsconfig wiring is needed and lint stays fast; the
// strict `tsc` in the gate already carries the type-aware checks. The React-hooks rules are the
// motivating gap (EH4): they were suppressed in places but never actually enforced.
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "spikes/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // API/domain run on Node; the Playwright e2e + its config also run in the Node test runner.
    files: ["apps/api/**/*.ts", "packages/**/*.ts", "e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
