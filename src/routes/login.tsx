import { useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { signIn, signUp } from "@/lib/auth-client"
import { setUserName } from "@/lib/user"

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const { redirect } = Route.useSearch()
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const result =
      mode === "signup"
        ? await signUp.email({ name: name.trim(), email, password })
        : await signIn.email({ email, password })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? "Something went wrong")
      return
    }
    // cursors and presence should show the account name
    if (result.data.user.name) setUserName(result.data.user.name)
    navigate({ to: redirect ?? "/" })
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6 py-16">
      <Link to="/" className="text-2xl font-bold tracking-tight">
        kritzlboard
      </Link>
      <h1 className="mt-8 text-lg font-semibold">
        {mode === "signin" ? "Sign in" : "Create an account"}
      </h1>

      <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
        {mode === "signup" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-700">Name</span>
            <input
              className="rounded-md border border-border px-3 py-2 outline-none focus:border-blue-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Email</span>
          <input
            className="rounded-md border border-border px-3 py-2 outline-none focus:border-blue-500"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Password</span>
          <input
            className="rounded-md border border-border px-3 py-2 outline-none focus:border-blue-500"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="mt-1" disabled={busy}>
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </Button>
      </form>

      <button
        className="mt-4 text-left text-sm text-neutral-500 hover:text-neutral-800"
        onClick={() => {
          setError(null)
          setMode(mode === "signin" ? "signup" : "signin")
        }}
      >
        {mode === "signin"
          ? "No account yet? Create one"
          : "Already have an account? Sign in"}
      </button>
    </main>
  )
}
