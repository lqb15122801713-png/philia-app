/**
 * mini 版 tRPC HTTP batch client（批次 7.1 任务 B/C）
 *
 * - 协议与三端同源：GET /trpc/<router>.<proc>?batch=1&input=urlencoded({"0":{"json":...}})，
 *   响应 superjson 包壳 [{"result":{"data":{"json":...,"meta":...}}}]（见 env-notes tRPC 要点）；
 * - 类型复用：AppRouter 相对路径 type-only 引 server 源（与 packages/shared/src/api/client.ts
 *   同手法，构建期擦除、零运行时开销；@trpc/server 的 infer 帮助器经 tsconfig paths 指到
 *   server/node_modules，不新增 npm 依赖——白名单不动）；
 * - superjson-lite 解码：仅还原 meta.values 中的 Date（只读页所需），其余类型原样保留
 *   （白名单不引 superjson；如需 bigint/Map 等完整解码，后续批次再评）；
 * - 会话 cookie：weapp 走请求头 / H5 走 cookie jar（见 ./request.ts）。
 */

import type { AppRouter } from '../../../../server/src/routers/index.js';
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import { API_BASE } from './config';
import { ApiError, apiFetch } from './request';

type Inputs = inferRouterInputs<AppRouter>;
type Outputs = inferRouterOutputs<AppRouter>;

/** superjson meta 中我们唯一还原的类型：Date */
interface SuperjsonMeta {
  values?: Record<string, string[]>;
}

interface BatchOk<T> {
  result: { data: { json: T; meta?: SuperjsonMeta } };
}
interface BatchErr {
  error: { json?: { message?: string; code?: number; data?: { code?: string; httpStatus?: number } } };
}
type BatchItem<T> = BatchOk<T> | BatchErr;

/** 按 meta.values 路径把 ISO 字符串还原为 Date（路径段为对象键或数组下标） */
function applySuperjsonDates(json: unknown, meta?: SuperjsonMeta): unknown {
  if (!meta?.values) return json;
  for (const [path, types] of Object.entries(meta.values)) {
    if (!types.includes('Date')) continue;
    const segs = path.split('.');
    let node: unknown = json;
    for (let i = 0; i < segs.length - 1; i++) {
      if (node == null || typeof node !== 'object') break;
      node = (node as Record<string, unknown>)[segs[i]!];
    }
    if (node == null || typeof node !== 'object') continue;
    const last = segs[segs.length - 1]!;
    const cur = (node as Record<string, unknown>)[last];
    if (typeof cur === 'string') {
      (node as Record<string, unknown>)[last] = new Date(cur);
    }
  }
  return json;
}

function unwrap<T>(items: BatchItem<T>[], proc: string): T {
  const item = items[0];
  if (!item) throw new ApiError(500, { message: `tRPC ${proc} 空响应` });
  if ('error' in item) {
    const je = item.error.json;
    throw new ApiError(je?.data?.httpStatus ?? 500, {
      message: je?.message ?? `tRPC ${proc} 调用失败`,
      code: je?.data?.code,
    });
  }
  return applySuperjsonDates(item.result.data.json, item.result.data.meta) as T;
}

/** tRPC query（HTTP batch，GET） */
export async function trpcQuery<R extends keyof Outputs & string, P extends keyof Outputs[R] & string>(
  router: R,
  proc: P,
  input?: Inputs[R][P],
): Promise<Outputs[R][P]> {
  const payload = { '0': { json: input ?? null } };
  const url = `${API_BASE}/trpc/${router}.${proc}?batch=1&input=${encodeURIComponent(JSON.stringify(payload))}`;
  const data = await apiFetch<BatchItem<Outputs[R][P]>[]>({ url });
  return unwrap(data, `${router}.${proc}`);
}
