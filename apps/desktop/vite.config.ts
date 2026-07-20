import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@agent-test/contracts": path.resolve(__dirname, "../../packages/contracts/src/index.ts"),
      "@agent-test/permissions": path.resolve(__dirname, "../../packages/permissions/src/index.ts"),
      "@agent-test/runtime": path.resolve(__dirname, "../../packages/runtime/src/index.ts"),
      "@agent-test/agents": path.resolve(__dirname, "../../packages/agents/src/index.ts"),
      "@agent-test/mocks": path.resolve(__dirname, "../../packages/mocks/src/index.ts"),
      "@agent-test/ui": path.resolve(__dirname, "../../packages/ui/src/index.ts"),
    },
  },
  server: { port: 5173 },
  build: { outDir: "dist" },
});
