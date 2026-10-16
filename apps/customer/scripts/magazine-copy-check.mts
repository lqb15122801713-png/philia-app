import assert from 'node:assert/strict'
import { setCopyOverrides } from '@philia/shared'
import { MAGAZINE_ARTICLES, magazineEntryOf } from '../src/copy/magazine'

setCopyOverrides([
  { key: 'mag.leadTitle', text: '端口本期标题' },
  { key: 'mag.leadBody1', text: '端口本期正文第一段' },
  { key: 'mag.e2Title', text: '端口次卡标题' },
  { key: 'mag.e2Body2', text: '端口次卡正文第二段' },
])

try {
  const [lead, second] = MAGAZINE_ARTICLES
  assert.equal(magazineEntryOf(lead).title, '端口本期标题')
  assert.equal(lead.paragraphs[0], '端口本期正文第一段')
  assert.equal(magazineEntryOf(second).title, '端口次卡标题')
  assert.equal(second.paragraphs[1], '端口次卡正文第二段')
  console.log('PASS 杂志 copy 覆盖值在模块加载后可动态读取')
} finally {
  setCopyOverrides([])
}
