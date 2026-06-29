import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Main harness build: the hand-rolled SVG chart + table fallback. Single chunk so the gzip
// number is directly comparable to the V1 app's bundle line in docs/07_NFR.md.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    rollupOptions: { output: { manualChunks: undefined } },
  },
});
