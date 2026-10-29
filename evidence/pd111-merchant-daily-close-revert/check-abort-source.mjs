import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const file = join(root, 'apps/merchant/src/components/cashier/DayClosePanels.tsx');
const source = readFileSync(file, 'utf8');
const match = source.match(/const abort = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[\]\)/);
if (!match) throw new Error('ABORT_SOURCE_NOT_FOUND');
const body = match[1];
const nativeCloseCalls = (body.match(/el\.close\(\)/g) ?? []).length;
const parallelOnClose = /else\s+onClose\(\)/.test(body) || /(?:^|\s)onClose\(\)/.test(body);
const result = {
  abortOnlyNativeClose: nativeCloseCalls === 1 && !parallelOnClose,
  nativeCloseCalls,
  parallelOnClose,
  body: body.trim(),
};
console.log(JSON.stringify(result, null, 2));
if (!result.abortOnlyNativeClose) process.exit(1);
