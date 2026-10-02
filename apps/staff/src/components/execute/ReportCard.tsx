/**
 * 补缺大批片 4 · 员工端「美容报告卡」（ExecutePage 第六步 confirm active 时，stepper 下方附加段）
 *
 * - 体征五项：皮肤/耳朵/被毛/指甲=三态 chips（正常|注意|异常，默认正常），
 *   注意/异常时展开一句 note 输入（≤200 字，与 server VitalInputSchema 对齐）；
 *   体重=只读回显宠物档案体重（appointment.get 的 pet.weightKg；无=「档案未登记」，
 *   服务端恒以 pets.weight_kg 快照覆盖，本卡不入参体重 status/note）；
 * - 下次建议=文本域（选填，≤500 字）；
 * - 本卡纯受控：draft 状态与「未动不传参」判定在 ExecutePage（server 缺省=全 normal+留痕）；
 * - 提交不另设按钮，随吸底主钮 confirmStep 末步同事务落地（完成确认主流程零改动）。
 */

import { EXECUTE_COPY } from '@/copy/execute';

export type ReportVitalStatus = 'normal' | 'attention' | 'abnormal';
/** 三态选择器项（体重只读回显，不在选择器内） */
export type ReportSelectorKey = 'skin' | 'ear' | 'coat' | 'nail';

export interface ReportVitalDraft {
  status: ReportVitalStatus;
  note: string;
}

export interface ReportDraft {
  vitals: Record<ReportSelectorKey, ReportVitalDraft>;
  nextAdvice: string;
}

export const SELECTOR_KEYS = ['skin', 'ear', 'coat', 'nail'] as const;
export const STATUS_ORDER = ['normal', 'attention', 'abnormal'] as const;

/** 初始草稿（全正常/无 note/无建议）；isReportUntouched 以此为「未动」基准 */
export const emptyReportDraft = (): ReportDraft => ({
  vitals: {
    skin: { status: 'normal', note: '' },
    ear: { status: 'normal', note: '' },
    coat: { status: 'normal', note: '' },
    nail: { status: 'normal', note: '' },
  },
  nextAdvice: '',
});

/** 「未动」判定：四项全 normal 且无 note、无建议 —— 未动=confirmStep 不传 vitals/nextAdvice */
export function isReportUntouched(draft: ReportDraft): boolean {
  return (
    draft.nextAdvice.trim() === '' &&
    SELECTOR_KEYS.every((k) => draft.vitals[k].status === 'normal' && draft.vitals[k].note.trim() === '')
  );
}

const VITAL_LABEL: Record<ReportSelectorKey, string> = {
  skin: EXECUTE_COPY['exec.report.vital.skin'],
  ear: EXECUTE_COPY['exec.report.vital.ear'],
  coat: EXECUTE_COPY['exec.report.vital.coat'],
  nail: EXECUTE_COPY['exec.report.vital.nail'],
};

const STATUS_LABEL: Record<ReportVitalStatus, string> = {
  normal: EXECUTE_COPY['exec.report.status.normal'],
  attention: EXECUTE_COPY['exec.report.status.attention'],
  abnormal: EXECUTE_COPY['exec.report.status.abnormal'],
};

/** chip 选中态色（全走 preset token：normal=success 族 / attention=淡金提示底 / abnormal=danger 族） */
function chipClass(status: ReportVitalStatus, selected: boolean): string {
  const base =
    'flex h-9 items-center rounded-full border px-3.5 text-body-sm transition-transform duration-120 ease-philia-spring active:scale-92';
  if (!selected) return `${base} border-line bg-card text-ink-secondary`;
  switch (status) {
    case 'normal':
      return `${base} border-line-strong bg-success-light font-semibold text-ink`;
    case 'attention':
      return `${base} border-line-strong bg-brand-primary-light font-semibold text-ink`;
    case 'abnormal':
      return `${base} border-danger bg-danger-light font-semibold text-danger-deep`;
  }
}

export default function ReportCard({
  draft,
  weightKg,
  disabled,
  onChange,
}: {
  draft: ReportDraft;
  /** 宠物档案体重（kg；null/undefined=未登记，只读回显「档案未登记」） */
  weightKg: number | null | undefined;
  disabled?: boolean;
  onChange: (next: ReportDraft) => void;
}) {
  const patchVital = (key: ReportSelectorKey, patch: Partial<ReportVitalDraft>) =>
    onChange({ ...draft, vitals: { ...draft.vitals, [key]: { ...draft.vitals[key], ...patch } } });

  return (
    <section className="u1-card p-4" data-testid="exec-report-card">
      <h2 className="text-title">{EXECUTE_COPY['exec.report.title']}</h2>
      <p className="mt-1 text-caption text-ink-secondary">{EXECUTE_COPY['exec.report.delivery']}</p>

      {/* 体重：只读回显档案值（服务端恒以 pets.weight_kg 快照覆盖入参） */}
      <div className="mt-4 flex items-center justify-between" data-testid="exec-report-weight">
        <span className="text-body-sm font-semibold text-ink">{EXECUTE_COPY['exec.report.vital.weight']}</span>
        <span className="text-body-sm text-ink-secondary">
          {weightKg != null ? <span className="u1-num font-semibold text-ink">{weightKg} kg</span> : EXECUTE_COPY['exec.report.weight.empty']}
        </span>
      </div>

      {/* 皮肤/耳朵/被毛/指甲：三态 chips + 注意/异常时展开一句 note */}
      {SELECTOR_KEYS.map((key) => {
        const vital = draft.vitals[key];
        return (
          <div key={key} className="mt-4">
            <span className="text-body-sm font-semibold text-ink">{VITAL_LABEL[key]}</span>
            <div className="mt-1.5 flex gap-2" role="group" aria-label={VITAL_LABEL[key]}>
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={disabled}
                  aria-pressed={vital.status === s}
                  data-testid={`exec-report-status-${key}-${s}`}
                  onClick={() => patchVital(key, { status: s })}
                  className={`${chipClass(s, vital.status === s)} disabled:opacity-50`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {vital.status !== 'normal' ? (
              <input
                type="text"
                value={vital.note}
                disabled={disabled}
                data-testid={`exec-report-note-${key}`}
                onChange={(e) => patchVital(key, { note: e.target.value.slice(0, 200) })}
                placeholder={EXECUTE_COPY['exec.report.note.placeholder']}
                className="mt-2 h-staff-btn w-full rounded-control border border-line bg-canvas px-3 text-body-sm text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none disabled:opacity-50"
              />
            ) : null}
          </div>
        );
      })}

      {/* 下次建议（选填） */}
      <label className="mt-4 block">
        <span className="text-body-sm font-semibold text-ink">{EXECUTE_COPY['exec.report.advice.label']}</span>
        <textarea
          value={draft.nextAdvice}
          disabled={disabled}
          data-testid="exec-report-advice"
          onChange={(e) => onChange({ ...draft, nextAdvice: e.target.value.slice(0, 500) })}
          placeholder={EXECUTE_COPY['exec.report.advice.placeholder']}
          rows={2}
          className="mt-1.5 w-full rounded-control border border-line bg-canvas px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none disabled:opacity-50"
        />
      </label>
    </section>
  );
}
