import { useParams } from 'react-router-dom'

export default function ExecutePage() {
  const { appointmentId } = useParams()
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold">服务执行</h1>
      <p className="mt-2 text-sm text-muted-foreground">按标准流程执行服务并逐项记录。</p>
      <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        路由参数 appointmentId：{appointmentId}
      </p>
    </div>
  )
}
