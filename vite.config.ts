import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  root: "/home/z/my-project",
  resolve: {
    alias: {
      "@core": fileURLToPath(new URL("./src/core", import.meta.url)),
      "@client": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@data": fileURLToPath(new URL("./src/data", import.meta.url)),
      "@net": fileURLToPath(new URL("./src/net", import.meta.url)),
      "@types": fileURLToPath(new URL("./src/types", import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: {
      // Restrict file serving to project source + dependencies only.
      // Prevents Vite from scanning stray HTML files (e.g., in skills/).
      allow: [
        "/home/z/my-project/src",
        "/home/z/my-project/index.html",
        "/home/z/my-project/node_modules",
      ],
    },
  },
  optimizeDeps: {
    // Only scan src/ for dependency imports — avoids random HTML files
    // in adjacent directories that import packages we don't have.
    entries: ["src/**/*.ts"],
  },
});

