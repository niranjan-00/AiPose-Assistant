/// <reference types="vitest" />

import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Temporarily disabled for production stability.
// We will re-enable PWA after the production build works.
const testConfig = {
  environment: "jsdom",
  globals: true,
  setupFiles: ["./src/test/setup.ts"],
  include: ["src/**/*.{test,spec}.{ts,tsx}"],
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  build: {
    target: "es2020",
    sourcemap: true,
    chunkSizeWarningLimit: 4096,

    // IMPORTANT:
    // Do NOT externalize @mediapipe/pose or @mediapipe/tasks-vision.
    // Vite/Rollup must bundle them so the browser can load them.
  },

  server: {
    host: true,
    port: 5173,
  },

  test: testConfig,
} as UserConfig & { test: typeof testConfig });