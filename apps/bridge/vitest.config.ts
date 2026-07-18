import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Full-workspace runs otherwise start several complete App jsdom renders at once.
    // A single worker keeps the public release gate deterministic on constrained CI hosts.
    maxWorkers: 1,
    fileParallelism: false,
  },
});
