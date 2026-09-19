/**
 * 收银台离线状态条（批次 M1-补2 · R4 断网不静默①）
 *
 * 常显条件：浏览器离线（navigator.onLine）或 SSE 断开（双信号其一即离线态）；
 * 琥珀底条：「离线中 · 结账将本地暂存」+ 已暂存单数（>0 时柠點强调）+
 * 上次补传失败数（lastError 留痕单）。
 * 在线且无暂存时不渲染（不占收银台主屏纵向空间）。
 */

import { WifiOff } from 'lucide-react'

export default function OfflineBar({
  offline,
  pendingCount,
  failedCount,
  flushing,
}: {
  /** 双信号合成离线态（!navigator.onLine || !SSE.connected） */
  offline: boolean
  /** 本地暂存单数（含失败留痕单） */
  pendingCount: number
  /** 其中上次补传失败留痕单数 */
  failedCount: number
  flushing: boolean
}) {
  if (!offline && pendingCount === 0) return null
  return (
    <div
      data-testid="cashier-offline-bar"
      role="status"
      className={`mb-3 flex items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-caption font-semibold ${
        offline
          ? 'bg-[#FDC830] text-[#4A3B2E]'
          : 'bg-[#FFFDF6] text-ink shadow-[0_0_0_1px_rgba(74,59,46,.12)]'
      }`}
    >
      <WifiOff size={15} strokeWidth={1.9} aria-hidden />
      {offline ? (
        <span>离线中 —— 结账将先本地暂存，恢复网络后自动补传</span>
      ) : flushing ? (
        <span>网络已恢复，正在补传暂存单…</span>
      ) : (
        <span>暂存单待补传</span>
      )}
      {pendingCount > 0 ? (
        <span
          className="ml-auto inline-flex items-center rounded-full bg-[#4A3B2E] px-2.5 py-[3px] font-number text-caption-xs tabular-nums text-[#F6F1E3]"
          data-testid="cashier-offline-count"
        >
          已暂存 {pendingCount} 单
        </span>
      ) : null}
      {failedCount > 0 ? (
        <span
          className="inline-flex items-center rounded-full bg-danger-deep px-2.5 py-[3px] font-number text-caption-xs tabular-nums text-[#FFFDF6]"
          data-testid="cashier-offline-failed"
        >
          补传失败 {failedCount} 单
        </span>
      ) : null}
    </div>
  )
}
