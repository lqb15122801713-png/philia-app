/**
 * 预约·当天 /schedule（S-02 · 员工端骨架整建批片 1 结构组）+ 切日态（S-12，非独立页面）
 *
 * 依据=UX 语言包 V1.1 §三 S-02/S-12 逐屏骨架：
 * apphead → G1 日期切换（昨天/今天/明天/日历）→ 今日胶囊 clockrow（mono 当前时刻+班次，仅当天）→
 * S3 班轴（当天预约按时刻排 SkApptCard 列：state=done/now/future；相邻单间隔 >60min 插
 * dg-gap 虚线框（sk.apptGap {n}）；空天=SkEmpty sk.apptEmpty）→ 明日注（sk.apptTomorrowNote {n}）。
 * 切到过去日期=S-12 态：班轴全 done + SkDayFoot 班结行（历史单唯一入口，/history 已重定向来此）。
 *
 * 片2-员工服务（产品-1015 换皮）S-02 官方三态写死（READY 202:2 / 202:137 / 202:272）：
 * - 全薄：无服务中单 → 全列薄行；待接（今日 confirmed 洗护单）薄行行内带「开始执行」pill，
 *   点开始才进服务中（/execute/:id 既有入口；未核销由执行页既有引导承接）；
 * - 半展=dock 默认：服务中卡默认半展（当前步摘要+进度+「继续执行」主钮）；
 * - 全展：caret 切全展=六步只读全表（serviceStep.list）；
 * - 互斥：同时仅一单服务中——有在途单时其余待接「开始」停用（灰态）；
 *   已完成/待接保持薄行，仅服务中卡可展。
 *
 * 数据：appointment.listForStaff（from/to 闭区间，员工视界=本店且指派本人，原 HistoryPage 同口径）
 * + auth.me（本人排班，clockrow 班次段）+ serviceStep.list（服务中卡六步只读展开，ExecutePage 同接口）。
 * 纯预约零噪音：无统计/无提成/无导出；功能零回退（执行入口/接口不动）。
 */

import { Skeleton, getStepDef, useMe, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SkAppHead,
  SkApptCard,
  SkBtnAction,
  SkChips,
  SkClockRow,
  SkDayFoot,
  SkEmpty,
  SkNote,
  SkOpList,
  SkOpStep,
} from '@/components/skeleton';
import { dayKeyOf, fenToYuan, hhmm, pad2, weekdayLabel, type HistoryItem } from '@/components/today/utils';
import { HISTORY_COPY } from '@/copy/history';
import { skc } from '@/copy/skeleton';

type Schedule = Partial<Record<string, Array<{ start: string; end: string }> | null>>;

/** 本地 YYYY-MM-DD */
const dateStr = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
/** 本地日界（00:00:00.000 起 / 23:59:59.999 止） */
const dayStartOf = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayEndOf = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
/** 整日差（b - a，按本地午夜对齐） */
const dayDiff = (a: Date, b: Date): number =>
  Math.round((dayStartOf(b).getTime() - dayStartOf(a).getTime()) / 86_400_000);

const hc = (key: keyof typeof HISTORY_COPY, vars?: Record<string, string | number>): string => {
  const tpl: string = HISTORY_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
};

/** 班轴卡三态 + 状态签（切日=S-12 全 done；取消/完成恒 done） */
function cardState(
  item: HistoryItem,
  opts: { isToday: boolean; isPast: boolean; now: Date },
): { state: 'done' | 'now' | 'future'; label: string } {
  if (item.status === 'cancelled') return { state: 'done', label: hc('history.axis.cancelled') };
  if (item.status === 'completed') return { state: 'done', label: hc('history.axis.done') };
  if (opts.isPast) {
    return {
      state: 'done',
      label:
        item.status === 'in_service'
          ? hc('history.axis.now')
          : item.status === 'in_boarding'
            ? hc('history.axis.boarding')
            : item.status === 'confirmed'
              ? hc('history.axis.confirmed')
              : item.status === 'pending'
                ? hc('history.axis.pending')
                : hc('history.axis.done'),
    };
  }
  if (item.status === 'in_service') return { state: 'now', label: hc('history.axis.now') };
  if (item.status === 'in_boarding') return { state: 'now', label: hc('history.axis.boarding') };
  if (opts.isToday && item.scheduledEnd.getTime() < opts.now.getTime()) {
    return {
      state: 'done',
      label: item.status === 'confirmed' ? hc('history.axis.confirmed') : item.status === 'pending' ? hc('history.axis.pending') : hc('history.axis.done'),
    };
  }
  return {
    state: 'future',
    label: item.status === 'confirmed' ? hc('history.axis.confirmed') : item.status === 'pending' ? hc('history.axis.pending') : hc('history.axis.future'),
  };
}

/** 服务中卡展开区（S-02 三态：half=当前步摘要+继续执行主钮；full=同条+六步只读全表。
 *  执行入口=主钮/点卡进 /execute/:id 既有链路；六步数据=serviceStep.list 同 ExecutePage） */
function ApptNowPanel({ appointmentId, full }: { appointmentId: string; full: boolean }) {
  const { trpc } = usePhiliaClient();
  const navigate = useNavigate();
  const stepsQuery = useQuery({
    queryKey: ['serviceStep', 'list', appointmentId],
    queryFn: () => trpc.serviceStep.list.query({ appointmentId }),
  });
  const steps = useMemo(() => stepsQuery.data ?? [], [stepsQuery.data]);
  const doneCount = steps.filter((s) => s.status === 'done').length;
  // 六步标签=SERVICE_STEPS 全称（成稿 198:15 新标口径；StepKeyLabel 短标不用）
  const activeName = steps.find((s) => s.status === 'active')
    ? (getStepDef(steps.find((s) => s.status === 'active')!.stepKey)?.name ?? steps.find((s) => s.status === 'active')!.stepKey)
    : null;
  return (
    <>
      {/* 半展摘要条（dock 默认态） */}
      <div className="sk-half" data-testid="sk-aphalf">
        <div className="row">
          <span className="cur">
            {activeName ? `${skc('sk.stepNow')} · ${activeName}` : skc('sk.stepNow')}
          </span>
          <span className="cnt">
            {stepsQuery.isPending ? '…' : skc('sk.workCount', { done: doneCount, total: steps.length || 6 })}
          </span>
        </div>
        <SkBtnAction
          testId={`appt-continue-${appointmentId}`}
          onClick={() => navigate(`/execute/${appointmentId}`)}
        >
          {skc('sk.workCta')}
        </SkBtnAction>
      </div>
      {/* 全展追加：六步只读全表 */}
      {full && steps.length > 0 ? (
        <SkOpList>
          {steps.map((s) => {
            const state = s.status === 'done' ? 'done' : s.status === 'active' ? 'now' : 'future';
            return (
              <SkOpStep
                key={s.stepKey}
                name={getStepDef(s.stepKey)?.name ?? s.stepKey}
                state={state}
                stateText={state === 'done' ? skc('sk.stepDone') : state === 'now' ? skc('sk.stepNow') : skc('sk.stepTodo')}
              />
            );
          })}
        </SkOpList>
      ) : null}
    </>
  );
}

export default function SchedulePage() {
  const { trpc } = usePhiliaClient();
  const navigate = useNavigate();
  const { user } = useMe();
  const isFrontdesk = user?.staffRole === 'frontdesk';

  /* ---- G1 日期切换：picked=本地 YYYY-MM-DD；chips 仅昨天/今天/明天，日历任意日 ---- */
  const today = useMemo(() => new Date(), []);
  const [picked, setPicked] = useState(() => dateStr(today));
  const pickedDate = useMemo(() => new Date(`${picked}T00:00:00`), [picked]);
  const offset = dayDiff(today, pickedDate);
  const chipValue = offset === -1 ? 'yesterday' : offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : 'pick';
  const isToday = offset === 0;
  const isPast = offset < 0;

  /* ---- 今日胶囊真实时钟（30s 自刷） ---- */
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [isToday]);

  /* ---- 班轴数据：所选日闭区间（listForStaff 员工视界=本店且指派本人） ---- */
  const from = useMemo(() => dayStartOf(pickedDate), [pickedDate]);
  const to = useMemo(() => dayEndOf(pickedDate), [pickedDate]);
  const listQuery = useQuery({
    queryKey: ['appointment', 'listForStaff', { from: from.getTime(), to: to.getTime() }],
    queryFn: () => trpc.appointment.listForStaff.query({ from, to }),
    refetchInterval: 60_000,
  });
  const items = useMemo(
    () => [...(listQuery.data ?? [])].sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime()),
    [listQuery.data],
  );

  /* ---- 明日注：仅当天态拉明日单数 ---- */
  const tomorrowQuery = useQuery({
    queryKey: ['appointment', 'listForStaff', { from: from.getTime() + 86_400_000, to: to.getTime() + 86_400_000 }],
    queryFn: () =>
      trpc.appointment.listForStaff.query({
        from: new Date(from.getTime() + 86_400_000),
        to: new Date(to.getTime() + 86_400_000),
      }),
    enabled: isToday,
    staleTime: 60_000,
  });

  /* ---- 本人排班（clockrow 班次段；auth.me 周模板，MePage 同口径） ---- */
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'staffDetail'],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  });
  const schedule = meQuery.data?.staff?.schedule as Schedule | null | undefined;
  const todayShifts = schedule?.[dayKeyOf(today)] ?? [];
  const clockText = `${hhmm(now)} · ${
    todayShifts.length
      ? hc('history.clock.shift', { range: todayShifts.map((s) => `${s.start}–${s.end}`).join(' / ') })
      : hc('history.clock.noShift')
  }`;

  /* ---- S-02 官方三态（202:2 全薄 / 202:137 半展=dock 默认 / 202:272 全展）：
     服务中卡=dock 默认半展（caret 切全展=六步只读全表）；待接（confirmed）薄行带「开始执行」pill——
     点「开始」才进服务中（/execute/:id 既有入口，未核销走既有引导）；互斥=同时仅一单服务中
     （有在途单时其余待接 pill 停用灰态）；已完成/待接保持薄行，仅服务中卡可展 ---- */
  const inServiceId = isToday ? (items.find((i) => i.status === 'in_service')?.id ?? null) : null;
  const [fullId, setFullId] = useState<string | null>(null);

  /* ---- 班轴行（含空档虚线框：相邻单间隔 >60min 才插） ---- */
  const axisRows = useMemo(() => {
    const rows: Array<
      | { kind: 'gap'; key: string; minutes: number }
      | { kind: 'appt'; key: string; item: HistoryItem; state: 'done' | 'now' | 'future'; label: string }
    > = [];
    let prevEnd: Date | null = null;
    for (const item of items) {
      if (prevEnd) {
        const gapMin = Math.round((item.scheduledStart.getTime() - prevEnd.getTime()) / 60_000);
        if (gapMin > 60) rows.push({ kind: 'gap', key: `gap-${item.id}`, minutes: gapMin });
      }
      const cs = cardState(item, { isToday, isPast, now });
      rows.push({ kind: 'appt', key: item.id, item, state: cs.state, label: cs.label });
      prevEnd = item.scheduledEnd;
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, isToday, isPast, now]);

  const subOf = (item: HistoryItem): string => {
    const durationMin = Math.max(0, Math.round((item.scheduledEnd.getTime() - item.scheduledStart.getTime()) / 60_000));
    const dur =
      item.type === 'boarding'
        ? hc('history.axis.nights', { n: Math.max(1, Math.round(durationMin / 1440)) })
        : hc('history.axis.minutes', { n: durationMin });
    const price = item.status === 'cancelled' ? '—' : fenToYuan(item.priceFen);
    const rating = item.status === 'completed' && item.rating !== null ? ` · ${hc('history.axis.rating', { n: item.rating.toFixed(1) })}` : '';
    return `${hhmm(item.scheduledStart)}–${hhmm(item.scheduledEnd)} · ${dur} · ${price}${rating}`;
  };

  return (
    <div className="sk" data-testid="sk-schedule">
      <SkAppHead title={skc('sk.apptTitle')} no={skc('sk.apptNo')} />

      {/* G1 日期切换（昨天/今天/明天 + 日历 chip 任意日；切过去=历史单唯一入口） */}
      <SkChips
        testId="sk-daychip"
        value={chipValue}
        onChange={(k) => {
          const d = new Date(today);
          d.setDate(d.getDate() + (k === 'yesterday' ? -1 : k === 'tomorrow' ? 1 : 0));
          setPicked(dateStr(d));
        }}
        options={[
          { key: 'yesterday', label: skc('sk.yesterday') },
          { key: 'today', label: skc('sk.today') },
          { key: 'tomorrow', label: skc('sk.tomorrow') },
        ]}
        trailing={
          <input
            type="date"
            aria-label={skc('sk.pickDate')}
            data-testid="sk-datepick"
            className={`sk-chip sk-mono${chipValue === 'pick' ? ' on' : ''}`}
            style={{ width: 148, colorScheme: chipValue === 'pick' ? 'dark' : 'light' }}
            value={picked}
            onChange={(e) => {
              if (e.target.value) setPicked(e.target.value);
            }}
          />
        }
      />

      {/* 今日胶囊（mono 当前时刻+班次，仅当天态） */}
      {isToday ? <SkClockRow text={clockText} /> : null}

      {/* S3 班轴 */}
      {listQuery.isPending ? (
        <div className="sk-daygrid" aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="mb-2.5 h-16 !rounded-[16px]" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <div className="sk-empty">
          <p>{hc('history.loadFailed')}</p>
          <button type="button" className="sk-btn-ghost" style={{ marginTop: 10 }} onClick={() => void listQuery.refetch()}>
            重新加载
          </button>
        </div>
      ) : items.length === 0 ? (
        <SkEmpty title={skc('sk.apptEmpty')} />
      ) : (
        <div className="sk-daygrid" data-testid="sk-daygrid">
          {axisRows.map((row) =>
            row.kind === 'gap' ? (
              <div className="dg" key={row.key}>
                <div className="dg-time sk-mono" />
                <div className="dg-rail">
                  <div className="dg-gap" data-testid={row.key}>
                    {skc('sk.apptGap', { n: row.minutes })}
                  </div>
                </div>
              </div>
            ) : (
              <div
                key={row.key}
                onClick={
                  row.state === 'now' && row.item.status === 'in_service'
                    ? (e) => {
                        if ((e.target as HTMLElement).closest('.caret')) return;
                        navigate(`/execute/${row.item.id}`);
                      }
                    : undefined
                }
                style={row.state === 'now' && row.item.status === 'in_service' ? { cursor: 'pointer' } : undefined}
              >
                <SkApptCard
                  testId={`sk-appt-${row.item.id}`}
                  time={hhmm(row.item.scheduledStart)}
                  title={
                    <>
                      {row.item.petName ?? '宠物'} · {row.item.serviceName ?? '服务'}
                    </>
                  }
                  sub={subOf(row.item)}
                  stateLabel={row.label}
                  state={row.state}
                  level={row.item.id === inServiceId ? (fullId === row.item.id ? 'full' : 'half') : 'thin'}
                  action={
                    !isFrontdesk && isToday && row.item.status === 'confirmed' && row.item.type === 'grooming'
                      ? {
                          label: skc('sk.workCtaStart'),
                          onClick: () => navigate(`/execute/${row.item.id}`),
                          disabled: inServiceId !== null,
                          testId: `appt-start-${row.item.id}`,
                        }
                      : undefined
                  }
                  onToggleLevel={
                    row.item.id === inServiceId
                      ? () => setFullId((v) => (v === row.item.id ? null : row.item.id))
                      : undefined
                  }
                >
                  {row.item.id === inServiceId ? (
                    <ApptNowPanel appointmentId={row.item.id} full={fullId === row.item.id} />
                  ) : null}
                </SkApptCard>
              </div>
            ),
          )}
        </div>
      )}

      {/* 明日注（仅当天态） */}
      {isToday && !listQuery.isPending && !listQuery.isError ? (
        <SkNote>{skc('sk.apptTomorrowNote', { n: tomorrowQuery.data?.length ?? 0 })}</SkNote>
      ) : null}

      {/* S-12 切日态：班结行 */}
      {isPast && !listQuery.isPending && !listQuery.isError && items.length > 0 ? (
        <SkDayFoot
          text={hc('history.dayFoot.past', { date: `${pickedDate.getMonth() + 1}月${pickedDate.getDate()}日 ${weekdayLabel(pickedDate)}`, n: items.length })}
        />
      ) : null}

      <SkNote>{skc('sk.apptHistoryNote')}</SkNote>
    </div>
  );
}
