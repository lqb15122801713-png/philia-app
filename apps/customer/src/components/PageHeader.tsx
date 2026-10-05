/**
 * PageHeader · 详情级页面统一返回条（批次 U1 任务 A）。
 * 换皮批片 5：已归并 @philia/shared（PageHeader/BackButton），本文件为转发适配层，
 * 12 页调用点零改动。
 *
 * 急修批回退链契约逐字保留（与 shared 件的差仅在本适配层补齐）：
 * - idx>0（栈内有历史）：传 to → navigate(to)（固定目标，仅交易成功页类明示场景）；
 *   未传 to → navigate(-1)（时间序回退）；
 * - idx===0（直访/刷新到栈底）：navigate(to ?? fallback ?? '/home')——
 *   shared 件未传 fallback 时走 navigate(-1)，此处默认补 fallback='/home' 对齐原契约；
 * - 与浏览器/系统后退手势不冲突：只兜 SPA 内无栈场景，有栈仍走 navigate(-1)。
 *
 * 用法：
 *   <PageHeader title="预约详情" />                       默认 navigate(-1)，直访兜底 /home
 *   <PageHeader title="宠物档案" to="/philia" />          固定返回目标
 *   <PageHeader title="预约洗护" right={<Link …/>} />     右侧 slot
 * 只需圆钮（如 PDP 主图浮动钮）：<BackButton className="absolute left-4 top-4" />
 */

import type { ReactNode } from 'react'
import {
  PageHeader as SharedPageHeader,
  BackButton as SharedBackButton,
} from '@philia/shared'

export function BackButton({
  to,
  fallback,
  ariaLabel = '返回',
  className = '',
}: {
  /** 明示固定目标（仅交易成功页双出口类场景；与浏览器/系统后退手势不冲突） */
  to?: string
  /** 直访/刷新到栈底（idx===0）时的兜底父页（未传兜底 /home）。体验急修批口径：
      返回键一律时间序回退 navigate(-1)，固定 to= 只许交易成功页类明示场景 */
  fallback?: string
  ariaLabel?: string
  className?: string
}) {
  return (
    <SharedBackButton
      to={to}
      fallback={fallback ?? '/home'}
      ariaLabel={ariaLabel}
      className={className}
    />
  )
}

export default function PageHeader({
  title,
  to,
  fallback,
  right,
  className = '',
}: {
  title: ReactNode
  to?: string
  /** 直访兜底父页（体验急修批：返回=时间序回退，to= 仅交易成功页类明示场景） */
  fallback?: string
  right?: ReactNode
  className?: string
}) {
  return (
    <SharedPageHeader
      title={title}
      to={to}
      fallback={fallback ?? '/home'}
      right={right}
      className={className}
    />
  )
}
