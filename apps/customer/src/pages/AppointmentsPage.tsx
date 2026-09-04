import { Link } from 'react-router-dom'

export default function AppointmentsPage() {
  // TODO(P1)：接入预约列表接口，空列表时展示品牌空状态
  const appointments: unknown[] = []

  return (
    <div className="px-4 py-6">
      <h1 className="text-title-lg">我的预约</h1>

      {appointments.length === 0 ? (
        <div className="mt-10 flex flex-col items-center">
          <img
            src="./brand/empty-appointments-800.png"
            alt="暂无预约"
            className="w-56 max-w-full rounded-card"
          />
          <p className="mt-4 text-title">还没有预约</p>
          <p className="mt-1 text-body text-ink-secondary">给毛孩子安排一次舒服的洗护吧</p>
          <Link
            to="/booking"
            className="mt-6 flex h-11 items-center rounded-full bg-brand-primary px-8 text-body font-medium text-white shadow-card transition-transform duration-120 ease-philia-spring active:scale-92"
          >
            立即预约
          </Link>
        </div>
      ) : null}
    </div>
  )
}
