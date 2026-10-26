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
const liveFile = join(evidence, 'live-index-DcDp2v-Y.js');
const candidateFile = join(root, 'apps', 'staff', 'dist', 'assets', final.bundle.name);
const checks = [];
const check = (id, ok, actual) => checks.push({ id, ok: Boolean(ok), actual });

check('baseline-defects-reproduced', baseline.failures >= 8, baseline.failures);
check('candidate-browser-all-green', final.failures === 0 && final.results.length === 16 && final.results.every((row) => row.ok), { failures: final.failures, assertions: final.results.length });
check('candidate-dist-name-differs', final.bundle.name !== 'index-DcDp2v-Y.js', final.bundle.name);
check('candidate-dist-sha-matches-report', final.bundle.sha256 === sha(candidateFile), final.bundle.sha256);
check('live-and-candidate-sha-differ', sha(liveFile) !== sha(candidateFile), { live: sha(liveFile), candidate: sha(candidateFile) });
check('candidate-dist-linked-by-html', readFileSync(join(root, 'apps', 'staff', 'dist', 'index.html'), 'utf8').includes(`/assets/${final.bundle.name}`), final.bundle.name);
check('live-html-uses-control-dist', read('live-staff-index.html').includes('/assets/index-DcDp2v-Y.js'), 'index-DcDp2v-Y.js');
check('baseline-native-locale-controls', baseline.schedule.inputs.some((row) => row.type === 'time') && baseline.schedule.inputs.some((row) => row.type === 'date'), baseline.schedule.inputs);
check('candidate-locale-values', final.schedule.inputs.every((row) => row.type === 'text') && final.schedule.inputs.map((row) => row.value).join('|') === '09:00|18:00|2026-10-26|2026-10-26', final.schedule.inputs);
check('candidate-schedule-date-locale', final.appointment.dateInput.type === 'text' && final.appointment.dateInput.value === '2026-10-26', final.appointment.dateInput);
check('candidate-subtitles-absent', final.schedule.subtitle === null && final.appointment.subtitle === null && final.me.subtitle === null && final.notifications.before.subtitle === null, { mySchedule: final.schedule.subtitle, schedule: final.appointment.subtitle, me: final.me.subtitle, notifications: final.notifications.before.subtitle });
check('candidate-role-english-absent', !final.me.body?.includes('frontdesk') && !final.me.body?.includes('groomer'), final.me);
check('baseline-notification-pairs', baseline.notifications.before.rows.length === 6, baseline.notifications.before.rows);
check('candidate-notification-groups', final.notifications.before.rows.length === 4 && final.notifications.after.rows === 4, { before: final.notifications.before.rows, after: final.notifications.after.rows });
const markReadBodies = final.notifications.after.mutations.filter((row) => row.procedures.includes('push.markRead')).map((row) => row.body).join('\n');
check('candidate-group-mark-read', markReadBodies.includes('care-1637-a') && markReadBodies.includes('care-1637-b'), final.notifications.after.mutations);
check('candidate-unread-source-preserved', final.notifications.before.unread.includes('未读 6 条') && final.notifications.after.unread.includes('未读 4 条'), { before: final.notifications.before.unread, after: final.notifications.after.unread });
check('mark-all-not-used', final.notifications.after.markAllClicks === 0, final.notifications.after.markAllClicks);
check('mock-procedures-known', final.notifications.after.unknown.length === 0, final.notifications.after.unknown);
check('browser-cleanup', read('final-browser-cleanup.log').includes('PD98_PORT_9398_AFTER=000'), read('final-browser-cleanup.log').trim());
check('unit-tests-green', /# pass 10\n# fail 0/.test(read('final-test-staff-all.log')), '10 pass / 0 fail');
check('three-app-build-green', read('final-build-all.log').includes('dist/assets/index-XpRzbUj5.js') && (read('final-build-all.log').match(/✓ built in/g) ?? []).length === 3, 'customer / merchant / staff built');
check('targeted-lint-no-new-error', read('final-lint-targeted.log').includes('0 errors, 1 warning'), '0 error / 1 baseline warning');
const lintPattern = /✖ 26 problems \(25 errors, 1 warning\)/;
check('full-lint-baseline-unchanged', lintPattern.test(read('baseline-lint-staff.log')) && lintPattern.test(read('final-lint-staff-full.log')), 'baseline and final: 25 errors / 1 warning; not claimed green');
check('mutation-red-captured', read('mutation-red-exact-milliseconds.log').includes('5 !== 3'), 'exact-millisecond mutation produced 5 !== 3');
check('mutation-restored', readFileSync(join(root, 'apps', 'staff', 'src', 'lib', 'notifications.ts'), 'utf8').includes('Math.floor(row.createdAt.getTime() / 1000)'), 'same-second grouping restored');
const screenshotComparisons = Object.keys(final.screenshots).filter((name) => baseline.screenshots[name]).map((name) => ({ name, baseline: baseline.screenshots[name].sha256, final: final.screenshots[name].sha256, different: baseline.screenshots[name].sha256 !== final.screenshots[name].sha256 }));
check('screenshots-differ-from-baseline', screenshotComparisons.length >= 5 && screenshotComparisons.every((row) => row.different), screenshotComparisons);
check('health-four-fresh', [7200, 7201, 7202, 7203].every((port) => read('final-live-probe.log').includes(`HEALTH ${port}=200`)), '7200–7203 = 200');
const migrations = readdirSync(join(root, 'server', 'drizzle')).filter((name) => /^(0139|0140)/.test(name));
check('migration-0139-left-empty', migrations.length === 0, { reserved: '0139 故意空留', alsoNotOccupied: '0140', files: migrations });
const changed = [...new Set([
  ...git(['diff', '--name-only', 'HEAD']).split(/\r?\n/),
  ...git(['ls-files', '--others', '--exclude-standard']).split(/\r?\n/),
].filter(Boolean))];
const productChanges = changed.filter((name) => !name.startsWith('evidence/pd98-staff-locale-notif-dedupe/'));
check('scope-staff-only', productChanges.length > 0 && productChanges.every((name) => name.startsWith('apps/staff/')), productChanges);
check('no-reuse-for-clear', final.phase === 'final' && final.scope.includes('真实员工 dist') && final.scope.includes('不是现网 tip 包'), final.scope);

const failures = checks.filter((row) => !row.ok).length;
const report = {
  generatedAt: new Date().toISOString(),
  status: failures === 0 ? 'LOCAL_CANDIDATE_EVIDENCE_COMPLETE' : 'FAIL',
  delivery: 'PENDING_DELIVERY_HIT_AND_EXTERNAL_REVIEW',
  mergeDeploy: 'PENDING_MERGE_DEPLOY',
  tipPackage: false,
  baselineTip: '42bb0f67945fe774f2c22d098fed185a0a0929a5',
  deploy: '20261026160104',
  migration: '0139 故意空留',
  liveBundle: { name: 'index-DcDp2v-Y.js', sha256: sha(liveFile), bytes: readFileSync(liveFile).byteLength },
  candidateBundle: { name: final.bundle.name, sha256: sha(candidateFile), bytes: readFileSync(candidateFile).byteLength },
  commands: [
    { command: 'npm run build', log: 'final-build-all.log', exitCode: 0 },
    { command: 'node server/node_modules/tsx/dist/cli.mjs --tsconfig apps/staff/tsconfig.app.json --test apps/staff/src/lib/notifications.test.ts apps/staff/src/lib/localeInput.test.ts apps/staff/src/components/boarding/boardingExposure.test.tsx', log: 'final-test-staff-all.log', exitCode: 0, pass: 10, fail: 0 },
    { command: 'npx eslint <PD-98 touched files>', log: 'final-lint-targeted.log', exitCode: 0, errors: 0, warnings: 1 },
    { command: 'npm run lint -w @philia/staff', log: 'final-lint-staff-full.log', exitCode: 1, status: 'BASELINE_RED_UNCHANGED', errors: 25, warnings: 1 },
    { command: 'PD98_PHASE=final node apps/staff/scripts/pd98-staff-locale-notif-dedupe-check.mjs', log: 'final-browser.log', exitCode: 0, assertions: 16 },
  ],
  screenshotComparisons,
  defects: [
    'AE-STAFF-R58-06',
    'AE-STAFF-R58-07',
    'AE-STAFF-R58-08',
    'NOTIF-DUP-ROWS-OBS',
    'EN-SUBTITLE-EXPOSURE-OBS',
  ].map((id) => ({ id, status: 'LOCAL_CANDIDATE_COVERED_PENDING_DELIVERY_HIT', evidence: 'browser-baseline.json vs browser-final.json' })),
  reuseForClear: false,
  checks,
  failures,
};
writeFileSync(join(evidence, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, checks: checks.length, failures, candidate: report.candidateBundle }, null, 2));
if (failures > 0) {
  for (const row of checks.filter((item) => !item.ok)) console.error(`FAIL ${row.id}: ${JSON.stringify(row.actual)}`);
  process.exitCode = 1;
}
