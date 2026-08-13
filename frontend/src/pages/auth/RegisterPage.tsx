import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { getApiErrorMessage } from '@/lib/api'

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [role, setRole] = useState('instructor')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await register({
        email,
        password,
        full_name: fullName,
        organization_name: organizationName,
        role,
      })
      navigate(role === 'student' ? '/student/dashboard' : '/dashboard')
    } catch (err) {
      setError(getApiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-80 w-80 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-cyan-400/15 blur-3xl" />
      </div>
      <div className="relative w-full max-w-lg animate-viva-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 font-display text-sm font-bold text-white shadow-lg shadow-teal-700/25">
            AV
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">AI Viva</h1>
          <p className="mt-2 text-sm text-slate-500">Create a workspace for oral assessment</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white/90 p-6 shadow-xl shadow-slate-900/5 backdrop-blur-sm sm:p-8">
          <h2 className="font-display text-lg font-semibold text-slate-900">Create your account</h2>
          <p className="mt-1 text-sm text-slate-500">Instructors and students share one platform</p>
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="Organization name"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g. Computer Science Dept"
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700" htmlFor="role">
                Role
              </label>
              <select
                id="role"
                className="w-full rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="instructor">Instructor</option>
                <option value="student">Student</option>
                <option value="organization_admin">Organization admin</option>
              </select>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit" className="w-full" loading={loading}>
              Create account
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link className="font-medium text-teal-800 hover:underline" to="/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
