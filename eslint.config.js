import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Flat config (ESLint 9). Syntactic rules only — typescript-eslint's `recommended` (not the
// type-checked variant), so no per-package tsconfig wiring is needed and lint stays fast; the
// strict `tsc` in the gate already carries the type-aware checks. The React-hooks rules are the
// motivating gap (EH4): they were suppressed in places but never actually enforced.
export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "spikes/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/api/**/*.ts", "packages/**/*.ts"],
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
