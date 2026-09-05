/**
 * 空周期空态插画（T4.4）：本周期无收款记录时展示。
 * 渐变只用于空状态插画（设计手册 §2.3 允许的品牌时刻之一），1.5px 线性风格。
 */

export default function EmptyState({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-col items-center rounded-card bg-card px-6 py-10 text-center shadow-card">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        {/* 暖色光晕底（品牌渐变仅用于空态插画） */}
        <circle cx="60" cy="60" r="48" fill="url(#philiaEmptyGrad)" opacity="0.35" />
        {/* 收据 */}
        <rect x="36" y="30" width="48" height="60" rx="6" fill="#FFFFFF" stroke="#DDD0C6" strokeWidth="1.5" />
        <path d="M36 84l6 5 6-5 6 5 6-5 6 5 6-5 6 5" stroke="#DDD0C6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="46" y1="44" x2="74" y2="44" stroke="#EBE3DB" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="46" y1="54" x2="66" y2="54" stroke="#EBE3DB" strokeWidth="1.5" strokeLinecap="round" />
        {/* 爪印 */}
        <g stroke="#D98E5F" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="54" cy="68" r="2.4" fill="none" />
          <circle cx="66" cy="68" r="2.4" fill="none" />
          <circle cx="48" cy="74" r="2.4" fill="none" />
          <circle cx="72" cy="74" r="2.4" fill="none" />
          <path d="M60 72c4.6 0 8.4 3.4 8.4 7 0 2.8-2.4 4.6-5 3.8-1.6-.5-5.2-.5-6.8 0-2.6.8-5-1-5-3.8 0-3.6 3.8-7 8.4-7z" fill="none" />
        </g>
        <defs>
          <linearGradient id="philiaEmptyGrad" x1="12" y1="12" x2="108" y2="108" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D98E5F" />
            <stop offset="1" stopColor="#F2C9A4" />
          </linearGradient>
        </defs>
      </svg>
      <p className="mt-4 text-title text-ink">本周期暂无收款记录</p>
      <p className="mt-1 text-body text-ink-secondary">
        {hint ?? '完成服务并确认收款后，这里会生成营收报表'}
      </p>
    </div>
  );
}
