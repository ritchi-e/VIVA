import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { coursesApi, getApiErrorMessage, setOrganizationId } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { ProgressPanel } from '@/components/ui/Spinner'
import { PLATFORM_PROGRESS } from '@/lib/progressCopy'

export function JoinCoursePage() {
  const { code: codeParam } = useParams()
  const navigate = useNavigate()
  const { refreshProfile, isAuthenticated, isLoading } = useAuth()
  const [code, setCode] = useState((codeParam || '').toUpperCase())
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [autoTried, setAutoTried] = useState(false)

  const onJoin = async (raw: string) => {
    const normalized = raw.trim().toUpperCase()
    if (!normalized) {
      setErrorMsg('Enter a course code.')
      return
    }
    setSaving(true)
    setErrorMsg(null)
    try {
      const { data } = await coursesApi.join(normalized)
      setOrganizationId(data.organization_id)
      await refreshProfile()
      navigate(`/student/courses/${data.course.id}`, { replace: true })
    } catch (err) {
      setErrorMsg(getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (isLoading || !isAuthenticated || autoTried || !codeParam) return
    setAutoTried(true)
    void onJoin(codeParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, codeParam, autoTried])

  if (isLoading) return <ProgressPanel copy={PLATFORM_PROGRESS.session} />

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16">
        <PageHeader
          title="Join a course"
          description="Sign in with your student account, then we’ll enroll you."
        />
        <Alert tone="info">
          Course code: <span className="font-mono font-bold">{code || '—'}</span>
        </Alert>
        <Link to="/login" state={{ from: code ? `/join/${code}` : '/join' }}>
          <Button className="w-full">Sign in to join</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-8">
      <PageHeader
        title="Join a course"
        description="Enter the class code your instructor shared with you."
      />
      <Card>
        <CardBody>
          <form
            className="space-y-3"
            onSubmit={(e: FormEvent) => {
              e.preventDefault()
              void onJoin(code)
            }}
          >
            <Input
              label="Class code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. K7M2P9Q"
              autoCapitalize="characters"
              required
            />
            {errorMsg ? <Alert tone="danger">{errorMsg}</Alert> : null}
            <Button type="submit" loading={saving} className="w-full">
              Join
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
