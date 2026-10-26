type NotificationRow = {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  readAt: Date | null
  createdAt: Date
}

type NotificationGroup<T extends NotificationRow> = {
  notification: T
  ids: string[]
}

export function groupDuplicateNotifications<T extends NotificationRow>(rows: readonly T[]): Array<NotificationGroup<T>> {
  const groups: Array<NotificationGroup<T>> = []
  const byContent = new Map<string, NotificationGroup<T>>()

  for (const row of rows) {
    const key = JSON.stringify([
      row.type,
      row.title,
      row.body,
      row.link,
      Math.floor(row.createdAt.getTime() / 1000),
    ])
    const existing = byContent.get(key)
    if (!existing) {
      const group = { notification: row, ids: [row.id] }
      byContent.set(key, group)
      groups.push(group)
      continue
    }
    existing.ids.push(row.id)
    if (existing.notification.readAt !== null && row.readAt === null) {
      existing.notification = row
    }
  }

  return groups
}
