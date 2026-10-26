const QA_FIXTURE_PREFIX = /^qa[\s_-]*夹具[\s:_-]*/i

export function isQaFixturePetName(name: string | null | undefined): boolean {
  return typeof name === 'string' && QA_FIXTURE_PREFIX.test(name.trim())
}

export function customerPetName(name: string | null | undefined, fallback = '爱宠'): string {
  if (!name) return fallback
  const cleaned = name.trim().replace(QA_FIXTURE_PREFIX, '').trim()
  return cleaned || fallback
}
