/**
 * 入住登记表单（boarding.checkinStay · 开发方案 §3.1 寄养差异点）
 *
 * - 房间/笼位号 room_no（文本，可空，≤32 字）
 * - 入住称重 checkin_weight_kg（数字键盘，kg 一位小数，>0 且 ≤500）
 * - 随身物品 belongings 动态行（≥0 行，≤20 行）：物品名 + 拍照 1 张
 *   （uploadImage → boarding/<aid>/belongings），可增删行
 * - 提交由页面层 mutation 完成；编辑模式带「取消」返回信息卡
 */

import { getApiBase, safeUuid, uploadImage } from '@philia/shared';
import { Camera, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

export interface BelongingDraft {
  key: string;
  name: string;
  photoUrl?: string;
  uploading?: boolean;
}

export interface CheckinFormInitial {
  roomNo: string;
  weightText: string;
  belongings: BelongingDraft[];
}

export interface CheckinFormSubmit {
  appointmentId: string;
  roomNo?: string;
  checkinWeightKg: number;
  belongings: Array<{ name: string; photoUrl?: string }>;
  /** PR-2 A5：寄养负责人首次指派（仅未指派单；已指派改派走店长） */
  leadStaffId?: string;
}

export interface CheckinFormProps {
  appointmentId: string;
  /** 再编辑时传入初值（页面用 key 强制重挂载） */
  initial?: CheckinFormInitial;
  /** PR-2 A5 寄养负责人选择：assignedId=已指派（锁定+改派引导）；selfId=当前员工（兜底默认） */
  leadStaff?: {
    assignedId: string | null;
    selfId: string | null;
    options: Array<{ id: string; name: string; skills?: string[] | null }>;
  };
  submitting: boolean;
  onSubmit(input: CheckinFormSubmit): void;
  /** 编辑模式：取消返回信息卡 */
  onCancel?: () => void;
  /** 校验/上传失败提示（页面 toast） */
  onError(message: string): void;
}

/** 称重输入清洗：仅数字 + 一个小数点，小数最多一位 */
function sanitizeWeight(v: string): string {
  const cleaned = v.replace(/[^\d.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot === -1) return cleaned;
  const int = cleaned.slice(0, dot);
  const dec = cleaned.slice(dot + 1).replace(/\./g, '');
  return `${int}.${dec.slice(0, 1)}`;
}

const newRow = (): BelongingDraft => ({ key: safeUuid(), name: '' });

export default function CheckinForm({
  appointmentId,
  initial,
  leadStaff,
  submitting,
  onSubmit,
  onCancel,
  onError,
}: CheckinFormProps) {
  const [roomNo, setRoomNo] = useState(initial?.roomNo ?? '');
  const [weightText, setWeightText] = useState(initial?.weightText ?? '');
  const [rows, setRows] = useState<BelongingDraft[]>(initial?.belongings ?? []);
  const [leadStaffId, setLeadStaffId] = useState(
    // 默认=当班寄养岗（首位 boarding 技能员工），兜底=核销人（PD-05 件 3）
    leadStaff?.assignedId ??
      leadStaff?.options.find((o) => (o.skills ?? []).includes('boarding'))?.id ??
      leadStaff?.selfId ??
      '',
  );

  // 单个隐藏 file input 复用：activeKeyRef 记录当前为哪一行拍照
  const fileRef = useRef<HTMLInputElement>(null);
  const activeKeyRef = useRef<string | null>(null);

  const patchRow = (key: string, patch: Partial<BelongingDraft>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const pickPhoto = (key: string) => {
    activeKeyRef.current = key;
    fileRef.current?.click();
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重复选同一文件
    const key = activeKeyRef.current;
    if (!file || !key) return;
    patchRow(key, { uploading: true });
    try {
      const { url } = await uploadImage(getApiBase(), file, `boarding/${appointmentId}/belongings`);
      patchRow(key, { photoUrl: url, uploading: false });
    } catch (err) {
      patchRow(key, { uploading: false });
      onError(err instanceof Error ? err.message : '照片上传失败，请重试');
    }
  };

  const anyUploading = rows.some((r) => r.uploading);

  const submit = () => {
    // 称重：必填，>0 ≤500，一位小数（输入已约束，这里兜底解析）
    const kg = Number.parseFloat(weightText);
    if (!Number.isFinite(kg) || kg <= 0 || kg > 500) {
      onError('请填写正确的入住体重（kg，保留一位小数）');
      return;
    }
    // 物品行：空行（无名无照片）忽略；有照片无名 → 阻断
    const withPhotoNoName = rows.some((r) => !r.name.trim() && r.photoUrl);
    if (withPhotoNoName) {
      onError('有物品已拍照但未填名称，请补充物品名称');
      return;
    }
    const belongings = rows
      .filter((r) => r.name.trim())
      .map((r) => ({ name: r.name.trim().slice(0, 64), ...(r.photoUrl ? { photoUrl: r.photoUrl } : {}) }));
    if (anyUploading) {
      onError('物品照片上传中，请稍候再提交');
      return;
    }
    if (leadStaff && !leadStaff.assignedId && !leadStaffId) {
      onError('请选择寄养负责人');
      return;
    }
    onSubmit({
      appointmentId,
      roomNo: roomNo.trim() ? roomNo.trim().slice(0, 32) : undefined,
      checkinWeightKg: Math.round(kg * 10) / 10,
      belongings,
      // 仅未指派单提交首次指派（已指派变更走店长 assign，不随表单提交）
      ...(leadStaff && !leadStaff.assignedId && leadStaffId ? { leadStaffId } : {}),
    });
  };

  return (
    <section className="u1-card p-4">
      <h2 className="text-title">入住登记</h2>
      <p className="mt-1 text-body-sm text-ink-secondary">称重、分房、登记随身物品，完成后开始每日打卡。</p>

      {/* 房间/笼位号 */}
      <label className="mt-4 block">
        <span className="text-body-sm font-semibold text-ink">房间 / 笼位号</span>
        <input
          type="text"
          value={roomNo}
          onChange={(e) => setRoomNo(e.target.value.slice(0, 32))}
          placeholder="如：A-03（可稍后由商家分配）"
          className="mt-1.5 h-staff-btn w-full rounded-control border border-line bg-canvas px-3 text-body-sm text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
        />
      </label>

      {/* 入住称重 */}
      <label className="mt-4 block">
        <span className="text-body-sm font-semibold text-ink">
          入住称重 <span className="text-danger-deep">*</span>
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={weightText}
            onChange={(e) => setWeightText(sanitizeWeight(e.target.value))}
            placeholder="0.0"
            className="h-staff-btn w-32 rounded-control border border-line bg-canvas px-3 u1-num text-body-sm text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
          />
          <span className="text-body-sm text-ink-secondary">kg（一位小数）</span>
        </div>
      </label>

      {/* 寄养负责人（PR-2 A5：未指派单首次指派；已指派锁定+改派引导店长） */}
      {leadStaff ? (
        <label className="mt-4 block">
          <span className="text-body-sm font-semibold text-ink">
            寄养负责人 <span className="text-danger-deep">*</span>
          </span>
          {leadStaff.assignedId ? (
            <p className="mt-1.5 rounded-control bg-sunken px-3 py-2.5 text-body-sm text-ink">
              {leadStaff.options.find((s) => s.id === leadStaff.assignedId)?.name ?? '已指派'}
              <span className="ml-2 text-caption text-ink-secondary">改派请找店长</span>
            </p>
          ) : (
            <>
              <select
                value={leadStaffId}
                onChange={(e) => setLeadStaffId(e.target.value)}
                className="mt-1.5 h-staff-btn w-full rounded-control border border-line bg-canvas px-3 text-body-sm text-ink focus:border-brand-primary focus:outline-none"
                data-testid="boarding-lead-select"
              >
                {leadStaff.options.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-caption text-ink-secondary">默认=核销人本人；差评扣分归属该负责人（改派找店长）</p>
            </>
          )}
        </label>
      ) : null}

      {/* 随身物品动态行 */}
      <div className="mt-4">
        <span className="text-body-sm font-semibold text-ink">随身物品（可空）</span>
        <ul className="mt-1.5 space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              <input
                type="text"
                value={row.name}
                onChange={(e) => patchRow(row.key, { name: e.target.value.slice(0, 64) })}
                placeholder="物品名称，如：食盆 / 玩具"
                className="h-staff-btn min-w-0 flex-1 rounded-control border border-line bg-canvas px-3 text-body-sm text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => pickPhoto(row.key)}
                disabled={row.uploading}
                className="relative flex h-staff-btn w-14 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-sunken text-ink-secondary transition-transform duration-120 ease-philia-spring active:scale-92"
                aria-label={row.photoUrl ? '重拍物品照片' : '拍物品照片'}
              >
                {row.uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} />
                ) : row.photoUrl ? (
                  <img src={row.photoUrl} alt={row.name || '物品照片'} className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-6 w-6" strokeWidth={1.5} />
                )}
              </button>
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                className="flex h-staff-btn w-12 shrink-0 items-center justify-center rounded-control text-danger-deep transition-transform duration-120 ease-philia-spring active:scale-92"
                aria-label="删除该行"
              >
                <Trash2 className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </li>
          ))}
        </ul>
        {rows.length < 20 ? (
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, newRow()])}
            className="mt-2 flex h-staff-btn items-center gap-1.5 rounded-full bg-brand-primary-light px-4 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            <Plus className="h-5 w-5" strokeWidth={1.5} />
            添加物品
          </button>
        ) : null}
      </div>

      {/* 提交 */}
      <div className="mt-5 space-y-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || anyUploading}
          className="h-staff-btn w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98] disabled:opacity-50"
        >
          {submitting ? '提交中…' : initial ? '保存登记信息' : '完成入住登记'}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="h-staff-btn w-full rounded-full bg-sunken text-body-sm text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
          >
            取消
          </button>
        ) : null}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    </section>
  );
}
