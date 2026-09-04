import { useParams } from 'react-router-dom'

export default function AppointmentMonitorPage() {
  const { id } = useParams()
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold">服务监控</h1>
      <p className="mt-2 text-sm text-muted-foreground">实时跟进服务执行进度与直播画面。</p>
      <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        路由参数 id：{id}
      </p>
    </div>
  )
}
