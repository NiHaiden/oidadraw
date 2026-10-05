import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "@fontsource-variable/inter/index.css"
import "@fontsource-variable/caveat/index.css"
import "@kritzlboard/react/styles.css"
import "./styles.css"
import { App } from "./App"

const root = createRoot(document.getElementById("root")!)
root.render(<StrictMode><App /></StrictMode>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
