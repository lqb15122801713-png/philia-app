/**
 * 完成后底部（开发方案 §8.4）：评价 CTA（星级 + 文字 → appointment.review）
 * +「分享到服务相册」（Web Share API，页面层实现降级复制链接）。
 * 已评价时展示已有星级与评价内容，表单不再出现（服务端幂等拒绝重复评价）。
 */

import { Share2, Star } from 'lucide-react'
import { useState } from 'react'

export interface ReviewPanelProps {
  /** 已有评分（1-5）；null 表示未评价，显示表单 */
  existingRating: number | null
  existingReview?: string | null
  submitting: boolean
  onSubmit: (rating: number, text: string) => void
  onShare: () => void
}

function Stars({
  value,
  onChange,
  size = 'h-8 w-8',
}: {
  value: number
  onChange?: (v: number) => void
  size?: string
}) {
  return (
    <div className="flex items-center gap-1" role={onChange ? 'radiogroup' : undefined} aria-label="评分">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= value
        const star = (
          <Star
            className={`${size} ${active ? 'fill-brand-primary text-brand-primary' : 'text-line-strong'}`}
            strokeWidth={1.5}
          />
        )
        return onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} 星`}
            className="flex h-11 w-11 items-center justify-center transition active:scale-92 duration-120"
            onClick={() => onChange(n)}
          >
            {star}
          </button>
        ) : (
          <span key={n} className="flex items-center justify-center">
            {star}
          </span>
        )
      })}
    </div>
  )
}

export default function ReviewPanel({
  existingRating,
  existingReview,
  submitting,
  onSubmit,
  onShare,
}: ReviewPanelProps) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')

  return (
    <section className="rounded-card bg-card p-4 shadow-card">
      {existingRating != null ? (
        <>
          <h2 className="text-title">我的评价</h2>
          <div className="mt-2">
            <Stars value={existingRating} size="h-5 w-5" />
          </div>
          {existingReview ? (
            <p className="mt-2 text-body text-ink-secondary">{existingReview}</p>
          ) : null}
        </>
      ) : (
        <>
          <h2 className="text-title">服务还满意吗？</h2>
          <p className="mt-1 text-caption text-ink-secondary">给个星星，鼓励一下洗护师吧</p>
          <div className="mt-2">
            <Stars value={rating} onChange={setRating} />
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="说说这次服务的感受…（可选）"
            className="mt-2 w-full resize-none rounded-input border border-line bg-sunken px-3 py-2 text-body text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
          />
          <button
            type="button"
            disabled={rating === 0 || submitting}
            onClick={() => onSubmit(rating, text.trim())}
            className="mt-3 h-11 w-full rounded-full bg-brand-primary text-body font-semibold text-white transition hover:bg-brand-primary-hover active:bg-brand-primary-pressed disabled:opacity-50"
          >
            {submitting ? '提交中…' : '提交评价'}
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onShare}
        className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-full border-[1.5px] border-brand-primary text-body font-semibold text-brand-primary transition active:scale-[0.99]"
      >
        <Share2 className="h-5 w-5" strokeWidth={1.5} />
        分享到服务相册
      </button>
    </section>
  )
}
