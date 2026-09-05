/**
 * 预约状态胶囊（T3.1 · 员工端）
 *
 * 待核销（confirmed）= 品牌色脉冲点（animate-halo，与 philia 呼吸母题一致）；
 * 服务中/寄养中 = 品牌色实底；已完成/已取消 = 灰态；取消审核中 = 陶红浅底。
 */

const CAPSULE: Record<string, { label: string; cls: string; pulse?: boolean }> = {
  pending: { label: '待确认', cls: 'bg-sunken text-ink-secondary' },
  confirmed: {
    label: '待核销',
    cls: 'bg-brand-primary-light text-brand-primary-pressed',
    pulse: true,
  },
  in_service: { label: '服务中', cls: 'bg-brand-primary text-white' },
  in_boarding: { label: '寄养中', cls: 'bg-brand-primary text-white' },
  completed: { label: '已完成', cls: 'bg-sunken text-ink-placeholder' },
  cancel_requested: { label: '取消审核中', cls: 'bg-danger-light text-danger-deep' },
  cancelled: { label: '已取消', cls: 'bg-sunken text-ink-placeholder' },
};

export default function StatusCapsule({ status }: { status: string }) {
  const c = CAPSULE[status] ?? { label: status, cls: 'bg-sunken text-ink-secondary' };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-caption font-medium ${c.cls}`}
    >
      {c.pulse ? <span className="h-2 w-2 rounded-full bg-brand-primary animate-halo" /> : null}
      {c.label}
    </span>
  );
}
