/**
 * live 页摘要卡（开发方案 §8.4；U4-D2 试样 05 逐格收口）。
 *
 * 试样 .bk-pet 结构：柠檬细环宠物头像（56 全圆 + 2px 纸缝 + 1.5px 柠檬环）
 * +「{宠物} · {服务}」（试样 16/800 → 字阶取 17/700）+ 美容师行 meta
 * （「{员工}服务中 · 预计 HH:MM 完成」，页面层组装，缺真值段隐去 → 整行可隐）
 * + 右位状态签：
 * - state=live：SSE connected 真值点签（薄荷点「实时同步」/ 灰点「重连中」，
 *   禁常亮——InServicePanel U4-B 同口径；仅服务中/寄养中传入，其余态 plain 不出签）；
 * - state=done：苔绿「已完成」chip（真实状态）。
 *
 * 旧状态胶囊（服务中·第 N 步 / 寄养中·第 N 天）退役：步序在 stepper 可视，
 * 寄养天数并入 meta 行；门店名移出摘要卡（试样无此段）。
 */

export interface LiveHeaderProps {
  petName: string
  petAvatarUrl?: string | null
  serviceName: string
  /** 美容师行（{员工}服务中 · 预计 HH:MM 完成 / 寄养中 · 第 N 天）；null → 整行隐去 */
  meta?: string | null
  /** live=进行中（SSE 点签）；done=已完成 chip；plain=不出签（未开始/取消等态） */
  state: 'live' | 'done' | 'plain'
  /** state=live 时有效：SSE connected 真值（禁常亮） */
  sseConnected?: boolean
}

export default function LiveHeader({
  petName,
  petAvatarUrl,
  serviceName,
  meta,
  state,
  sseConnected,
}: LiveHeaderProps) {
  return (
    <header className="u1-card flex items-center gap-3.5 px-4 py-3.5">
      {petAvatarUrl ? (
        <img
          src={petAvatarUrl}
          alt={petName}
          className="h-14 w-14 shrink-0 rounded-full bg-sunken object-cover ring-[1.5px] ring-brand-primary ring-offset-2"
        />
      ) : (
        /* D-补3 字圈工艺：浅木底 + 衬线首字（柠檬细环保留，D2 摘要卡口径） */
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-oak-light ring-[1.5px] ring-brand-primary ring-offset-2">
          <span className="u1-serif text-title-lg font-semibold text-ink">{petName.slice(0, 1)}</span>
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-title font-bold">
          {petName} · {serviceName}
        </p>
        {meta ? <p className="mt-1 truncate text-caption text-ink-secondary">{meta}</p> : null}
      </div>
      {state === 'done' ? (
        <span className="shrink-0 rounded-chip bg-success-light px-2 py-0.5 text-caption-xs font-semibold text-success-deep">
          已完成
        </span>
      ) : state === 'live' ? (
        <span
          data-testid="live-sync"
          data-connected={sseConnected === true}
          className="flex shrink-0 items-center gap-[5px] text-caption-xs leading-4 text-ink-secondary"
        >
          <i
            className={`h-1.5 w-1.5 rounded-full ${sseConnected ? 'bg-brand-secondary' : 'bg-ink/30'}`}
            aria-hidden="true"
          />
          {sseConnected ? '实时同步' : '重连中'}
        </span>
      ) : null}
    </header>
  )
}
