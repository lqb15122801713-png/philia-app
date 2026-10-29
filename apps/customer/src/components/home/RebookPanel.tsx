/**
 * 首页上次预约配置面板：摘要与「调整服务或时间」保留，主行动改为查看预约进度（O1 差异任务），
 * 不再与 megacard 的进洗护主路径重复创建预约。
 */

import { Link } from 'react-router-dom';
import { dayLabel, fmtHM } from '@/components/booking/format';
import { customerPetName } from '@/lib/customerPresentation';

export interface RebookPanelProps {
  storeId: string;
  storeName: string;
  serviceId: string;
  serviceName: string;
  durationMin: number | null;
  petId: string;
  petName: string;
  /** 最早可约槽（服务端已过滤 +1h 缓冲/满槽/时长连续） */
  slot: Date;
  paymentMode: 'pay_at_store' | 'pass_deduct';
  /** 次卡剩余次数（paymentMode=pass_deduct 时展示；否则 null） */
  passRemainTimes: number | null;
}

export default function RebookPanel({
  storeId,
  storeName,
  serviceId,
  serviceName,
  durationMin,
  petId,
  petName,
  slot,
  paymentMode,
  passRemainTimes,
}: RebookPanelProps) {
  const adjustTarget = `/booking/grooming?storeId=${encodeURIComponent(storeId)}&serviceId=${encodeURIComponent(serviceId)}&petId=${encodeURIComponent(petId)}`;
  const ROW = 'flex items-baseline justify-between gap-3 py-2';
  /* 片1-客户端脸 VI（READY §2.1）：发丝线=divider #E8E2D6 谱 rgba(44,40,34,.10) */
  const HAIRLINE = 'border-t border-[rgba(44,40,34,.10)]';

  return (
    <section
      data-testid="home-rebook-panel"
      className="rounded-card bg-card p-4 shadow-card"
      aria-label="上次预约配置"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-title">上次预约配置</h2>
        <Link
          to={adjustTarget}
          data-testid="home-rebook-adjust"
          className="border-b border-[#A89779] pb-px text-caption font-medium text-ink"
        >
          调整服务或时间 ›
        </Link>
      </div>

      {/* 预填摘要四行（B4-3 记忆）：宠物 / 服务 / 门店 / 时间=最早可约槽 */}
      <dl className={`mt-2 ${HAIRLINE}`}>
        <div className={ROW}>
          <dt className="shrink-0 text-caption text-ink-secondary">宠物</dt>
          <dd className="truncate text-body font-semibold" data-testid="home-rebook-pet">
            {customerPetName(petName)}
          </dd>
        </div>
        <div className={`${ROW} ${HAIRLINE}`}>
          <dt className="shrink-0 text-caption text-ink-secondary">服务</dt>
          <dd className="truncate text-body font-semibold" data-testid="home-rebook-service">
            {serviceName}
            <span className="ml-1.5 text-caption font-normal text-ink-secondary">
              约 {durationMin ?? 60} 分钟
            </span>
          </dd>
        </div>
        <div className={`${ROW} ${HAIRLINE}`}>
          <dt className="shrink-0 text-caption text-ink-secondary">门店</dt>
          <dd className="truncate text-body font-semibold" data-testid="home-rebook-store">
            {storeName}
          </dd>
        </div>
        <div className={`${ROW} ${HAIRLINE}`}>
          <dt className="shrink-0 text-caption text-ink-secondary">时间</dt>
          <dd
            className="truncate text-body font-semibold font-number"
            data-testid="home-rebook-slot"
            data-slot-start={slot.getTime()}
          >
            {dayLabel(slot)} {fmtHM(slot)}
            <span className="ml-1.5 text-caption font-normal text-ink-secondary">最早可约</span>
          </dd>
        </div>
      </dl>

      {/* 收款方式脚注（涉钱知情：与单屏 paymentMode 默认口径一致） */}
      <p className="mt-1 text-caption text-ink-secondary" data-testid="home-rebook-payment">
        收款方式：
        {paymentMode === 'pass_deduct'
          ? `次卡扣 1 次${passRemainTimes !== null ? `（余 ${passRemainTimes} 次）` : ''}`
          : '到店付'}
      </p>

      {/* 全屏唯一 accent：一键提交 CTA（提交中禁用，幂等）
          片1 VI：主钮=cream #F2DC8C「此刻要做」（READY §2.1；片0 令牌合入后与 brand-primary 同值） */}
      <Link
        to="/appointments"
        data-testid="home-rebook-cta"
        className="mt-3 flex h-12 w-full items-center justify-center rounded-card bg-[#F2DC8C] text-body font-semibold text-ink shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
      >
        查看我的预约 ›
      </Link>
    </section>
  );
}
