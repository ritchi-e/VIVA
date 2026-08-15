import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { LogoStacked } from '@/components/brand/Logo'
import { useAuth } from '@/context/AuthContext'
import { getApiErrorMessage } from '@/lib/api'

export function LoginPage() {
  const { login, loginWithGoogle, isAuthenticated, isStudent } = useAuth()
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
          <Link to="/" className="inline-block">
            <LogoStacked className="mx-auto h-28" />
          </Link>
          <p className="mt-3 text-sm text-slate-500">Oral assessment grounded in student work</p>
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
          <div className="mt-5">
            <p className="mb-3 text-center text-xs uppercase tracking-[0.14em] text-slate-400">or</p>
            <GoogleSignInButton
              disabled={loading}
              onCredential={(credential) => {
                setLoading(true)
                setError(null)
                void loginWithGoogle({ credential })
                  .then(() => navigate('/', { replace: true }))
                  .catch((err) => setError(getApiErrorMessage(err)))
                  .finally(() => setLoading(false))
              }}
            />
          </div>
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
