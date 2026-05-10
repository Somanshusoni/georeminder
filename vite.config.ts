import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    base: "/georeminder/",

    plugins: [
      react(),

      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["icon-192.png", "icon-512.png"],
        manifest: {
          name: "GeoReminder",
          short_name: "GeoReminder",
          description: "Smart location based reminder app",
          start_url: "/",
          scope: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#0f172a",
          icons: [
            {
              src: "/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],


    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
