import { devLoginByPhone, getApiBase, useMe, usePhiliaClient } from '@philia/shared'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mc } from '@/components/member/copy'
import { dc } from '@/copy/devlogin'

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
      setError(err instanceof Error ? err.message : '登录失败，请稍后重试')
    } finally {
      setPending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-caption text-ink-secondary">加载中…</p>
      </div>
    )
  }

  if (user) return <Navigate to={destination} replace />

  return (
    <div className="flex min-h-screen flex-col pb-8">
      <header className="px-8 pt-14">
        <span className="u1-ring flex h-[54px] w-[54px] items-center justify-center rounded-full bg-card" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 32 32" fill="#3B2E24">
            <circle cx="10.4" cy="11" r="3.1" />
            <circle cx="21.6" cy="11" r="3.1" />
            <circle cx="6.9" cy="17.2" r="2.7" />
            <circle cx="25.1" cy="17.2" r="2.7" />
            <path d="M16 15.5c-3.9 0-7 2.9-7 6 0 2 1.5 3.4 3.3 3.4 1.3 0 2.4-.7 3.7-.7s2.4.7 3.7.7c1.8 0 3.3-1.4 3.3-3.4 0-3.1-3.1-6-7-6z" />
          </svg>
        </span>
        <h1 className="u1-serif mt-[30px] text-v2-manifesto tracking-[.04em]">
          {mc('l1.manifestoA')}
          <br />
          {mc('l1.manifestoB')}
          <em className="not-italic" style={{ background: 'linear-gradient(transparent 62%, #F2DFA6 62%)' }}>
            {mc('l1.manifestoEm')}
          </em>
          {mc('l1.manifestoC')}
        </h1>
        <p className="mt-[14px] text-caption-xs font-medium tracking-[.14em] text-ink-secondary">
          {dc('devlogin.tagline')}
        </p>
        <span className="mt-[22px] block h-[1.5px] w-11 bg-brand-primary" aria-hidden="true" />
      </header>

      <main className="mt-10 flex-1 px-8">
        <form
          data-testid="product-login-form"
          method="post"
          action={`${getApiBase()}/api/auth/dev-login`}
          onSubmit={(event) => void submit(event)}
        >
          <h2 className="text-title">{dc('devlogin.phoneTitle')}</h2>
          <p id="product-login-phone-help" className="mt-2 text-caption leading-[1.8] text-ink-secondary">
            {dc('devlogin.phoneBody')}
          </p>
          <label htmlFor="product-login-phone" className="mt-6 block text-body-sm font-semibold text-ink">
            手机号
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
            placeholder="11 位手机号"
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
            {pending ? '登录中…' : '手机号登录'}
          </Button>
        </form>
      </main>

      <footer className="mt-10 px-10 text-center text-caption-xs leading-[1.8] text-ink-placeholder">
        {dc('devlogin.footerAgree')}
        <Link to="/agreements?doc=user" data-testid="login-agreement-user" className="underline underline-offset-2">
          {dc('devlogin.footerUser')}
        </Link>
        {dc('devlogin.footerAnd')}
        <Link to="/agreements?doc=privacy" data-testid="login-agreement-privacy" className="underline underline-offset-2">
          {dc('devlogin.footerPrivacy')}
        </Link>
      </footer>
    </div>
  )
}
