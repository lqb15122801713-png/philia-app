import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const evidence = dirname(fileURLToPath(import.meta.url));
const root = join(evidence, '..', '..');
const read = (name) => readFileSync(join(evidence, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const results = [];
const check = (name, condition, detail = null) => results.push({ name, ok: Boolean(condition), detail });

const source = json('live-notification-fields.json');
const baseline = json('live-baseline-bundle.json');
const candidate = json('candidate-bundle.json');
const browser = json('browser-final.json');
const finalTests = read('final-test-staff-all.log');
const finalBuild = read('final-build-all.log');
const targetedLint = read('final-lint-targeted.log');
const fullLint = read('final-lint-staff-full.log');
const mutation = read('mutation-red-second-key.log');
const product = readFileSync(join(root, 'apps/staff/src/lib/notifications.ts'), 'utf8');
const test = readFileSync(join(root, 'apps/staff/src/lib/notifications.test.ts'), 'utf8');
const candidateBytes = readFileSync(join(root, 'apps/staff/dist/assets', candidate.candidateName));
const screenshotBytes = readFileSync(browser.screenshot.file);

check('冻结基线 tip／DEPLOY／员 dist', source.baselineTip === '524b4bc7e203890e42dd90c01bfd7a4c6f84613b' && source.deploy === '20261029214338' && source.actualDist === 'index-STmHfnb4.js');
check('现网基线包 hash 已钉', baseline.sha256 === candidate.baselineSha256 && baseline.bytes === candidate.baselineBytes);
check('R64 跨秒根因：同秒 24 组、同分钟 25 组', source.secondDuplicateGroups === 24 && source.minuteDuplicateGroups === 25);
check('20:51 双行分别为 11／12 秒', source.minuteDuplicates.some((group) => group.length === 2 && group[0].createdAt === '2026-10-29T12:51:12.000Z' && group[1].createdAt === '2026-10-29T12:51:11.000Z'));
check('产品态使用同分钟键', product.includes('Math.floor(row.createdAt.getTime() / 60_000)'));
check('PD-112 回归在产品测试内', test.includes('PD-112：同文同分钟跨秒双插只留一组'));
check('最终相关单测 12／12', finalTests.includes('# tests 12') && finalTests.includes('# pass 12') && finalTests.includes('# fail 0'));
check('三端构建均完成且员包为候选', (finalBuild.match(/vite v/g) ?? []).length === 3 && finalBuild.includes('dist/assets/index-Cp859QUp.js'));
check('触及文件 lint 零输出', targetedLint.length === 0);
check('全量 lint 红项如实保留', fullLint.includes('26 problems (25 errors, 1 warning)'));
check('受控破坏准确见红', mutation.includes('3 !== 2') && mutation.includes('# fail 1'));
check('受控破坏后已复跑最终绿', statSync(join(evidence, 'final-test-staff-all.log')).mtimeMs > statSync(join(evidence, 'mutation-red-second-key.log')).mtimeMs);
check('候选 js 名≠冻结员包', candidate.candidateName !== 'index-STmHfnb4.js' && candidate.nameDiffersFromBaseline);
check('候选 js 内容≠冻结员包', candidate.candidateSha256 !== candidate.baselineSha256 && candidate.contentDiffersFromBaseline);
check('候选未冒充 tip 包或部署', candidate.candidateIsTipPackage === false && candidate.candidateDeployed === false);
check('候选包 hash 与磁盘一致', createHash('sha256').update(candidateBytes).digest('hex') === candidate.candidateSha256 && candidateBytes.length === candidate.candidateBytes);
check('最终浏览器探针零失败', browser.failures === 0 && browser.results.every((result) => result.ok));
check('潘婧分组 dupPairGroups=0', browser.page.dupPairGroups === 0);
check('50 行收敛 25 组且不同分钟不合并', browser.page.rowCount === 25 && browser.page.careDistinctKeys === 25);
check('未读总数保持真实 61', browser.unreadConsistency.rawTotal === 61 && browser.page.unread === '未读 61 条');
check('25 个含未读 ID 组均有未读代表', browser.unreadConsistency.expectedUnreadGroups === 25 && browser.page.unreadVisibleGroups === 25);
check('未点全部已读／零业务 mutation', browser.clickedAllRead === false && browser.page.mutations.length === 0);
check('localhost 仅辅助非 HIT PASS', browser.scope.includes('非 tip 包') && browser.scope.includes('不作为 localhost preview 交付 HIT PASS'));
check('截图存在且 hash 自洽', screenshotBytes.length > 0 && createHash('sha256').update(screenshotBytes).digest('hex') === browser.screenshot.sha256);
check('mig0148 故意空留且未占文件', !readdirSync(join(root, 'server/drizzle')).some((name) => name.startsWith('0148')));

const failures = results.filter((result) => !result.ok);
const report = {
  at: new Date().toISOString(),
  defect: 'NOTIF-DUP-ROWS-OBS',
  mig0148: '故意空留；零 schema；禁占文件',
  candidate: candidate.candidateName,
  candidateIsTipPackage: false,
  localhostPreviewAcceptedAsHit: false,
  fullStaffLint: { errors: 25, warnings: 1, status: 'RED_BASELINE_UNTOUCHED_FILES' },
  checks: results,
  pass: results.length - failures.length,
  fail: failures.length,
};
writeFileSync(join(evidence, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`);
for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}`);
console.log(`${report.pass}/${results.length} checks passed; fail=${report.fail}`);
if (failures.length > 0) process.exitCode = 1;
