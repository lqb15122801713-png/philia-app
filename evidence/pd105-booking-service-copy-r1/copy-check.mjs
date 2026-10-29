import { readFileSync } from 'node:fs';

const page = readFileSync('apps/customer/src/pages/GroomingSinglePage.tsx', 'utf8');
const chips = readFileSync('apps/customer/src/components/booking/single/ServiceChipsBlock.tsx', 'utf8');
const copy = readFileSync('apps/customer/src/copy/booking.ts', 'utf8');
const format = readFileSync('apps/customer/src/components/booking/format.ts', 'utf8');
const hint = '想换门店、毛孩子或服务？点一下就好';

const checks = [
  ['header copy key 有真实默认文案', copy.includes(`'booking.groomingHint': '${hint}'`)],
  ['header 经 CK＋bkc 渲染', page.includes(`<CK k="booking.groomingHint">{bkc('booking.groomingHint')}</CK>`)],
  ['header JSX 无裸中文 hint', !page.includes(`text-ink-secondary">${hint}</p>`)],
  ['页头无默认已填', !page.includes('默认已填')],
  ['大类 wash copy key', copy.includes("'booking.groomingCatWash': '洗澡'")],
  ['大类 style copy key', copy.includes("'booking.groomingCatStyle': '美容'")],
  ['style 使用具名正则常量', format.includes('export const GROOMING_STYLE_NAME_RE = /美容|造型|修毛|剪/;')],
  ['category helper 返回稳定 union key', format.includes("export const groomingServiceCategory = (name: string): 'wash' | 'style' =>")],
  ['category helper 使用具名正则', format.includes("GROOMING_STYLE_NAME_RE.test(name) ? 'style' : 'wash'")],
  ['label helper 从 copy 取 style', format.includes("'booking.groomingCatStyle'")],
  ['label helper 从 copy 取 wash', format.includes("'booking.groomingCatWash'")],
  ['label helper 不直接返回中文大类', !format.includes("? '美容' : '洗澡'")],
  ['CATEGORIES wash 按 key 匹配', chips.includes("groomingServiceCategory(s.name) === 'wash'")],
  ['CATEGORIES style 按 key 匹配', chips.includes("groomingServiceCategory(s.name) === 'style'")],
  ['CATEGORIES 显示名走 copy labelKey', chips.includes("labelKey: 'booking.groomingCatWash'") && chips.includes("labelKey: 'booking.groomingCatStyle'") && chips.includes('{bkc(c.labelKey)}')],
  ['CATEGORIES 不拿中文显示串当 key', !chips.includes("groomingServiceLabel(s.name) === '洗澡'") && !chips.includes("groomingServiceLabel(s.name) === '美容'")],
  ['服务 pill 空标题走 copy', page.includes("service ? groomingServiceLabel(service.name) : bkc('booking.groomingServiceTitle')")],
  ['共用副文已入文案表', copy.includes("'booking.groomingServiceDetailNote': '细节到店看宠再定'")],
  ['服务卡与网约选项副文可见', chips.includes('groomingServiceDetailNote') && page.includes('groomingServiceDetailNote')],
  ['主路径不直接渲染服务细项名', !page.includes('{service?.name ??') && !page.includes('<span className="text-body font-semibold">{item.name}</span>') && !chips.includes('{s.name}</span>')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length > 0) {
  console.error(`COPY_CHECK_RED=${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`COPY_CHECK_GREEN=${checks.length}/${checks.length}`);
