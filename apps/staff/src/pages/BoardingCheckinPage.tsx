import { useParams } from 'react-router-dom'

export default function BoardingCheckinPage() {
  const { id } = useParams()
  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold">寄养登记</h1>
      <p className="mt-2 text-sm text-muted-foreground">办理寄养入住登记与健康检查。</p>
      <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        路由参数 id：{id}
      </p>
    </div>
  )
}
