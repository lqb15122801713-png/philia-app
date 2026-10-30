import { devLoginByPhone, getApiBase, useMe, usePhiliaClient } from '@philia/shared'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoginBrandShell from '@/components/login/LoginBrandShell'
import { lc } from '@/copy/login'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { queryClient } = usePhiliaClient()
  const { user, loading } = useMe()
  const [phone, setPhone] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from
  const destination = from && from !== '/login' && from !== '/dev-login' ? from : '/home'

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await devLoginByPhone(getApiBase(), phone.trim())
      await queryClient.invalidateQueries()
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : lc('login.failed'))
    } finally {
      setPending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-caption text-ink-secondary">{lc('login.loading')}</p>
      </div>
    )
  }

  if (user) return <Navigate to={destination} replace />

  return (
    <LoginBrandShell>
      <main className="mt-10 flex-1 px-8">
        <form
          data-testid="product-login-form"
          method="post"
          action={`${getApiBase()}/api/auth/dev-login`}
          onSubmit={(event) => void submit(event)}
        >
          <h2 className="text-title">{lc('login.phoneTitle')}</h2>
          <p id="product-login-phone-help" className="mt-2 text-caption leading-[1.8] text-ink-secondary">
            {lc('login.phoneBody')}
          </p>
          <label htmlFor="product-login-phone" className="mt-6 block text-body-sm font-semibold text-ink">
            {lc('login.phoneLabel')}
          </label>
          <Input
            id="product-login-phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            enterKeyHint="done"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            required
            pattern="1[0-9]{10}"
            maxLength={11}
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))
              setError(null)
            }}
            placeholder={lc('login.phonePlaceholder')}
            aria-describedby="product-login-phone-help"
            className="mt-2 min-h-12 rounded-control bg-card text-body"
            data-testid="product-login-phone"
          />
          {error ? (
            <p role="alert" className="mt-3 rounded-panel bg-danger-light px-4 py-3 text-caption text-danger-deep">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            disabled={pending}
            className="mt-4 min-h-12 w-full rounded-control bg-[#2E2318] text-body-sm font-semibold text-[#F6EFDD] hover:bg-[#2E2318]/90"
            data-testid="product-login-submit"
          >
            {pending ? lc('login.pending') : lc('login.submit')}
          </Button>
        </form>
      </main>
    </LoginBrandShell>
  )
}
