import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === "production";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
    define: isProduction
      ? {
          "process.env.NODE_ENV": JSON.stringify("production"),
        }
      : undefined,
    build: isProduction
      ? {
          lib: {
            entry: path.resolve(__dirname, "src/widget.tsx"),
            name: "CollegeChatbot",
            fileName: "widget",
            formats: ["iife"],
          },
          rollupOptions: {
            output: {
              entryFileNames: "widget.js",
              assetFileNames: "widget.[ext]",
              inlineDynamicImports: true,
            },
          },
          cssCodeSplit: false,
        }
      : undefined,
  };
});
