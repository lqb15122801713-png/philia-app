import assert from 'node:assert/strict'
import test from 'node:test'

async function loadValidation() {
  try {
    return await import('./localeInput')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
      return { isValidDateInput: undefined, isValidTimeInput: undefined }
    }
    throw error
  }
}

test('PD-98：可用时间只接受 24 小时 HH:MM，不接受 AM/PM 或越界时间', async () => {
  const { isValidTimeInput } = await loadValidation()
  assert.ok(isValidTimeInput, '先提供真实的时间格式校验')
  for (const [value, expected] of [
    ['09:00', true],
    ['18:00', true],
    ['23:59', true],
    ['09:00 AM', false],
    ['9:00', false],
    ['24:00', false],
    ['09:60', false],
    ['', false],
  ] as const) {
    assert.equal(isValidTimeInput(value), expected, value)
  }
})

test('PD-98：请假日只接受真实存在的 YYYY-MM-DD，不接受美式斜杠日', async () => {
  const { isValidDateInput } = await loadValidation()
  assert.ok(isValidDateInput, '先提供真实的日期格式校验')
  for (const [value, expected] of [
    ['2026-10-26', true],
    ['2024-02-29', true],
    ['10/26/2026', false],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['2026-10-26T09:00', false],
    ['', false],
  ] as const) {
    assert.equal(isValidDateInput(value), expected, value)
  }
})
