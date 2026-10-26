import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const evidence = dirname(fileURLToPath(import.meta.url));
const root = resolve(evidence, '..', '..');
const read = (name) => readFileSync(join(evidence, name), 'utf8');
const json = (name) => JSON.parse(read(name));
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const baseline = json('browser-baseline.json');
const final = json('browser-final.json');
const source = json('live-notification-fields.json');
const liveFile = join(evidence, 'live-index-DRu9UKUe.js');
const candidateFile = join(root, 'apps', 'staff', 'dist', 'assets', final.bundle.name);
const checks = [];
const check = (id, ok, actual) => checks.push({ id, ok: Boolean(ok), actual });

check('baseline-50-rows-25-groups', baseline.page.rowCount === 50 && baseline.page.dupPairGroups === 25, { rows: baseline.page.rowCount, groups: baseline.page.dupPairGroups });
check('final-25-rows-zero-groups', final.page.rowCount === 25 && final.page.dupPairGroups === 0, { rows: final.page.rowCount, groups: final.page.dupPairGroups });
check('final-seven-assertions-green', final.failures === 0 && final.results.length === 7 && final.results.every((row) => row.ok), { failures: final.failures, assertions: final.results.length });
check('same-source-fixture', baseline.source.sha256 === final.source.sha256 && source.rows.length === 50 && source.exactDuplicateGroups === 25, { baseline: baseline.source.sha256, final: final.source.sha256 });
check('source-links-prove-root-cause', source.rows.some((row, index) => source.rows.slice(index + 1).some((other) => other.type === row.type && other.title === row.title && other.body === row.body && other.createdAt === row.createdAt && other.link !== row.link)), 'same type/title/body/createdAt, different link');
check('candidate-name-not-either-control', final.bundle.name !== 'index-DRu9UKUe.js' && final.bundle.name !== 'index-DcDp2v-Y.js', final.bundle.name);
check('candidate-sha-matches-dist', final.bundle.sha256 === sha(candidateFile), final.bundle.sha256);
check('live-and-candidate-sha-differ', sha(liveFile) !== sha(candidateFile), { live: sha(liveFile), candidate: sha(candidateFile) });
check('candidate-html-links-bundle', readFileSync(join(root, 'apps', 'staff', 'dist', 'index.html'), 'utf8').includes(`/assets/${final.bundle.name}`), final.bundle.name);
check('live-html-links-control', read('live-staff-index.html').includes('/assets/index-DRu9UKUe.js'), 'index-DRu9UKUe.js');
check('unread-not-cleared', final.page.unread === `未读 ${source.rows.filter((row) => row.readAt === null).length} 条`, final.page.unread);
check('all-read-not-used', final.clickedAllRead === false && final.page.allReadVisible && final.page.mutations.length === 0, { clickedAllRead: final.clickedAllRead, mutations: final.page.mutations });
check('screenshots-differ', baseline.screenshot.sha256 !== final.screenshot.sha256, { baseline: baseline.screenshot.sha256, final: final.screenshot.sha256 });
check('unit-tests-green', /# pass 11\n# fail 0/.test(read('final-test-staff-all.log')), '11 pass / 0 fail');
check('three-app-build-green', (read('final-build-all.log').match(/✓ built in/g) ?? []).length === 3 && read('final-build-all.log').includes(final.bundle.name), final.bundle.name);
check('targeted-lint-clean', read('final-lint-targeted.log').trim() === '', '0 errors / 0 warnings');
const lintPattern = /✖ 26 problems \(25 errors, 1 warning\)/;
check('full-lint-baseline-unchanged', lintPattern.test(read('baseline-lint-staff.log')) && lintPattern.test(read('final-lint-staff-full.log')), 'baseline and final: 25 errors / 1 warning; not claimed green');
check('mutation-red-captured', read('mutation-red-restore-link-key.log').includes('50 !== 25') && read('mutation-red-restore-link-key.log').includes('3 !== 2'), 'link key restored produced expected RED');
check('mutation-reverted', !readFileSync(join(root, 'apps', 'staff', 'src', 'lib', 'notifications.ts'), 'utf8').includes('row.link,'), 'link removed from grouping key again');
check('health-four', [7200, 7201, 7202, 7203].every((port) => read('final-live-probe.log').includes(`HEALTH ${port}=200`)), '7200–7203 = 200');
check('browser-cleanup', read('final-browser-cleanup.log').includes('PD98_R2_CDP_AFTER=000'), read('final-browser-cleanup.log').trim());
check('migration-0145-empty', readdirSync(join(root, 'server', 'drizzle')).every((name) => !name.startsWith('0145')), '0145 故意空留');
const allowed = new Set([
  'apps/staff/src/lib/notifications.ts',
  'apps/staff/src/lib/notifications.test.ts',
  'apps/staff/src/pages/staff2/NotificationsPage.tsx',
  'apps/staff/scripts/pd98-staff-notif-dedupe-r2-check.mjs',
]);
const changed = [...new Set([
  ...git(['diff', '--name-only', 'HEAD']).split(/\r?\n/),
  ...git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/),
].filter(Boolean))];
const productChanges = changed.filter((name) => !name.startsWith('evidence/pd98-staff-notif-dedupe-r2/'));
check('notification-only-scope', productChanges.length > 0 && productChanges.every((name) => allowed.has(name)), productChanges);
check('not-tip-package', final.scope.includes('非 tip 包') && final.scope.includes('未点全部已读'), final.scope);

const failures = checks.filter((row) => !row.ok).length;
const report = {
  generatedAt: new Date().toISOString(),
  status: failures === 0 ? 'LOCAL_CANDIDATE_EVIDENCE_COMPLETE' : 'FAIL',
  delivery: 'PENDING_DELIVERY_HIT_AND_EXTERNAL_REVIEW',
  mergeDeploy: 'PENDING_MERGE_DEPLOY',
  formalClose: 'FORBIDDEN_UNTIL_POST_DEPLOY_NOTIFICATION_RETEST_PASS',
  tipPackage: false,
  baselineTip: '50d6a66f2162de881c32ab57268e076f81aeca4f',
  deploy: '20261026192944',
  migration: '0145 故意空留',
  liveBundle: { name: 'index-DRu9UKUe.js', sha256: sha(liveFile), bytes: readFileSync(liveFile).byteLength },
  candidateBundle: { name: final.bundle.name, sha256: sha(candidateFile), bytes: readFileSync(candidateFile).byteLength },
  forbiddenBundleNames: ['index-DRu9UKUe.js', 'index-DcDp2v-Y.js'],
  baseline: { rowCount: baseline.page.rowCount, dupPairGroups: baseline.page.dupPairGroups, unread: baseline.page.unread },
  candidate: { rowCount: final.page.rowCount, dupPairGroups: final.page.dupPairGroups, unread: final.page.unread },
  commands: [
    { command: 'npm run build', log: 'final-build-all.log', exitCode: 0 },
    { command: 'node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/staff/tsconfig.app.json --test apps/staff/src/lib/notifications.test.ts apps/staff/src/lib/localeInput.test.ts apps/staff/src/components/boarding/boardingExposure.test.tsx', log: 'final-test-staff-all.log', exitCode: 0, pass: 11, fail: 0 },
    { command: 'npx eslint src/lib/notifications.ts src/lib/notifications.test.ts src/pages/staff2/NotificationsPage.tsx scripts/pd98-staff-notif-dedupe-r2-check.mjs', log: 'final-lint-targeted.log', exitCode: 0, errors: 0, warnings: 0 },
    { command: 'npm run lint -w @philia/staff', log: 'final-lint-staff-full.log', exitCode: 1, status: 'BASELINE_RED_UNCHANGED', errors: 25, warnings: 1 },
    { command: 'PD98_PHASE=final node apps/staff/scripts/pd98-staff-notif-dedupe-r2-check.mjs', log: 'final-browser.log', exitCode: 0, assertions: 7 },
  ],
  defects: [{ id: 'NOTIF-DUP-ROWS-OBS', status: 'LOCAL_CANDIDATE_COVERED_PENDING_DELIVERY_HIT', evidence: 'browser-baseline.json vs browser-final.json' }],
  clickedAllRead: false,
  reuseForClear: false,
  checks,
  failures,
};
writeFileSync(join(evidence, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, checks: checks.length, failures, baseline: report.baseline, candidate: report.candidate, bundle: report.candidateBundle }, null, 2));
if (failures > 0) {
  for (const row of checks.filter((item) => !item.ok)) console.error(`FAIL ${row.id}: ${JSON.stringify(row.actual)}`);
  process.exitCode = 1;
}
