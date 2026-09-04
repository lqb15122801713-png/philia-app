import { useParams } from 'react-router-dom'

export default function AppointmentLivePage() {
  const { id } = useParams()
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold">服务直播</h1>
      <p className="mt-2 text-sm text-muted-foreground">实时查看宠物服务过程，安心看得见。</p>
      <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        路由参数 id：{id}
      </p>
    </div>
  )
}
