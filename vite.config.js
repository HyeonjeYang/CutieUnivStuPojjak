import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = realpathSync(fileURLToPath(new URL(".", import.meta.url)));

export default defineConfig({
  root: projectRoot,
  clearScreen: false,
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
  },
});
