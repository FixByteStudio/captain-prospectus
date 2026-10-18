import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  resolve: { alias: { "@": fileURLToPath(new URL("../src/client", import.meta.url)) } },
  define: { __APP_VERSION__: JSON.stringify("0.1.0"), __APP_COMMIT__: JSON.stringify("dev") },
  plugins: [react(), tailwindcss()],
  server: { port: 5791, strictPort: true },
});
