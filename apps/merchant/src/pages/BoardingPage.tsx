/**
 * 寄养管理（/boarding · T4.3 · coder-staff-admin）
 *
 * 数据源：boarding.stayBoard（merchant 本店在店宠物看板：
 * stay + appointment + pet + customer + 最近打卡日期 + 超期标记）。
 *
 * 功能：
 * - 卡片网格看板（头像/名/房间号/入住日期/预计退房/最近打卡；超期红色标记）；
 * - 点卡进详情（lg 横屏右侧栏 / 手机下方展开）：入住信息 + 物品清单 + 结算区；
 * - 「退房结算」→ 确认弹层（应收金额=预约快照价）→ boarding.checkout →
 *   toast + invalidate；到店付单额外提示去财务「待收款」确认收款；
 * - 「只看超期」筛选开关；
 * - SSE（store:{storeId} 频道）：boarding.daily_update / boarding.completed /
 *   appointment.checkedin / boarding.overdue → invalidate 看板。
 */

import { EventType, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import BoardingStayCard from '../components/staff-admin/BoardingStayCard';
import BoardingStayDetail from '../components/staff-admin/BoardingStayDetail';
import CheckoutDialog from '../components/staff-admin/CheckoutDialog';
import { useMerchantEvents } from '../components/staff-admin/useMerchantEvents';
import type { StayBoardRow } from '../components/staff-admin/types';
import { Empty, Loading, Switch, ToasterMount, toast } from '../components/staff-admin/ui';

export default function BoardingPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const boardQuery = useQuery({
    queryKey: ['boarding', 'stayBoard'],
    queryFn: () => trpc.boarding.stayBoard.query(),
  });
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkoutFor, setCheckoutFor] = useState<StayBoardRow | null>(null);

  const invalidateBoard = () =>
    void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayBoard'] });

  // SSE：寄养相关事件 → 看板对齐（断线重连时全量对齐一次）
  useMerchantEvents({
    onEvent: (env) => {
      if (env.type === EventType.BoardingDailyUpdate) {
        const petName = (env.data as { petName?: string })?.petName;
        toast(petName ? `「${petName}」有新的寄养打卡` : '有新的寄养打卡', 'info');
        invalidateBoard();
      } else if (
        env.type === EventType.BoardingCompleted ||
        env.type === EventType.AppointmentCheckedIn ||
        env.type === EventType.AppointmentCancelled
      ) {
        invalidateBoard();
      } else if (env.type === EventType.BoardingOverdue) {
        toast('有寄养单已超期，请及时处理', 'error');
        invalidateBoard();
      }
    },
    onReconnect: invalidateBoard,
  });

  const board = useMemo(() => (boardQuery.data?.board ?? []) as StayBoardRow[], [boardQuery.data]);
  const overdueCount = useMemo(() => board.filter((r) => r.overdue).length, [board]);
  const visible = useMemo(
    () => (onlyOverdue ? board.filter((r) => r.overdue) : board),
    [board, onlyOverdue],
  );
  const selected = useMemo(
    () => board.find((r) => r.stay.id === selectedId) ?? null,
    [board, selectedId],
  );

  // 选中的寄养单退房/消失后清除选择
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <ToasterMount />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-lg font-semibold text-ink">寄养管理</h1>
          <p className="mt-0.5 text-caption text-ink-secondary">
            在店 {board.length} 只
            {overdueCount > 0 ? <span className="text-danger-deep"> · 超期 {overdueCount} 只</span> : null}
          </p>
        </div>
        <label className="flex items-center gap-2 text-body text-ink-secondary">
          只看超期
          <Switch checked={onlyOverdue} onChange={setOnlyOverdue} label="只看超期" />
        </label>
      </div>

      {boardQuery.isPending ? (
        <Loading />
      ) : boardQuery.isError ? (
        <Empty title="寄养看板加载失败" hint="请检查网络后重新进入" />
      ) : board.length === 0 ? (
        <Empty title="当前没有在店寄养的宠物" hint="客户寄养单核销入店后会出现在这里" />
      ) : visible.length === 0 ? (
        <Empty title="没有超期的寄养单" hint="关掉「只看超期」可查看全部在店宠物" />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-4">
          {/* 卡片网格 */}
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((row) => (
              <BoardingStayCard
                key={row.stay.id}
                row={row}
                selected={selectedId === row.stay.id}
                onSelect={() => setSelectedId(row.stay.id)}
              />
            ))}
          </div>

          {/* 详情：lg 右侧栏 */}
          <div className="sticky top-4 hidden max-h-[calc(100vh-6rem)] lg:block">
            {selected ? (
              <BoardingStayDetail row={selected} onCheckout={() => setCheckoutFor(selected)} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-card bg-card text-body text-ink-placeholder shadow-card">
                点选左侧卡片查看入住详情
              </div>
            )}
          </div>

          {/* 详情：手机选中后下方展开 */}
          {selected ? (
            <div className="mt-3 lg:hidden">
              <BoardingStayDetail row={selected} onCheckout={() => setCheckoutFor(selected)} />
            </div>
          ) : null}
        </div>
      )}

      <CheckoutDialog
        row={checkoutFor}
        open={checkoutFor !== null}
        onClose={() => setCheckoutFor(null)}
        onCheckedOut={invalidateBoard}
      />
    </div>
  );
}
