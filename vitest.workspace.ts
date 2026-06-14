import react from "@vitejs/plugin-react";
import { defineWorkspace } from "vitest/config";

// Two projects so each runs in the right environment: pure domain + API on node,
// the React UI on jsdom. `spikes/` (throwaway, node:test) is intentionally not included.
export default defineWorkspace([
  {
    test: {
      name: "node",
      include: ["packages/**/*.test.ts", "apps/api/**/*.test.ts"],
      environment: "node",
    },
  },
  {
    plugins: [react()],
    test: {
      name: "web",
      include: ["apps/web/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      setupFiles: ["./apps/web/src/test/setup.ts"],
    },
  },
]);
