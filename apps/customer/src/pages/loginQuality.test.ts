import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const formalSource = readFileSync(new URL('./LoginPage.tsx', import.meta.url), 'utf8')
const devSource = readFileSync(new URL('./DevLoginPage.tsx', import.meta.url), 'utf8')

test('PD-101 BLOCK1：正式登录脸使用独立 login copy 且无硬编码主文案或 devlogin 键', () => {
  assert.match(formalSource, /from '@\/copy\/login'/)
  assert.doesNotMatch(formalSource, /devlogin\./)
  assert.doesNotMatch(formalSource, /加载中…|登录失败，请稍后重试|手机号登录|11 位手机号|>\s*手机号\s*</)
})

test('PD-101 BLOCK2：产品登录与内测登录共用 LoginBrandShell', () => {
  assert.match(formalSource, /LoginBrandShell/)
  assert.match(devSource, /LoginBrandShell/)
  assert.doesNotMatch(formalSource, /<header className="px-8 pt-14">/)
  assert.doesNotMatch(devSource, /<header className="px-8 pt-14">/)
  assert.doesNotMatch(formalSource, /<footer className="mt-10 px-10/)
  assert.doesNotMatch(devSource, /<footer className="mt-10 px-10/)
})
