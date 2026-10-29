const QA_FIXTURE_MARKER = 'qa[\\s_-]*夹具[\\s:_-]*'
const QA_FIXTURE_PREFIX = new RegExp(`^${QA_FIXTURE_MARKER}`, 'i')
const QA_FIXTURE_NOTIFICATION_NAME = new RegExp(`【\\s*${QA_FIXTURE_MARKER}\\s*([^】]+?)\\s*】`, 'gi')
const QA_FIXTURE_NOTIFICATION_PREFIX = new RegExp(QA_FIXTURE_MARKER, 'gi')

export function isQaFixturePetName(name: string | null | undefined): boolean {
  return typeof name === 'string' && QA_FIXTURE_PREFIX.test(name.trim())
}

export function customerPetName(name: string | null | undefined, fallback = '爱宠'): string {
  if (!name) return fallback
  const cleaned = customerNotificationText(name.trim()).trim()
  return cleaned || fallback
}

export function customerNotificationText(text: string): string {
  return text.replace(QA_FIXTURE_NOTIFICATION_NAME, '$1').replace(QA_FIXTURE_NOTIFICATION_PREFIX, '')
}
