import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

// PORT is only required when running the dev/preview server. For `vite build`
// (the path Render uses) it has no meaning.
function resolveDevPort(): number | undefined {
  const raw = process.env.PORT;
  if (!raw) return undefined;
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) {
    throw new Error(`Invalid PORT value: "${raw}"`);
  }
  return n;
}

// BASE_PATH controls the public path prefix Vite uses for assets and routing.
// Defaults to "/" when unset (the common case for Render).
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(async ({ command }) => {
  const isServe = command === "serve";
  const port = resolveDevPort();
  if (isServe && port === undefined) {
    throw new Error(
      "PORT environment variable is required for `vite dev` / `vite preview`.",
    );
  }

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({
                root: path.resolve(import.meta.dirname, ".."),
              }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      ...(port !== undefined ? { port } : {}),
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      ...(port !== undefined ? { port } : {}),
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
