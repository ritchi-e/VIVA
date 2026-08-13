import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { getApiErrorMessage } from '@/lib/api'

export function LoginPage() {
  const { login, isAuthenticated, isStudent } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to={from ?? (isStudent ? '/student/dashboard' : '/dashboard')} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login({ email, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
      </div>
      <div className="relative w-full max-w-md animate-viva-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 font-display text-sm font-bold text-white shadow-lg shadow-teal-700/25">
            AV
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">AI Viva</h1>
          <p className="mt-2 text-sm text-slate-500">Oral assessment grounded in student work</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:p-8">
          <h2 className="font-display text-lg font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Continue to your workspace</p>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            No account?{' '}
            <Link className="font-medium text-teal-800 hover:underline" to="/register">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
