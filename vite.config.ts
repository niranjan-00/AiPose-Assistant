/// <reference types="vitest" />
import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// We still inline the runtime JS/CSS into a single index.html for portable
// preview, but the PWA manifest + service worker are emitted as separate
// assets so the app is installable.
const singleFileEnabled = process.env.AIPOSE_DISABLE_SINGLEFILE !== "true";

// Vitest config — kept as a plain object because vitest has its own vite
// resolution that conflicts with our project's vite.
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
    ...(singleFileEnabled ? [viteSingleFile()] : []),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "AiPose Assistant",
        short_name: "AiPose",
        description:
          "AI-powered real-time fitness, posture, and pose coaching. All pose processing happens on your device.",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "index.html",
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 4096,
    rollupOptions: {
      // TensorFlow pose-detection dynamically imports @mediapipe/* packages
      // for BlazePose/MediaPipe variants we don't use. Mark them as external
      // so Rollup doesn't try to bundle them.
      external: ["@mediapipe/pose", "@mediapipe/tasks-vision"],
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  // Vitest reads this — cast via `as` to keep TS happy across the
  // dual-vite-resolution setup.
  test: testConfig,
} as UserConfig & { test: typeof testConfig });
