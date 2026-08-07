import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The PowerSync client needs SharedArrayBuffer for its WASM SQLite (wa-sqlite),
// which requires these cross-origin isolation headers — see plan §4/risks.
export default defineConfig({
  // PowerSync's WASM SQLite runs in a worker; Vite's default IIFE worker
  // format is incompatible with code-split builds (vite-plugin-pwa's SW
  // build triggers this) — see https://github.com/vitejs/vite/issues/18585.
  worker: { format: "es" },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // PowerSync ships several wa-sqlite WASM builds (sync/async, with
        // multi-core variants) up to ~2.5 MB each — comfortably over
        // workbox's 2 MB default precache limit. The app must still boot
        // fully offline, so these have to be precached, not lazily fetched.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // network-first for API calls, cache-first for the app shell —
        // the offline PWA must still boot with zero connectivity.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: { cacheName: "api-cache", networkTimeoutSeconds: 5 },
          },
        ],
      },
      manifest: {
        name: "Jumelle Café — Terrain",
        short_name: "Jumelle Terrain",
        description: "Enregistrement producteurs, parcelles, collectes et audits hors-ligne",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#166534",
        icons: [],
      },
    }),
  ],
  // @powersync/web and wa-sqlite ship their own web workers + WASM; esbuild's
  // dependency pre-bundling breaks that (https://github.com/vitejs/vite/issues/11672),
  // which manifests as PowerSyncDatabase.connect() hanging forever in dev
  // mode with zero worker/wasm network activity — exclude both from it.
  optimizeDeps: {
    exclude: ["@journeyapps/wa-sqlite", "@powersync/web"],
  },
  server: {
    port: 5174,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
