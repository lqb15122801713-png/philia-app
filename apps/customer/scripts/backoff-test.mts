/**
 * useEventSource 退避序列单测式验证（T2.0）
 *
 * 运行：server/node_modules/.bin/tsx apps/customer/scripts/backoff-test.mts
 * 断言 backoffDelay(0..n) === 1s/2s/5s/15s 之后封顶 15s。
 */

import { SSE_BACKOFF_DELAYS, backoffDelay } from '../../../packages/shared/src/api/hooks';

const attempts = [0, 1, 2, 3, 4, 5, 10, 100];
const got = attempts.map((a) => backoffDelay(a));
const expected = [1000, 2000, 5000, 15000, 15000, 15000, 15000, 15000];

console.log('SSE_BACKOFF_DELAYS =', SSE_BACKOFF_DELAYS);
console.log('attempts          =', attempts);
console.log('backoffDelay(...) =', got);

const ok =
  JSON.stringify(got) === JSON.stringify(expected) &&
  JSON.stringify([...SSE_BACKOFF_DELAYS]) === JSON.stringify([1000, 2000, 5000, 15000]) &&
  backoffDelay(-1) === 1000; // 负值钳位到序列头

console.log(ok ? '✅ 退避序列 1s/2s/5s/15s 封顶验证通过' : '❌ 退避序列不符合预期');
process.exit(ok ? 0 : 1);
