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
      navigate(from ?? '/', { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="relative w-full max-w-md animate-viva-fade-up">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block">
            <LogoStacked className="mx-auto h-28" />
          </Link>
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Oral assessment grounded in student work
          </p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-[var(--color-foreground)]">Sign in</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Continue to your workspace</p>

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
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            <Button type="submit" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>
          <div className="mt-5">
            <p className="mb-3 text-center text-xs uppercase tracking-[0.14em] text-[var(--color-muted)]">or</p>
            <GoogleSignInButton
              disabled={loading}
              onCredential={(credential) => {
                setLoading(true)
                setError(null)
                void loginWithGoogle({ credential })
                  .then(() => navigate(from ?? '/', { replace: true }))
                  .catch((err) => setError(getApiErrorMessage(err)))
                  .finally(() => setLoading(false))
              }}
            />
          </div>
          <p className="mt-5 text-center text-sm text-[var(--color-muted)]">
            No account?{' '}
            <Link className="font-medium text-[var(--color-primary)] hover:underline" to="/register">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
