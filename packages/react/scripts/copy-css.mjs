import { copyFile, mkdir } from "node:fs/promises"
import { watch } from "node:fs"
const source = new URL("../src/styles.css", import.meta.url)
const dist = new URL("../dist/", import.meta.url)
await mkdir(dist, { recursive: true })
const copy = () => copyFile(source, new URL("styles.css", dist))
await copy()
if (process.argv.includes("--watch")) {
  watch(new URL("../src/", import.meta.url), (_, filename) => {
    if (filename === "styles.css") void copy().catch(console.error)
  })
}
