/**
 * useCheckin —— 契约 1（docs/STAFF-CONTRACTS.md）
 *
 * 调 trpc.appointment.checkin.mutate，错误映射为用户文案：
 * - 429 TOO_MANY_REQUESTS（防爆破锁定）→「尝试过多，已锁定 10 分钟，请稍后再试」
 * - FORBIDDEN（已指派他人 / 非同店）→ 保留服务端原文
 * - 二维码过期 / 验签失败（BAD_REQUEST 类，qr 通道）→「预约码已失效，请让客户刷新二维码，或报手机号手动核销」
 * - 人工码未找到（NOT_FOUND，code 通道）→ 保留服务端原文「核销码不存在或已失效」
 * - 幂等（已核销，服务端 HTTP 200 返回当前进度，idempotent: true）→ 视为成功
 *
 * 成功后 queryClient.invalidateQueries() 全刷（今日列表 / 执行页等）。
 */
import { useCallback, useRef, useState } from 'react';
import { TRPCClientError } from '@trpc/client';
import { usePhiliaClient } from '@philia/shared';
import type { AppRouter } from '@philia/shared';

/** 契约返回：核销成功后交给调用方跳转 */
export interface CheckinResult {
  appointmentId: string;
  nextRoute: string;
}

export type CheckinInput = { qr: string } | { code: string };

/** 面向用户的核销错误：message 已映射为可直接展示的中文文案 */
export class CheckinError extends Error {}

/** 从 tRPC 错误中取服务端错误码（'TOO_MANY_REQUESTS' 等字符串） */
function trpcCodeOf(err: unknown): string | undefined {
  if (err instanceof TRPCClientError) {
    // v11：err.data = { code: 'BAD_REQUEST', httpStatus, path, ... }
    const data = (err as TRPCClientError<AppRouter>).data as { code?: string } | undefined;
    if (data && typeof data.code === 'string') return data.code;
  }
  return undefined;
}

function serverMessageOf(err: unknown): string | undefined {
  if (err instanceof TRPCClientError && typeof err.message === 'string' && err.message) {
    return err.message;
  }
  return undefined;
}

/** 错误 → 用户文案（契约 1 错误映射表） */
function toUserMessage(err: unknown, input: CheckinInput): string {
  const code = trpcCodeOf(err);
  if (code === 'TOO_MANY_REQUESTS') {
    return '尝试过多，已锁定 10 分钟，请稍后再试';
  }
  if (code === 'FORBIDDEN') {
    // 已指派他人 / 非同店：保留服务端原文
    return serverMessageOf(err) ?? '无权核销该预约';
  }
  if ('qr' in input && (code === 'BAD_REQUEST' || code === 'PARSE_ERROR' || code === 'NOT_FOUND')) {
    // 二维码过期 / 验签失败 / 内容无法解析
    return '预约码已失效，请让客户刷新二维码，或报手机号手动核销';
  }
  // 人工码 NOT_FOUND / 其余情况：服务端原文兜底
  return serverMessageOf(err) ?? '核销失败，请重试';
}

export function useCheckin(): {
  checkin(input: CheckinInput): Promise<CheckinResult>;
  loading: boolean;
} {
  const { trpc, queryClient } = usePhiliaClient();
  const [loading, setLoading] = useState(false);
  const inflightRef = useRef(false);

  const checkin = useCallback(
    async (input: CheckinInput): Promise<CheckinResult> => {
      // 防重入：处理中直接复用拒绝，避免扫码帧循环重复触发
      if (inflightRef.current) throw new CheckinError('正在核销中，请稍候');
      inflightRef.current = true;
      setLoading(true);
      try {
        const res = await trpc.appointment.checkin.mutate(input);
        // 幂等（res.idempotent === true，HTTP 200 当前进度）同样走这里 → 视为成功
        const result: CheckinResult = {
          appointmentId: res.appointment.id,
          nextRoute: res.nextRoute,
        };
        // 全量失效刷新（今日任务 / 执行页 / 寄养页等）
        await queryClient.invalidateQueries();
        return result;
      } catch (err) {
        throw new CheckinError(toUserMessage(err, input));
      } finally {
        inflightRef.current = false;
        setLoading(false);
      }
    },
    [trpc, queryClient],
  );

  return { checkin, loading };
}
