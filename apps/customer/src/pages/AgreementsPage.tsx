/**
 * AgreementsPage · /settings/agreements 协议中心（客户端体验大批 片 1 · 账户体系域）
 *
 * 四件：用户协议 / 隐私政策 / 会员服务协议 / 寄养协议——列表行点开全文（BottomSheet
 * 既有件）。会员服务协议全文=copy/pay.ts PAY_AGREEMENTS 同源件（member_service，
 * 版本同源）；其余三件=copy/agreements.ts AGR_DOCS 内测期简版诚实文本（明面注记
 * 「内测期简版，正式条款以上线版本与门店公示为准」，不虚构条款）。
 * 返回=PushBar 时间序回退，直访兜底 /settings/about。文案全走 copy/agreements.ts（agc）。
 */

import { useState } from 'react'
import BottomSheet from '../components/booking/single/BottomSheet'
import { PushBar } from '../components/member/v2'
import { agc, AGR_DOCS } from '../copy/agreements'
import { PAY_AGREEMENTS } from '../copy/pay'

interface AgreementEntry {
  key: string
  title: string
  version: string
  content: string
  /** 内测期简版注记（会员服务协议为正式同源件，不打简版标） */
  beta: boolean
}

const ENTRIES: readonly AgreementEntry[] = [
  ...AGR_DOCS.filter((d) => d.agreementKey === 'user').map((d) => ({
    key: d.agreementKey,
    title: agc(d.titleKey),
    version: d.version,
    content: d.content,
    beta: true,
  })),
  ...AGR_DOCS.filter((d) => d.agreementKey === 'privacy').map((d) => ({
    key: d.agreementKey,
    title: agc(d.titleKey),
    version: d.version,
    content: d.content,
    beta: true,
  })),
  ...PAY_AGREEMENTS.filter((d) => d.agreementKey === 'member_service').map((d) => ({
    key: d.agreementKey,
    title: agc('agr.memberService'),
    version: d.version,
    content: d.content,
    beta: false,
  })),
  ...AGR_DOCS.filter((d) => d.agreementKey === 'boarding').map((d) => ({
    key: d.agreementKey,
    title: agc(d.titleKey),
    version: d.version,
    content: d.content,
    beta: true,
  })),
]

export default function AgreementsPage() {
  const [open, setOpen] = useState<AgreementEntry | null>(null)

  return (
    <div className="m2" data-testid="agreements-page" style={{ minHeight: '100vh' }}>
      <PushBar label={agc('agr.pushLabel')} fallback="/settings/about" />
      <div className="m2-apphead">
        <span className="tt">{agc('agr.title')}</span>
      </div>

      <div className="m2-pad" style={{ marginTop: 14, paddingBottom: 60 }}>
        <div className="m2-card overflow-hidden">
          {ENTRIES.map((e) => (
            <button
              key={e.key}
              type="button"
              data-testid={`agreement-${e.key}`}
              onClick={() => setOpen(e)}
              className="flex w-full items-center gap-3 border-t border-line-divider px-4 py-3.5 text-left first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-body font-semibold text-ink">{e.title}</div>
                <div className="m2-mono mt-0.5 text-[10px] text-ink-secondary">
                  {agc('agr.version', { version: e.version })}
                  {e.beta ? ` · ${agc('agr.betaMark')}` : ''}
                </div>
              </div>
              <span className="flex-none text-body text-ink-placeholder" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <p className="m2-note mt-4 text-center">{agc('agr.betaNote')}</p>
      </div>

      {open ? (
        <BottomSheet title={open.title} onClose={() => setOpen(null)} testId="agreement-sheet">
          <p className="m2-mono text-[10px] text-ink-secondary">
            {agc('agr.version', { version: open.version })}
            {open.beta ? ` · ${agc('agr.betaMark')}` : ''}
          </p>
          {open.beta ? <p className="m2-note mt-2">{agc('agr.betaNote')}</p> : null}
          <div className="mt-3 whitespace-pre-line text-body-sm leading-[1.9] text-ink">{open.content}</div>
        </BottomSheet>
      ) : null}
    </div>
  )
}
