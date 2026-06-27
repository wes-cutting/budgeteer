import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two modes:
//  • App build (default): bundles index.html → dist/  (used for the runnable lead screen + axe).
//  • Lib measure (SPIKE_ENTRY set): bundles one entry, React externalized, so the gzipped output
//    isolates JUST that library's own code → clean per-library bundle-cost comparison.
const entry = process.env.SPIKE_ENTRY;
const outDir = process.env.SPIKE_OUT ?? "dist";

export default defineConfig(
  entry
    ? {
        plugins: [react()],
        build: {
          outDir,
          emptyOutDir: true,
          minify: "esbuild",
          lib: { entry, formats: ["es"], fileName: "bundle" },
          rollupOptions: {
            external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
          },
        },
      }
    : {
        plugins: [react()],
        build: { outDir, emptyOutDir: true },
      },
);
