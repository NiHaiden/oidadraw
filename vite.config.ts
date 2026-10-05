import { defineConfig, loadEnv } from "vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import type { Plugin } from "vite"

// A tsc rebuild replaces many interdependent modules (including React context).
// Reload once after its writes settle instead of refreshing partial generations.
function reloadWorkspacePackages(): Plugin {
  let pending: ReturnType<typeof setTimeout> | undefined
  return {
    name: "reload-workspace-packages",
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

const config = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const target = `http://127.0.0.1:${process.env.PORT ?? (env.PORT || "8080")}`
  return {
    resolve: { tsconfigPaths: true },
    server: {
      // Keep auth and collaborative sync on the same browser origin during dev.
      proxy: {
        "/api": { target },
        "/sync": { target, ws: true },
      },
    },
    plugins: [
      reloadWorkspacePackages(),
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      viteReact(),
      tailwindcss(),
    ],
  }
})

export default config
