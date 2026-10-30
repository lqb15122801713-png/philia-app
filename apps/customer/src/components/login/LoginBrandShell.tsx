import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { lc } from '@/copy/login'

export default function LoginBrandShell({ children, footerNote }: { children: ReactNode; footerNote?: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col pb-8" data-testid="login-brand-shell">
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
          {lc('login.manifestoA')}
          <br />
          {lc('login.manifestoB')}
          <em className="not-italic" style={{ background: 'linear-gradient(transparent 62%, #F2DFA6 62%)' }}>
            {lc('login.manifestoEm')}
          </em>
          {lc('login.manifestoC')}
        </h1>
        <p className="mt-[14px] text-caption-xs font-medium tracking-[.14em] text-ink-secondary">
          {lc('login.tagline')}
        </p>
        <span className="mt-[22px] block h-[1.5px] w-11 bg-brand-primary" aria-hidden="true" />
      </header>

      {children}

      <footer className="mt-10 px-10 text-center text-caption-xs leading-[1.8] text-ink-placeholder">
        {lc('login.footerAgree')}
        <Link to="/agreements?doc=user" data-testid="login-agreement-user" className="underline underline-offset-2">
          {lc('login.footerUser')}
        </Link>
        {lc('login.footerAnd')}
        <Link to="/agreements?doc=privacy" data-testid="login-agreement-privacy" className="underline underline-offset-2">
          {lc('login.footerPrivacy')}
        </Link>
        {footerNote ? (
          <>
            <br />
            {footerNote}
          </>
        ) : null}
      </footer>
    </div>
  )
}
