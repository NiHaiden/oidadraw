import { defineConfig, loadEnv } from "vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

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
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      viteReact(),
      tailwindcss(),
    ],
  }
})

export default config
