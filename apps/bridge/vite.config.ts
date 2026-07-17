import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 750,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "schema-validators",
              test: (moduleId) =>
                moduleId.includes("/packages/schemas/") ||
                moduleId.includes("/node_modules/.pnpm/ajv-formats@") ||
                moduleId.includes("/node_modules/.pnpm/ajv@"),
              priority: 40,
            },
            {
              name: "documents-archive",
              test: (moduleId) =>
                moduleId.includes("/packages/documents/") ||
                moduleId.includes("/node_modules/.pnpm/fflate@"),
              priority: 30,
            },
            {
              name: "react-vendor",
              test: (moduleId) =>
                moduleId.includes("/node_modules/.pnpm/react@") ||
                moduleId.includes("/node_modules/.pnpm/react-dom@") ||
                moduleId.includes("/node_modules/.pnpm/scheduler@"),
              priority: 20,
            },
            {
              name: "vendor",
              test: (moduleId) =>
                moduleId.includes("/node_modules/") && !moduleId.includes("/pdfjs-dist/"),
              priority: 10,
            },
          ],
        },
      },
    },
    sourcemap: false,
    target: "es2022",
  },
});
