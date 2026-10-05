import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import type { Plugin } from "vite"

function reloadPackages(): Plugin {
  let pending: ReturnType<typeof setTimeout> | undefined
  return {
    name: "demo-reload-packages",
    handleHotUpdate({ file, server }) {
      if (!/\/packages\/(core|react|sync)\/dist\//.test(file)) return
      clearTimeout(pending)
      pending = setTimeout(() => server.ws.send({ type: "full-reload" }), 100)
      return []
    },
    closeBundle() {
      clearTimeout(pending)
    },
  }
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  publicDir: false,
  plugins: [reloadPackages(), react()],
  server: { host: "127.0.0.1", port: 3002, strictPort: true },
  preview: { host: "127.0.0.1", port: 3002, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
})
