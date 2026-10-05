import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@tanstack/react-router"

import { getRouter } from "./router"
import "./styles.css"
import "@kritzlboard/react/styles.css"

const router = getRouter()

const root = createRoot(document.getElementById("root")!)
root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)

if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
