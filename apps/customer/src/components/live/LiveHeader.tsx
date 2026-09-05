/**
 * live 页顶部（开发方案 §8.4）：宠物头像 + 服务名 + 门店名 + 当前状态胶囊。
 * 胶囊文案由页面层计算（"服务中 · 第 N 步" / "寄养中 · 第 N 天" / "已完成"）。
 */

import { PawPrint } from 'lucide-react'

export interface LiveHeaderProps {
  petName: string
  petAvatarUrl?: string | null
  serviceName: string
  storeName: string
  /** 状态胶囊文案；空串则不渲染胶囊 */
  capsule: string
  /** active=进行中（品牌色浅底）；done=完成（苔绿浅底） */
  capsuleTone: 'active' | 'done'
}

export default function LiveHeader({
  petName,
  petAvatarUrl,
  serviceName,
  storeName,
  capsule,
  capsuleTone,
}: LiveHeaderProps) {
  return (
    <header className="flex items-center gap-3 rounded-card bg-card p-4 shadow-card">
      {petAvatarUrl ? (
        <img
          src={petAvatarUrl}
          alt={petName}
          className="h-14 w-14 shrink-0 rounded-full bg-sunken object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary-light">
          <PawPrint className="h-7 w-7 text-brand-primary" strokeWidth={1.5} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="truncate text-title">{petName}</h1>
          {capsule ? (
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-caption ${
                capsuleTone === 'done'
                  ? 'bg-success-light text-success-deep'
                  : 'bg-brand-primary-light text-brand-primary'
              }`}
            >
              {capsule}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-caption text-ink-secondary">
          {serviceName}
          {storeName ? ` · ${storeName}` : ''}
        </p>
      </div>
    </header>
  )
}
