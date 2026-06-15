import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Load env from the repo root (one shared .env for API + web). Vite still only exposes
// VITE_-prefixed vars to client code; non-prefixed vars (DATABASE_URL, CORS_ORIGINS, …) stay
// server-only.
const envDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  envDir,
});
