import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // No escanear copias de tests dentro de worktrees del agente (.claude/worktrees/*)
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
