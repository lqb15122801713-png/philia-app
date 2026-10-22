/**
 * LotteryPage · /member/lottery 回馈抽奖真转盘页（PD-82）
 *
 * 修复：首页「回馈抽奖」卡原硬链 /member（会员中心无转盘）——本页为真转盘：
 * SVG 八格轮盘 + 顶部指针 + 主钮三态（开始/抽奖中/再抽一次）+ CSS 旋转动画
 * 落定 + 结果区（中奖/再来一次/未中三态文案）。
 *
 * 奖品=前端 mock（本批无服务端抽奖台账/发放链）：奖项文案全走 copy/lottery.ts
 * 键表（端口可改），页内明面 mock 注记，不虚构真实发放、不碰钱域。
 * 详情级无 dock；PushBar 返回条（时间序回退，直访兜底 /home）＝导航闭环四要素。
 */

import { useRef, useState } from 'react'
import { CK } from '@philia/shared'
import { AppHead, PushBar } from '../components/member/v2'
import { lty, type LotteryCopyKey } from '../copy/lottery'

const SEGMENTS = 8
const SEG_DEG = 360 / SEGMENTS
const WHEEL_SIZE = 264
const CX = WHEEL_SIZE / 2
const RADIUS = CX - 6
const SPIN_TURNS = 5
const SPIN_MS = 4600

const PRIZE_KEYS: LotteryCopyKey[] = [
  'lty.prize0', 'lty.prize1', 'lty.prize2', 'lty.prize3',
  'lty.prize4', 'lty.prize5', 'lty.prize6', 'lty.prize7',
]
const SEG_FILL = ['#F6EFDD', '#F2DFA6']

/** 指针=正上方 12 点位；格 i 本地中心角（屏幕坐标 0°=东，顺时针）= i*45 − 90 + 22.5 */
const segCenterDeg = (i: number) => i * SEG_DEG - 90 + SEG_DEG / 2
/** 使格 i 中心落定指针位所需的总转角（在当前 deg 基础上 +5 圈） */
const landingDeg = (current: number, i: number) => {
  const want = -90 - segCenterDeg(i)
  const delta = ((want - current) % 360 + 360) % 360
  return current + 360 * SPIN_TURNS + delta
}

function segPath(i: number): string {
  const a0 = ((i * SEG_DEG - 90) * Math.PI) / 180
  const a1 = (((i + 1) * SEG_DEG - 90) * Math.PI) / 180
  const x0 = CX + RADIUS * Math.cos(a0)
  const y0 = CX + RADIUS * Math.sin(a0)
  const x1 = CX + RADIUS * Math.cos(a1)
  const y1 = CX + RADIUS * Math.sin(a1)
  return `M ${CX} ${CX} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${RADIUS} ${RADIUS} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
}

export default function LotteryPage() {
  const [deg, setDeg] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<number | null>(null)
  const targetRef = useRef<number | null>(null)
  const spinIdRef = useRef(0)

  /* 落定=transitionend 为准；兜底定时器防动画事件丢失（如减少动效设置）。
     两处幂等；spinId 闸挡前一轮兜底定时器越过新一轮（连点竞态） */
  const settle = (spinId: number) => {
    if (spinId !== spinIdRef.current) return
    setSpinning(false)
    setResult(targetRef.current)
  }

  const onSpin = () => {
    if (spinning) return
    spinIdRef.current += 1
    const spinId = spinIdRef.current
    targetRef.current = Math.floor(Math.random() * SEGMENTS)
    setResult(null)
    setSpinning(true)
    setDeg((current) => landingDeg(current, targetRef.current!))
    window.setTimeout(() => settle(spinId), SPIN_MS + 200)
  }

  const prize = result !== null ? lty(PRIZE_KEYS[result]!) : null
  const resultText =
    result === null ? null
    : PRIZE_KEYS[result] === 'lty.prize7' ? lty('lty.resultRetry')
    : PRIZE_KEYS[result] === 'lty.prize3' ? lty('lty.resultNone')
    : lty('lty.resultWin', { prize: prize ?? '' })

  return (
    <div className="m2" data-testid="lottery-page" style={{ minHeight: '100vh' }}>
      <PushBar label={lty('lty.pushLabel')} fallback="/home" />
      <AppHead title={lty('lty.title')} />
      <div className="m2-pad" style={{ paddingBottom: 60 }}>
        <p className="m2-note" style={{ padding: '0 4px' }} data-testid="lottery-sub">
          <CK k="lty.sub">{lty('lty.sub')}</CK>
        </p>

        {/* 转盘区：顶部指针 + 八格轮盘（旋转件=外层 div，transform-origin 盘心） */}
        <section className="m2-card" style={{ marginTop: 12, padding: '22px 16px 18px' }} aria-label={lty('lty.title')}>
          <div style={{ position: 'relative', width: WHEEL_SIZE, margin: '0 auto' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute', left: '50%', top: -8, transform: 'translateX(-50%)',
                width: 0, height: 0, zIndex: 2,
                borderLeft: '9px solid transparent', borderRight: '9px solid transparent',
                borderTop: '14px solid #3B2E24',
              }}
            />
            <div
              data-testid="lottery-wheel"
              data-deg={Math.round(deg)}
              onTransitionEnd={() => {
                if (spinning) settle(spinIdRef.current)
              }}
              style={{
                width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: '50%',
                transform: `rotate(${deg}deg)`, transformOrigin: '50% 50%',
                transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.12,.8,.08,1)` : 'none',
                boxShadow: '0 10px 28px -14px rgba(44,40,34,.45)', border: '3px solid #3B2E24',
                overflow: 'hidden',
              }}
            >
              <svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`} role="img" aria-label={lty('lty.title')}>
                {PRIZE_KEYS.map((key, i) => {
                  const mid = segCenterDeg(i)
                  const lx = CX + (RADIUS * 0.62) * Math.cos((mid * Math.PI) / 180)
                  const ly = CX + (RADIUS * 0.62) * Math.sin((mid * Math.PI) / 180)
                  return (
                    <g key={key}>
                      <path d={segPath(i)} fill={SEG_FILL[i % 2]} stroke="#3B2E24" strokeWidth={1} />
                      <text
                        x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                        fontSize={11} fontWeight={700} fill="#3B2E24"
                        transform={`rotate(${mid + 90} ${lx} ${ly})`}
                      >
                        {lty(key)}
                      </text>
                    </g>
                  )
                })}
                <circle cx={CX} cy={CX} r={20} fill="#3B2E24" />
                <circle cx={CX} cy={CX} r={8} fill="#F2DFA6" />
              </svg>
            </div>
          </div>

          <button
            type="button"
            data-testid="lottery-spin"
            disabled={spinning}
            onClick={onSpin}
            className="m2-press"
            style={{
              display: 'block', width: '100%', marginTop: 18, padding: '14px 0',
              borderRadius: 14, border: 'none', background: '#2E2318', color: '#F6EFDD',
              fontSize: 15, fontWeight: 700, cursor: spinning ? 'default' : 'pointer',
              opacity: spinning ? 0.7 : 1,
            }}
          >
            {spinning ? lty('lty.spinning') : result !== null ? lty('lty.again') : lty('lty.spin')}
          </button>

          {resultText ? (
            <div
              className="m2-card"
              data-testid="lottery-result"
              role="status"
              style={{ marginTop: 12, padding: '12px 16px', textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: 'var(--v2ink)' }}
            >
              <span className="sr-only">{lty('lty.resultTitle')}：</span>
              <CK k={PRIZE_KEYS[result!]!}>{resultText}</CK>
            </div>
          ) : null}
        </section>

        {/* 奖池明面（八格同源 copy）＋规则＋mock 诚实注记 */}
        <section className="m2-card" style={{ marginTop: 12, padding: '4px 16px' }} data-testid="lottery-pool" aria-label={lty('lty.rulesTitle')}>
          {PRIZE_KEYS.map((key) => (
            <div className="m2-rowx" key={key} data-testid={`lottery-prize-${key}`}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}><CK k={key}>{lty(key)}</CK></span>
            </div>
          ))}
        </section>
        <section className="m2-card" style={{ marginTop: 12, padding: '12px 16px' }} data-testid="lottery-rules">
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--v2ink)' }}><CK k="lty.rulesTitle">{lty('lty.rulesTitle')}</CK></p>
          <p className="m2-note" style={{ marginTop: 6 }}><CK k="lty.rule1">{lty('lty.rule1')}</CK></p>
          <p className="m2-note" style={{ marginTop: 4 }}><CK k="lty.rule2">{lty('lty.rule2')}</CK></p>
          <p className="m2-note" style={{ marginTop: 8 }} data-testid="lottery-mock-note"><CK k="lty.mockNote">{lty('lty.mockNote')}</CK></p>
        </section>
      </div>
    </div>
  )
}
