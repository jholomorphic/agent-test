import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      "@agent-test/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts"),
      "@agent-test/permissions": path.resolve(__dirname, "../../packages/permissions/src/index.ts"),
      "@agent-test/runtime": path.resolve(__dirname, "../../packages/runtime/src/index.ts"),
      "@agent-test/agents": path.resolve(__dirname, "../../packages/agents/src/index.ts"),
      "@agent-test/mocks": path.resolve(__dirname, "../../packages/mocks/src/index.ts"),
      "@agent-test/private": path.resolve(__dirname, "../../packages/private/src/index.ts"),
      "@agent-test/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    outDir: "dist",
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
