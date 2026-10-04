/**
 * 工位台 · /today（员工端骨架整建批片 1 · S-01 重建）
 *
 * 依据=UX 语言包 V1.1 §三 S-01 骨架：apphead → S2 工位大卡 → 下一单 nextrow →
 * que 排队行 → S5 功能三格 → dayfoot 班结行；dock=SkDock「工位」激活（本页自渲染，
 * App.tsx 旧 StaffDock 对 /today 已摘除）；样式全走 styles/skeleton.css（.sk 作用域，
 * main.tsx 挂载），文案全走 skc()/TODAY_COPY 键，页内零新造样式。
 *
 * 零回退承接（原 FrontdeskDesk/GroomerDesk/deck 数据流一个不失）：
 * - 角色分流（useMe → staffRole）、无 staff 记录空态原样保留；
 * - appointment.listTodayForStaff（60s 轮询兜底）+ auth.me 原始响应
 *   + serviceStep.list（在途单六步三态推导）+ store.listStaffPublic（前台员工名）
 *   + QrScanner 懒加载核销流（成功按服务端 nextRoute 跳转）；
 * - SSE：useStaffEvents（assigned/rescheduled/cancelled/step_flagged → toast+invalidate），
 *   断线重连全量对齐；
 * - 任务总线 staffTask.listMy：三格红点（approval 仅店长视界 server 已滤 / inventory）
 *   + 寄养照护待办行 + SkNote 在途计数透出。
 */

import {
  EventType,
  SERVICE_STEPS,
  Skeleton,
  StepKeyLabel,
  useMe,
  usePhiliaClient,
  useToast,
  type EventEnvelope,
} from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { PawPrint } from 'lucide-react';
import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  SkAppHead,
  SkBtnAction,
  SkDayFoot,
  SkDock,
  SkEmpty,
  SkNextRow,
  SkNote,
  SkQueRow,
  SkRow,
  SkRows,
  SkTrio,
  SkWorkCard,
  type SkStep,
} from '@/components/skeleton';
import { fmtMin, minutesOf } from '@/components/today/deck/deckUtils';
import { useStaffEvents } from '@/components/today/useStaffEvents';
import { hhmm } from '@/components/today/utils';
import { skc } from '@/copy/skeleton';
import { TODAY_COPY } from '@/copy/today';

// 契约1：QrScanner（T3.2 components/scan/QrScanner.tsx）懒加载接入（复用不动）
const QrScanner = lazy(() => import('@/components/scan/QrScanner'));

const TODAY_QUERY_KEY = ['appointment', 'listTodayForStaff'] as const;
const ME_RAW_KEY = ['auth', 'me', 'raw', 'staff-deck'] as const;
const STAFF_PUBLIC_KEY = ['store', 'listStaffPublic'] as const;
const BUS_QUERY_KEY = ['staffTask', 'listMy'] as const;

export default function TodayPage() {
  const navigate = useNavigate();
  const { user, loading } = useMe();
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast();
  const [scanOpen, setScanOpen] = useState(false);
  const now = new Date();
  const staffId = user?.staffId ?? null;
  const isFrontdesk = user?.staffRole === 'frontdesk';

  const todayQuery = useQuery({
    queryKey: TODAY_QUERY_KEY,
    queryFn: () => trpc.appointment.listTodayForStaff.query(),
    refetchInterval: 60_000, // 弱网 / SSE 断线兜底轮询
    enabled: staffId !== null,
  });
  const meRawQ = useQuery({
    queryKey: ME_RAW_KEY,
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
    enabled: staffId !== null,
  });
  // 任务总线（server 已按角色滤视界：审批类仅 manager/owner）
  const busQuery = useQuery({
    queryKey: BUS_QUERY_KEY,
    queryFn: () => trpc.staffTask.listMy.query(),
    refetchInterval: 60_000,
    enabled: staffId !== null,
  });
  const storeId = meRawQ.data?.store?.id ?? null;
  const staffPublicQ = useQuery({
    queryKey: [...STAFF_PUBLIC_KEY, storeId],
    queryFn: () => trpc.store.listStaffPublic.query({ storeId: storeId! }),
    enabled: isFrontdesk && storeId !== null,
    staleTime: 300_000,
  });

  const items = useMemo(() => todayQuery.data ?? [], [todayQuery.data]);
  const groomingItems = useMemo(() => items.filter((i) => i.type === 'grooming'), [items]);
  const inServiceItem = groomingItems.find((i) => i.status === 'in_service') ?? null;

  // 在途单六步（serviceStep.list 既有数据流）：done/active/locked → done/now/future
  const stepsQ = useQuery({
    queryKey: ['serviceStep', 'list', inServiceItem?.id],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId: inServiceItem!.id }),
    enabled: inServiceItem !== null,
    staleTime: 30_000,
  });

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TODAY_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: BUS_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ['serviceStep', 'list'] });
  }, [queryClient]);

  // 事件去重：envelope.id Set（FIFO 500；续传补发/多端同事件会重复到达）
  const seenRef = useRef<{ set: Set<string>; queue: string[] }>({ set: new Set(), queue: [] });
  const markSeen = useCallback((id: string): boolean => {
    const s = seenRef.current;
    if (s.set.has(id)) return false;
    s.set.add(id);
    s.queue.push(id);
    if (s.queue.length > 500) {
      const oldest = s.queue.shift();
      if (oldest) s.set.delete(oldest);
    }
    return true;
  }, []);

  const onEvent = useCallback(
    (envelope: EventEnvelope) => {
      if (!markSeen(envelope.id)) return;
      const data = (envelope.data ?? {}) as Record<string, unknown>;
      switch (envelope.type) {
        case EventType.AppointmentAssigned: {
          if (isFrontdesk) {
            showToast('收到新派单，请查看今日接待');
          } else {
            const petName = typeof data.petName === 'string' ? data.petName : '';
            showToast(petName ? `新派单：${petName}` : '收到新派单，请查看今日任务');
          }
          invalidateAll();
          break;
        }
        case EventType.AppointmentRescheduled:
          showToast('有预约改期，请查看最新安排');
          invalidateAll();
          break;
        case EventType.AppointmentCancelled:
          showToast('有预约已取消');
          invalidateAll();
          break;
        case EventType.StepFlagged: {
          if (isFrontdesk) break;
          const stepKey = typeof data.stepKey === 'string' ? data.stepKey : '';
          showToast(`商家要求重拍：${StepKeyLabel[stepKey] ?? (stepKey || '步骤')}`);
          invalidateAll();
          break;
        }
        default:
          break;
      }
    },
    [invalidateAll, isFrontdesk, markSeen, showToast],
  );

  useStaffEvents({ onEvent, onReconnect: invalidateAll });

  const busTasks = useMemo(() => busQuery.data?.tasks ?? [], [busQuery.data]);
  const hasApprovalTask = busTasks.some((t) => t.kind === 'approval');
  const hasInventoryTask = busTasks.some((t) => t.kind === 'inventory');
  const boardingTasks = useMemo(() => busTasks.filter((t) => t.kind === 'boarding'), [busTasks]);

  const staffNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staffPublicQ.data?.staff ?? []) m.set(s.id, s.name);
    return m;
  }, [staffPublicQ.data]);

  // 六步三态（在途=serviceStep 真数据推导；待开始=冻结六步全 future）
  const workSteps = useMemo((): SkStep[] => {
    return SERVICE_STEPS.map((def) => {
      const rec = inServiceItem ? stepsQ.data?.find((s) => s.stepKey === def.stepKey) : undefined;
      const state: SkStep['state'] =
        rec?.status === 'done' ? 'done' : rec?.status === 'active' ? 'now' : 'future';
      return { key: def.stepKey, name: def.name, state };
    });
  }, [inServiceItem, stepsQ.data]);
  const doneCount = workSteps.filter((s) => s.state === 'done').length;
  const activeStep = workSteps.find((s) => s.state === 'now') ?? null;

  // 工位大卡主角（美容师）：在途 in_service 单 > 今日最近一条 confirmed 待开始单
  const nextConfirmed = groomingItems.find((i) => i.status === 'confirmed') ?? null;
  const heroItem = inServiceItem ?? nextConfirmed;
  // 下一单 nextrow：今日最近一条 confirmed（大卡已占用的那条不再重复出现）
  const nextUpItem =
    groomingItems.find((i) => i.status === 'confirmed' && i.id !== heroItem?.id) ?? null;
  // 排队行 n=今日剩余单数（未完结：待确认/待开始/服务中）
  const remaining = items.filter(
    (i) => i.status === 'pending' || i.status === 'confirmed' || i.status === 'in_service',
  ).length;

  // 前台核销大卡 + 今日接待分组（照原 FrontdeskDesk 口径）
  const waitingItems = groomingItems.filter(
    (i) => !i.checkedInAt && (i.status === 'confirmed' || i.status === 'pending'),
  );
  const checkedItems = groomingItems.filter((i) => i.checkedInAt);
  const frontdeskStats = {
    checked: checkedItems.length,
    waiting: waitingItems.length,
    inService: groomingItems.filter((i) => i.status === 'in_service').length,
  };

  // 待办：改期回退待确认 + 寄养入住待登记（原 FrontdeskDesk）+ 寄养照护（任务总线）
  const reschedulePending = items.filter((i) => i.status === 'pending');
  const boardingCheckin = items.filter((i) => i.type === 'boarding' && i.status === 'confirmed');
  const hasTodos =
    reschedulePending.length > 0 || boardingCheckin.length > 0 || boardingTasks.length > 0;

  // 加载态：骨架（分流前不闪任何一台的内容）
  if (loading) {
    return (
      <div className="px-4 pb-6">
        <div className="pt-6">
          <Skeleton className="h-8 w-32 !rounded-chip" />
          <Skeleton className="mt-2 h-5 w-48 !rounded-chip" />
        </div>
        <div className="mt-6 space-y-3" aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <div key={i} className="u1-card p-4">
              <Skeleton className="h-6 w-20 !rounded-chip" />
              <Skeleton className="mt-2 h-5 w-40 !rounded-chip" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 无 staff 记录（已登录但店主尚未分配员工身份/角色）→ 友好空态，不白屏不报错（原样保留）
  if (!user?.staffId) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <span
          aria-hidden
          className="flex h-24 w-24 items-center justify-center rounded-full bg-sunken"
        >
          <PawPrint className="h-11 w-11 text-ink" strokeWidth={1.5} />
        </span>
        <h1 className="u1-serif mt-5 text-title-lg font-bold">{TODAY_COPY['today.noRole.title']}</h1>
        <p className="mt-2 text-body-sm text-ink-secondary">
          {TODAY_COPY['today.noRole.bodyLead'].replace('{name}', user?.nickname ?? user?.id ?? '')}
          <br />
          {TODAY_COPY['today.noRole.bodyGuide']}
        </p>
      </div>
    );
  }

  return (
    <div className="sk">
      <SkAppHead title={skc('sk.workTitle')} no={skc('sk.workNo')} />

      {todayQuery.isPending ? (
        // 加载 >300ms 骨架（禁转圈；骨架形状=内容轮廓）
        <div className="mx-[22px] mt-2" aria-label="加载中">
          <Skeleton className="h-[200px] !rounded-[22px]" />
          <Skeleton className="mt-3 h-[56px] !rounded-[16px]" />
          <Skeleton className="mt-3 h-[44px] !rounded-[18px]" />
        </div>
      ) : todayQuery.isError ? (
        // 错误态：一句话 + 重试真链路（通用 UI 词不入 copy 表，today.ts 头注口径）
        <>
          <SkEmpty title="今日任务加载失败，请检查网络后重试" />
          <div className="mx-[22px] mt-3">
            <SkBtnAction onClick={() => void todayQuery.refetch()}>重新加载</SkBtnAction>
          </div>
        </>
      ) : (
        <>
          {/* S2 工位大卡 */}
          {isFrontdesk ? (
            // 前台：大卡=核销大卡（无六步 → steps 空数组；CTA=扫码核销既有流）
            <>
              <SkWorkCard
                tag={TODAY_COPY['today.frontdesk.tag']}
                name={TODAY_COPY['today.frontdesk.pendingCount'].replace(
                  '{n}',
                  String(frontdeskStats.waiting),
                )}
                sub={
                  waitingItems[0]
                    ? fmtMin(minutesOf(waitingItems[0].scheduledStart))
                    : hhmm(now)
                }
                steps={[]}
                countText={TODAY_COPY['today.frontdesk.stats']
                  .replace('{checked}', String(frontdeskStats.checked))
                  .replace('{waiting}', String(frontdeskStats.waiting))
                  .replace('{inService}', String(frontdeskStats.inService))}
                cta={TODAY_COPY['today.frontdesk.scanCta']}
                ctaTestId="frontdesk-scan"
                onCta={() => setScanOpen(true)}
              />
              <SkNote>{TODAY_COPY['today.frontdesk.scanHint']}</SkNote>
              {/* 大卡同区段内嵌今日接待分组（待核销/已核销，照原 FrontdeskDesk 数据口径） */}
              {groomingItems.length === 0 ? (
                <div data-testid="deck-empty">
                  <SkEmpty title={TODAY_COPY['today.frontdesk.empty']} />
                </div>
              ) : (
                <>
                  {waitingItems.length > 0 ? (
                    <>
                      <SkNote>{TODAY_COPY['today.frontdesk.groupPending']}</SkNote>
                      <SkRows testId="frontdesk-waiting">
                        {waitingItems.map((i) => (
                          <SkRow
                            key={i.id}
                            label={`${fmtMin(minutesOf(i.scheduledStart))} ${i.petName ?? '宠物'} · ${i.serviceName ?? '服务'}`}
                            value={(i.staffId && staffNameById.get(i.staffId)) || ''}
                            tone="mut"
                          />
                        ))}
                      </SkRows>
                    </>
                  ) : null}
                  {checkedItems.length > 0 ? (
                    <>
                      <SkNote>{TODAY_COPY['today.frontdesk.groupDone']}</SkNote>
                      <SkRows testId="frontdesk-checked">
                        {checkedItems.map((i) => (
                          <SkRow
                            key={i.id}
                            label={`${i.petName ?? '宠物'} · ${i.serviceName ?? '服务'}`}
                            value={i.checkedInAt ? fmtMin(minutesOf(i.checkedInAt)) : ''}
                            tone="mut"
                          />
                        ))}
                      </SkRows>
                    </>
                  ) : null}
                </>
              )}
            </>
          ) : heroItem ? (
            // 美容师：在途单（六步真状态）/ 最近待开始单（六步全 future）
            <SkWorkCard
              tag={inServiceItem ? skc('sk.stepNow') : skc('sk.stepTodo')}
              name={`${heroItem.petName ?? '宠物'} · ${heroItem.serviceName ?? '服务'}`}
              sub={`${fmtMin(minutesOf(heroItem.scheduledStart))}–${fmtMin(minutesOf(heroItem.scheduledEnd))}${activeStep ? ` · ${activeStep.name}` : ''}`}
              steps={workSteps}
              countText={skc('sk.workCount', { done: doneCount, total: workSteps.length })}
              cta={inServiceItem ? skc('sk.workCta') : skc('sk.workCtaStart')}
              ctaTestId={`svc-continue-${heroItem.id}`}
              onCta={() => navigate(`/execute/${heroItem.id}`)}
            />
          ) : (
            <div data-testid="deck-empty">
              <SkEmpty title={skc('sk.idleTitle')} body={skc('sk.idleBody')} />
            </div>
          )}

          {/* 待办行（改期回退待确认 / 寄养入住待登记 / 任务总线寄养照护；无待办整段不渲染） */}
          {hasTodos ? (
            <>
              <SkNote>{TODAY_COPY['today.todo.title']}</SkNote>
              <SkRows testId="frontdesk-todos">
                {reschedulePending.length > 0 ? (
                  <SkRow
                    testId="todo-reschedule"
                    tone="red"
                    label={TODAY_COPY['today.todo.reschedule'].replace(
                      '{n}',
                      String(reschedulePending.length),
                    )}
                    value={`${reschedulePending[0]!.petName ?? '宠物'} · ${fmtMin(minutesOf(reschedulePending[0]!.scheduledStart))}`}
                  />
                ) : null}
                {boardingCheckin.length > 0 ? (
                  <SkRow
                    testId="todo-boarding"
                    label={`${TODAY_COPY['today.todo.boardingIn'].replace('{n}', String(boardingCheckin.length))} · ${boardingCheckin[0]!.petName ?? '宠物'}`}
                    value={
                      <Link to={`/boarding/${boardingCheckin[0]!.id}/checkin`}>
                        {TODAY_COPY['today.todo.boardingInCta']}
                      </Link>
                    }
                  />
                ) : null}
                {boardingTasks.map((t) => (
                  <SkRow
                    key={t.refId}
                    tone="red"
                    label={t.title}
                    value={<Link to={t.link}>{TODAY_COPY['today.todo.boardingCareCta']}</Link>}
                  />
                ))}
              </SkRows>
            </>
          ) : null}

          {/* 下一单 nextrow */}
          {nextUpItem ? (
            <SkNextRow
              testId="sk-nextrow"
              title={`${fmtMin(minutesOf(nextUpItem.scheduledStart))} ${nextUpItem.petName ?? '宠物'} · ${nextUpItem.serviceName ?? '服务'}`}
              sub={nextUpItem.note ?? ''}
              to="/schedule"
            />
          ) : (
            <SkNextRow testId="sk-nextrow" title={skc('sk.nextTitle')} sub={skc('sk.nextEmpty')} />
          )}

          {/* que 排队行（n=今日剩余单数） */}
          <SkQueRow text={skc('sk.queueTitle', { n: remaining })} />

          {/* S5 功能三格（approval 红点仅店长视界有件时亮；inventory 红点=draft/counted 有件） */}
          <SkTrio
            items={[
              {
                key: 'punch',
                title: skc('sk.trioPunch'),
                sub: skc('sk.trioPunchSub'),
                to: '/attendance',
              },
              {
                key: 'approval',
                title: skc('sk.trioApproval'),
                sub: skc('sk.trioApprovalSub'),
                to: '/manager',
                dot: hasApprovalTask,
              },
              {
                key: 'inventory',
                title: skc('sk.trioInventory'),
                sub: skc('sk.trioInventorySub'),
                to: '/inventory',
                dot: hasInventoryTask,
              },
            ]}
          />

          {/* 任务总线聚合实证位：在途件计数透出 */}
          <SkNote>{skc('sk.busPending', { n: busTasks.length })}</SkNote>

          {/* dayfoot 班结行 */}
          <SkDayFoot text={skc('sk.dayFoot')} />
        </>
      )}

      {toastEl}

      <Suspense fallback={null}>
        <QrScanner
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onCheckedIn={(r) => {
            setScanOpen(false);
            showToast('核销成功');
            navigate(r.nextRoute);
          }}
        />
      </Suspense>

      {/* dock 四槽冻结「工位/预约/打卡/我的」（data-testid=staff-dock 组件内置） */}
      <SkDock active="work" />
    </div>
  );
}
