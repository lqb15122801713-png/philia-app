import { Check, ClipboardCheck, Lock } from 'lucide-react'
import type { ServiceStepDef } from '@philia/shared'
import BeforeAfterSlots, { type SlotPhoto } from './BeforeAfterSlots'
import CameraButton from './CameraButton'
import PhotoGrid, { type GridPhoto } from './PhotoGrid'

export interface StepScreenProps {
  def: ServiceStepDef
  status: 'locked' | 'active' | 'done'
  flagged: boolean
  /** 服务端未失效照片（list 口径） */
  serverPhotos: GridPhoto[]
  /** 本地队列待上传照片（blob 预览） */
  queuedPhotos: GridPhoto[]
  /** before_after 双卡槽（服务端优先，其次本地队列预览） */
  beforeSlot?: SlotPhoto | null
  afterSlot?: SlotPhoto | null
  /** 服务端未失效张数（min 校验口径，与 confirmStep 一致） */
  serverCount: number
  /** 服务端 before / after 各几张（before_after 步 confirm 校验口径） */
  beforeCount: number
  afterCount: number
  /** 全预约待上传队列长度（>0 时禁用 confirm，保证服务端完整性） */
  pendingAllCount: number
  confirming: boolean
  onFiles: (files: FileList) => void
  onSlotFiles: (tag: 'before' | 'after', files: FileList) => void
  onPhotoTap: () => void
  /** v1.1-b1：active 步照片删除（仅服务端已落库照片） */
  onDeletePhoto?: (photoId: string) => void
  onConfirm: () => void
}

/**
 * 一步一屏全屏卡片：大标题 + 照片要求 + 拍照区 + 底部唯一主按钮（≥64px）。
 * 张数 UI 引导口径 = STEP_DEFS（min/max）；服务端 confirmStep 二次强校验（双保险）。
 */
export default function StepScreen(props: StepScreenProps) {
  const {
    def,
    status,
    flagged,
    serverPhotos,
    queuedPhotos,
    beforeSlot,
    afterSlot,
    serverCount,
    beforeCount,
    afterCount,
    pendingAllCount,
    confirming,
    onFiles,
    onSlotFiles,
    onPhotoTap,
    onDeletePhoto,
    onConfirm,
  } = props

  const isBeforeAfter = def.stepKey === 'before_after'
  const isConfirmStep = def.stepKey === 'confirm'
  const localTotal = serverPhotos.length + queuedPhotos.length
  const readOnly = status !== 'active'

  /* ---------------- 标题区照片要求文案 ---------------- */
  let requirement: string
  if (isConfirmStep) requirement = '无需照片，确认服务已按标准完成'
  else if (isBeforeAfter) requirement = '服务前、服务后各拍 1 张'
  else requirement = `需要 ${def.minPhotos}-${def.maxPhotos} 张，已拍 ${localTotal} 张`

  /* ---------------- 主按钮禁用链 ---------------- */
  let btnText = '确认本步完成'
  let btnDisabled = false
  if (status === 'done') {
    btnText = '本步已完成'
    btnDisabled = true
  } else if (status === 'locked') {
    btnText = '完成上一步后解锁'
    btnDisabled = true
  } else if (pendingAllCount > 0) {
    // 有待上传队列：禁 confirm（照片未落库就 confirm 会破坏服务端完整性）
    btnText = '照片上传中…'
    btnDisabled = true
  } else if (confirming) {
    btnText = '确认中…'
    btnDisabled = true
  } else if (isBeforeAfter && (beforeCount < 1 || afterCount < 1)) {
    btnText = beforeCount < 1 && afterCount < 1 ? '还差服务前、服务后照片' : beforeCount < 1 ? '还差服务前照片' : '还差服务后照片'
    btnDisabled = true
  } else if (serverCount < def.minPhotos) {
    btnText = `还差 ${def.minPhotos - serverCount} 张`
    btnDisabled = true
  } else if (isConfirmStep) {
    btnText = '确认服务完成'
  }

  /* ---------------- 拍照按钮 ---------------- */
  const cameraFull = !isConfirmStep && !isBeforeAfter && localTotal >= def.maxPhotos

  return (
    <div className="flex h-full flex-col px-3 pb-3">
      {/* 标题区 */}
      <div className="px-1 pb-2 pt-1">
        <div className="flex items-baseline gap-2">
          <span className="text-caption font-semibold text-brand-primary">
            第 {def.stepOrder} / 6 步
          </span>
          {flagged && <span className="text-caption font-semibold text-danger-deep">商家要求重拍</span>}
        </div>
        <h2 className="mt-0.5 text-title-lg text-ink">{def.name}</h2>
        <p className="mt-0.5 text-body-lg text-ink-secondary">{requirement}</p>
      </div>

      {/* 中部拍照区（可滚动） */}
      <div className="flex-1 overflow-y-auto">
        {status === 'locked' ? (
          <div className="flex h-full flex-col items-center justify-center text-ink-placeholder">
            <Lock className="h-10 w-10" strokeWidth={1.5} />
            <div className="mt-3 text-body-lg">完成上一步后解锁</div>
          </div>
        ) : isConfirmStep ? (
          <div className="mt-4 rounded-card bg-card p-6 text-center shadow-card">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-light">
              <ClipboardCheck className="h-8 w-8 text-success-deep" strokeWidth={1.5} />
            </div>
            <div className="mt-4 text-body-lg text-ink">
              请确认全部洗护流程已按标准完成，照片均已上传
            </div>
            <div className="mt-2 text-body text-ink-secondary">
              确认后预约将标记为已完成，家长会收到通知
            </div>
            {status === 'done' && (
              <div className="mt-4 flex items-center justify-center gap-1 text-success-deep">
                <Check className="h-5 w-5" strokeWidth={2} /> 服务已完成
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-2">
            {isBeforeAfter ? (
              <BeforeAfterSlots
                before={beforeSlot}
                after={afterSlot}
                readOnly={readOnly}
                onFiles={onSlotFiles}
                onFilledTap={onPhotoTap}
              />
            ) : (
              <>
                <PhotoGrid
                  photos={[...serverPhotos, ...queuedPhotos]}
                  onPhotoTap={onPhotoTap}
                  onDeletePhoto={status === 'active' ? onDeletePhoto : undefined}
                />
                {status === 'active' && (
                  <CameraButton
                    disabled={cameraFull}
                    hint={cameraFull ? `已达上限 ${def.maxPhotos} 张` : null}
                    countText={`已拍 ${localTotal}/${def.maxPhotos}`}
                    onFiles={onFiles}
                  />
                )}
              </>
            )}
            {isBeforeAfter && (beforeSlot || afterSlot) && status === 'active' && (
              <p className="text-center text-caption text-ink-secondary">
                各槽位 1 张；如需重拍请联系商家在监视页打标
              </p>
            )}
            {status === 'done' && serverPhotos.length > 0 && (
              <p className="text-center text-caption text-ink-secondary">本步已完成，照片仅供查看</p>
            )}
          </div>
        )}
      </div>

      {/* 底部唯一主按钮（≥64px） */}
      <div className="pt-2">
        <button
          type="button"
          disabled={btnDisabled}
          onClick={onConfirm}
          className={`flex h-16 w-full items-center justify-center gap-2 rounded-full text-body-lg font-semibold transition active:scale-92 duration-120 ${
            btnDisabled
              ? 'bg-sunken text-ink-placeholder'
              : 'bg-brand-primary text-white shadow-elevated'
          }`}
        >
          {status === 'done' && <Check className="h-5 w-5" strokeWidth={2.5} />}
          {btnText}
        </button>
      </div>
    </div>
  )
}
