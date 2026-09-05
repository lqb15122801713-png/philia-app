import { AlertTriangle } from 'lucide-react'

/**
 * 商家打标重拍横幅（醒目，陶红系）：步骤 flagged=1 时常显于顶部。
 * 旧照片已被服务端失效化，该步照片区以 list 为准重新拍。
 */
export default function FlaggedBanner({ stepNames }: { stepNames: string[] }) {
  if (stepNames.length === 0) return null
  return (
    <div className="mx-3 mt-2 flex items-start gap-2 rounded-card border border-danger bg-danger-light px-4 py-3">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-deep" strokeWidth={1.8} />
      <div className="text-body-lg text-danger-deep">
        <span className="font-semibold">商家要求重拍：{stepNames.join('、')}</span>
        <div className="mt-0.5 text-body text-danger-deep/80">
          该步原照片已作废，请重新拍摄达标后再确认完成
        </div>
      </div>
    </div>
  )
}
