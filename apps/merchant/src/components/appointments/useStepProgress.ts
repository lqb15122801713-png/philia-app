/**
 * 列表行「服务中 N/6」步进（U4 任务 F · 试样 §2 总览/§3 预约列表胶囊口径）。
 *
 * listForStore 行不含步数；步数取现成 serviceStep.list（一单一查，零新接口），
 * queryKey 与监控 Hub / 详情 / 单约监控页同构（['serviceStep','list',aid]），
 * 同会话跨页共享缓存不重复拉取。仅 in_service 行挂查，其余状态不产生请求。
 * 查询未回时胶囊保持「服务中」裸文本（不伪造进度）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ListForStoreItem, StepListItem } from './appt-utils';

export interface StepProgress {
  done: number;
  total: number;
}

export function useStepProgress(items: ListForStoreItem[]): Map<string, StepProgress> {
  const { trpc } = usePhiliaClient();
  const serving = useMemo(() => items.filter((i) => i.status === 'in_service'), [items]);
  const queries = useQueries({
    queries: serving.map((it) => ({
      queryKey: ['serviceStep', 'list', it.id],
      queryFn: () => trpc.serviceStep.list.query({ appointmentId: it.id }),
    })),
  });
  return useMemo(() => {
    const m = new Map<string, StepProgress>();
    serving.forEach((it, i) => {
      const d = queries[i]?.data as StepListItem[] | undefined;
      if (d) {
        m.set(it.id, {
          done: d.filter((s) => s.status === 'done').length,
          total: d.length > 0 ? d.length : 6,
        });
      }
    });
    return m;
    // queries 每项 data 随查询完成更替；serving/queries 引用每轮渲染重建，依赖恒真即可
  }, [serving, queries]);
}
