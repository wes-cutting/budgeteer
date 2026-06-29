import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Bundle-cost MEASUREMENT build, using the same React-externalized lib-mode technique as
// SPIKE-06: the emitted gzip is *only* the entry's own code (React/ReactDOM excluded, since the
// app already bundles them). So the number is "what this chart approach would ADD to the app
// bundle". Drive entry/outDir via env so the hand-rolled chart and Recharts are measured the same
// way:  MEASURE_ENTRY=src/measure/recharts-entry.tsx MEASURE_OUT=dist-recharts vite build --config …
const entry = process.env.MEASURE_ENTRY ?? "src/measure/recharts-entry.tsx";
const outDir = process.env.MEASURE_OUT ?? "dist-recharts";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir,
    lib: { entry, formats: ["es"], fileName: "measure" },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
  },
});
