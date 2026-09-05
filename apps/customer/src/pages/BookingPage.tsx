/**
 * 预约入口（T2.2）：洗护 / 寄养 Tab 切换（默认洗护），?type=boarding 可深链。
 * 仅做入口分流，具体流程在 /booking/grooming 与 /booking/boarding（≤4 屏）。
 * ?storeId= 会透传到子流程（首页门店卡深链用）。
 */

import { Link, useSearchParams } from 'react-router-dom';

type BookingType = 'grooming' | 'boarding';

const TYPE_META: Record<
  BookingType,
  { title: string; icon: string; desc: string; points: string[]; cta: string; to: string }
> = {
  grooming: {
    title: '洗澡美容',
    icon: '🛁',
    desc: '消毒预检到细节护理，六步服务全程可见',
    points: ['4 步完成预约', '可指定洗护师', '服务照片实时看'],
    cta: '预约洗护',
    to: '/booking/grooming',
  },
  boarding: {
    title: '寄养',
    icon: '🏠',
    desc: '独立房型每日打卡，出差旅行也安心',
    points: ['按天选择住退', '疫苗有效期内可约', '每日照片打卡'],
    cta: '预约寄养',
    to: '/booking/boarding',
  },
};

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const type: BookingType = searchParams.get('type') === 'boarding' ? 'boarding' : 'grooming';
  const storeId = searchParams.get('storeId');
  const storeQuery = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';

  const meta = TYPE_META[type];

  return (
    <div className="px-4 py-6">
      <h1 className="text-title-lg">预约服务</h1>
      <p className="mt-1 text-body text-ink-secondary">选择服务类型，几步搞定</p>

      {/* 洗护 / 寄养 Tab（写回 URL 支持深链） */}
      <div className="mt-4 flex rounded-full bg-sunken p-1">
        {(Object.keys(TYPE_META) as BookingType[]).map((t) => (
          <Link
            key={t}
            to={`/booking?type=${t}${storeId ? `&storeId=${encodeURIComponent(storeId)}` : ''}`}
            replace
            className={`flex-1 rounded-full py-2.5 text-center text-body transition ${
              type === t ? 'bg-card font-semibold text-brand-primary shadow-card' : 'text-ink-secondary'
            }`}
          >
            {TYPE_META[t].icon} {TYPE_META[t].title}
          </Link>
        ))}
      </div>

      {/* 当前类型介绍卡 */}
      <section className="mt-5 rounded-card bg-card p-5 shadow-card">
        <p className="text-[36px]">{meta.icon}</p>
        <h2 className="mt-2 text-title">{meta.title}</h2>
        <p className="mt-1 text-body text-ink-secondary">{meta.desc}</p>
        <ul className="mt-3 space-y-1.5">
          {meta.points.map((p) => (
            <li key={p} className="flex items-center gap-2 text-caption text-ink-secondary">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success-light">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#649160" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              {p}
            </li>
          ))}
        </ul>
        <Link
          to={`${meta.to}${storeQuery}`}
          className="mt-5 flex h-12 items-center justify-center rounded-full bg-philia-gradient text-body font-semibold text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
        >
          {meta.cta}
        </Link>
      </section>

      <p className="mt-4 text-center text-caption text-ink-placeholder">
        已有预约？去<Link to="/appointments" className="text-brand-primary">我的预约</Link>查看
      </p>
    </div>
  );
}
