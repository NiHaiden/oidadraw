import { Outlet, createRootRoute } from "@tanstack/react-router"

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="text-lg font-semibold">404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
})
