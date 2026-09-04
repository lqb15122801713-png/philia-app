import { useParams } from 'react-router-dom'

export default function AppointmentDetailPage() {
  const { id } = useParams()
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold">预约详情</h1>
      <p className="mt-2 text-sm text-muted-foreground">预约单详情、客户与宠物信息、操作入口。</p>
      <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        路由参数 id：{id}
      </p>
    </div>
  )
}
