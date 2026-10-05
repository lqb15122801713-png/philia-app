/**
 * 寄养管理 /boarding（W-05 · 片 5 段 1 校形）
 *
 * 区块序（UX-02 语言包 §四 W-05）：M3 四格（在店/今日入住/今日退房/超期红）
 * → 房型卡行（现状保留：房名+单晚价+占用 N/间数+在店名·晚数）
 * → M5 在店台账（现状 u3-tbl 表保留 + 选中详情侧栏交互保留）
 * → M7 容量日历（WCapCal 首用：月格按日容量态 ok/tight/full/off——数据源=
 *   store.boardingAvailability 月窗逐晚 remaining（≤31 晚硬闸内），容量=在架
 *   房型 roomCount 合计、已住=capacity−remaining（预订口径，与 M3 在店口径
 *   不同源，注记明面））
 * → 疫苗硬规则置灰注（现状口径透出：员工端入住页透出疫苗有效期，过期不可
 *   入住的置灰拦截以员工端为准）。
 *
 * 数据（全现成，零新接口）：
 * - boarding.stayBoard（merchant 本店在店看板：stay+appointment+pet+customer
 *   +lastLogDate+overdue）——在店表与占用聚合的数据源；
 * - store.boardingAvailability（public，入参 {storeId, from, to}）——今晚 1 晚窗
 *   给在架房型 serviceId 与 roomCount（房型卡）；本月整月窗给容量日历逐晚剩余；
 * - store.getWithServices（public）——房型名与单晚价（boardingAvailability
 *   不回 name/priceFen，两接口按 serviceId 拼合）。
 * 「今日打卡」= lastLogDate === 今日（YYYY-MM-DD 本地日界）；
 * 「今日退房」= scheduledEnd 日历日 = 今天；「今日入住」= stay.createdAt 日历日 = 今天。
 *
 * 柠檬钮真实落点说明：入住登记链路在员工端（boarding.checkinStay 为
 * staffProcedure，商家端不可办；零新接口红线）——点击仅 toast 指引，不做假表单。
 *
 * SSE（store:{storeId} 频道，staff-admin useMerchantEvents 单页接线保留）：
 * boarding.daily_update / boarding.completed / boarding.overdue /
 * appointment.checkedin / appointment.cancelled → toast + invalidate 看板；
 * 断线重连全量对齐。退房无商家端入口（checkout=staffProcedure，不造按钮）。
 */

import { EventType, Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import MainScaffold, { LemonButton, QuietButton } from '../components/MainScaffold';
import { WCapCal, type WCapCalDay } from '../components/skeleton';
import BoardingStayRow from '../components/staff-admin/BoardingStayCard';
import BoardingStayDetail from '../components/staff-admin/BoardingStayDetail';
import { useMerchantEvents } from '../components/staff-admin/useMerchantEvents';
import type { StayBoardRow } from '../components/staff-admin/types';
import { bc } from '../copy/boarding';

/** 单晚价：分 → ¥ 整数优先（¥199），带零头才给两位小数（¥199.50）；≥6 位分组（仅展示层） */
const fmtNightPrice = (fen: number): string =>
  fen % 100 === 0
    ? `¥${(fen / 100).toLocaleString('en-US')}`
    : `¥${(fen / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** 今日 YYYY-MM-DD（本地日界，与 lastLogDate 同口径比较） */
const todayIso = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** 是否本地日历日「今天」 */
const isToday = (d: Date): boolean => {
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
};

/* ---- 晚数口径（与服务端 boardingNightDates 同：本地日历日差） ---- */
const DAY_MS = 24 * 3600 * 1000;
const dayStartMs = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const dayDiff = (a: Date, b: Date) => Math.round((dayStartMs(a) - dayStartMs(b)) / DAY_MS);
/** 总晚数 M（scheduledStart → scheduledEnd，至少 1 晚） */
const stayTotalNights = (row: StayBoardRow) =>
  Math.max(1, dayDiff(row.appointment.scheduledEnd, row.appointment.scheduledStart));
/** 当前第几晚 D（按今天，夹取 [1, M]） */
const stayCurrentNight = (row: StayBoardRow) =>
  Math.min(Math.max(dayDiff(new Date(), row.appointment.scheduledStart) + 1, 1), stayTotalNights(row));
/** 超期天数（今天 − 退房日，展示夹到 ≥1；超期真值以 row.overdue 为准） */
const stayOverdueDays = (row: StayBoardRow) =>
  Math.max(1, dayDiff(new Date(), row.appointment.scheduledEnd));

export default function BoardingPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const boardQuery = useQuery({
    queryKey: ['boarding', 'stayBoard'],
    queryFn: () => trpc.boarding.stayBoard.query(),
  });
  const meQuery = useQuery({ queryKey: ['auth', 'me', 'full'], queryFn: () => trpc.auth.me.query() });
  const storeId = meQuery.data?.store?.id ?? null;

  // 房型与 roomCount：boardingAvailability 今晚 1 晚（区间上限 31 晚，取最小窗即可）
  const nightWindow = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  }, []);
  const availQuery = useQuery({
    queryKey: ['store', 'boardingAvailability', storeId],
    queryFn: () =>
      trpc.store.boardingAvailability.query({ storeId: storeId!, ...nightWindow }),
    enabled: !!storeId,
  });
  // 房型名/单晚价：getWithServices 的 active 服务行（与 availability 按 serviceId 拼）
  const servicesQuery = useQuery({
    queryKey: ['store', 'getWithServices', storeId],
    queryFn: () => trpc.store.getWithServices.query({ storeId: storeId! }),
    enabled: !!storeId,
  });

  // M7 容量日历：本月整月窗（首日至次月首日，晚数=当月天数 ≤31，接口硬闸内）
  const calWindow = useMemo(() => {
    const n = new Date();
    return {
      from: new Date(n.getFullYear(), n.getMonth(), 1),
      to: new Date(n.getFullYear(), n.getMonth() + 1, 1),
    };
  }, []);
  const calQuery = useQuery({
    queryKey: ['store', 'boardingAvailability', 'capcal', storeId, calWindow.from.toISOString()],
    queryFn: () => trpc.store.boardingAvailability.query({ storeId: storeId!, ...calWindow }),
    enabled: !!storeId,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const today = useMemo(() => todayIso(), []);

  const invalidateBoard = () =>
    void queryClient.invalidateQueries({ queryKey: ['boarding', 'stayBoard'] });

  // SSE：寄养相关事件 → 看板对齐（断线重连时全量对齐一次）
  useMerchantEvents({
    onEvent: (env) => {
      if (env.type === EventType.BoardingDailyUpdate) {
        const petName = (env.data as { petName?: string })?.petName;
        toast(petName ? `「${petName}」有新的寄养打卡` : '有新的寄养打卡');
        invalidateBoard();
      } else if (
        env.type === EventType.BoardingCompleted ||
        env.type === EventType.AppointmentCheckedIn ||
        env.type === EventType.AppointmentCancelled
      ) {
        invalidateBoard();
      } else if (env.type === EventType.BoardingOverdue) {
        toast.error('有寄养单已超期，请及时处理');
        invalidateBoard();
      }
    },
    onReconnect: invalidateBoard,
  });

  const board = useMemo(() => (boardQuery.data?.board ?? []) as StayBoardRow[], [boardQuery.data]);
  // 在店表按退房日升序（超期/今日退房自然排前）
  const sorted = useMemo(
    () =>
      [...board].sort(
        (a, b) => a.appointment.scheduledEnd.getTime() - b.appointment.scheduledEnd.getTime(),
      ),
    [board],
  );

  // 房型卡：availability 给 serviceId+roomCount，getWithServices 给 name/priceFen，
  // 占用 = stayBoard 按 appointment.serviceId 聚合（在店真值，非预订口径）
  const rooms = useMemo(() => {
    const svcMeta = new Map(
      (servicesQuery.data?.services ?? [])
        .filter((s) => s.type === 'boarding')
        .map((s) => [s.id, { name: s.name, priceFen: s.priceFen }] as const),
    );
    return (availQuery.data?.services ?? []).map((a) => ({
      serviceId: a.serviceId,
      name: svcMeta.get(a.serviceId)?.name ?? '寄养房',
      priceFen: svcMeta.get(a.serviceId)?.priceFen ?? 0,
      roomCount: a.roomCount,
      stays: board.filter((r) => r.appointment.serviceId === a.serviceId),
    }));
  }, [availQuery.data, servicesQuery.data, board]);
  const roomNameOf = useMemo(
    () => new Map(rooms.map((r) => [r.serviceId, r.name] as const)),
    [rooms],
  );

  // 选中行退房/消失后 selected 自然落空为 null（详情栏回占位态）；
  // selectedId 残留无副作用（id 不复用），无需 effect 清理
  const selected = useMemo(
    () => board.find((r) => r.stay.id === selectedId) ?? null,
    [board, selectedId],
  );

  const checkoutToday = useMemo(
    () => board.filter((r) => isToday(r.appointment.scheduledEnd)).length,
    [board],
  );
  const unloggedToday = useMemo(
    () => board.filter((r) => r.lastLogDate !== today).length,
    [board, today],
  );

  /* M3 四格派生：今日入住=stay.createdAt 日历日（入住登记真值）；超期=overdue 真值 */
  const checkinToday = useMemo(
    () => board.filter((r) => isToday(r.stay.createdAt)).length,
    [board],
  );
  const overdueCount = useMemo(() => board.filter((r) => r.overdue).length, [board]);

  /* M7 容量日历格：周一起手补位 + 逐日容量态（算法：容量=在架房型 roomCount 合计；
     已住=Σ(roomCount−remaining[d])，口径=boardingAvailability 预订槽位；
     满=已住≥容量，紧=已住/容量≥75%，余=ok；无在架房型/读口未回=off 置灰不造假） */
  const calDays = useMemo<WCapCalDay[]>(() => {
    const y = calWindow.from.getFullYear();
    const m = calWindow.from.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const leadPad = (new Date(y, m, 1).getDay() + 6) % 7; // 周一=0
    const cells: WCapCalDay[] = Array.from({ length: leadPad }, () => ({ day: null }));
    const services = calQuery.data?.services;
    const capacity = (services ?? []).reduce((s, x) => s + x.roomCount, 0);
    for (let d = 1; d <= daysInMonth; d += 1) {
      let state: WCapCalDay['state'] = 'off';
      if (services && capacity > 0) {
        const occupied = services.reduce(
          (s, x) => s + (x.roomCount - (x.remaining[d - 1] ?? x.roomCount)),
          0,
        );
        state = occupied >= capacity ? 'full' : occupied / capacity >= 0.75 ? 'tight' : 'ok';
      }
      cells.push({ day: d, state });
    }
    return cells;
  }, [calWindow, calQuery.data]);
  const calMonthLabel = `${calWindow.from.getFullYear()}年${calWindow.from.getMonth() + 1}月`;

  const roomsLoading =
    (availQuery.isPending || servicesQuery.isPending) && !!storeId;

  return (
    <MainScaffold
      title={bc('board.title')}
      sub={bc('board.sub', { a: board.length, b: checkoutToday, c: unloggedToday })}
      actions={
        <LemonButton
          testid="boarding-checkin-entry"
          onClick={() => toast(bc('board.checkinGuide'))}
        >
          {bc('board.checkinCta')}
        </LemonButton>
      }
      testid="boarding-page"
    >
      <div className="wsk">
        {/* M3 四格（在店/今日入住/今日退房/超期红）——永远第一屏第一位 */}
        <div className="mb-[18px] grid grid-cols-2 gap-3.5 lg:grid-cols-4" data-testid="board-m3">
          {boardQuery.isPending ? (
            [0, 1, 2, 3].map((i) => (
              <div className="wsk-card" key={i}>
                <Skeleton className="h-3 w-14" />
                <Skeleton className="mt-2.5 h-7 w-10" />
              </div>
            ))
          ) : (
            [
              { key: 'inStore', label: bc('board.m3InStore'), value: board.length, red: false },
              { key: 'checkin', label: bc('board.m3Checkin'), value: checkinToday, red: false },
              { key: 'checkout', label: bc('board.m3Checkout'), value: checkoutToday, red: false },
              { key: 'overdue', label: bc('board.m3Overdue'), value: overdueCount, red: overdueCount > 0 },
            ].map((q) => (
              <div className="wsk-card" key={q.key} data-testid={`board-m3-${q.key}`}>
                <div className="text-[11px] font-semibold text-[rgba(59,46,36,.42)]">{q.label}</div>
                <div
                  className={`mt-1.5 font-number text-[26px] font-bold leading-8 tabular-nums${
                    q.red ? ' text-[#B4502E]' : ''
                  }`}
                >
                  {q.value}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 房型卡行（.room 同工艺：纸面+ring+圆角 20，占用 Montserrat 20【试样所印 22 越字阶闸门，U4 映射】） */}
      {roomsLoading ? (
        /* 加载中骨架块（animate-pulse，禁转圈）：房型卡 = shared Skeleton 组合（底色归一 bg-sunken） */
        <div className="mb-[18px] grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-panel bg-[#FFFDF6] p-[15px_17px] shadow-[0_0_0_1px_rgba(59,46,36,.09)]"
            >
              <Skeleton className="h-3 w-24 rounded-chip" />
              <Skeleton className="mt-2.5 h-6 w-16 rounded-chip" />
              <Skeleton className="mt-2.5 h-3 w-28 rounded-chip" />
            </div>
          ))}
        </div>
      ) : rooms.length > 0 ? (
        <div className="mb-[18px] grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {rooms.map((r) => (
            <div
              key={r.serviceId}
              className="rounded-panel bg-[#FFFDF6] p-[15px_17px] shadow-[0_0_0_1px_rgba(59,46,36,.09)]"
            >
              <div className="text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
                {r.name} ·{' '}
                <span className="font-number tabular-nums">{fmtNightPrice(r.priceFen)}</span>/晚
              </div>
              <div className="mt-1.5 font-number text-title-lg font-bold leading-7 tabular-nums">
                {r.stays.length}
                <small className="text-caption font-semibold text-[rgba(59,46,36,.42)]">
                  /{r.roomCount} 间
                </small>
              </div>
              <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.62)]">
                {r.stays.length === 0
                  ? bc('board.roomVacant')
                  : r.stays.map((s, i) => (
                      <span key={s.stay.id}>
                        {i > 0 ? ' · ' : ''}
                        {s.pet.name}{' '}
                        {s.overdue ? (
                          <b className="font-number tabular-nums text-danger">
                            超期 {stayOverdueDays(s)} 天
                          </b>
                        ) : (
                          <span className="font-number tabular-nums">D{stayCurrentNight(s)}</span>
                        )}
                      </span>
                    ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-4">
        {/* 在店表 */}
        <div className="u3-panel">
          <div className="u3-panel-head">
            <h3>在店寄养</h3>
            <span className="aside">{bc('board.panelAside')}</span>
          </div>
          {boardQuery.isPending ? (
            /* 加载中骨架块（animate-pulse，禁转圈）：在店表行 = shared Skeleton 组合 */
            <div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-6 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3.5"
                >
                  <Skeleton className="h-3.5 w-28 rounded-chip" />
                  <Skeleton className="h-3.5 w-16 rounded-chip" />
                  <Skeleton className="h-3.5 w-24 rounded-chip" />
                  <Skeleton className="h-3.5 w-14 rounded-chip" />
                  <Skeleton className="ml-auto h-3.5 w-20 rounded-chip" />
                </div>
              ))}
            </div>
          ) : boardQuery.isError ? (
            <div className="px-[17px] py-10 text-center">
              <div className="text-caption text-[rgba(59,46,36,.62)]">寄养看板加载失败</div>
              <div className="mt-3 flex justify-center">
                <QuietButton onClick={() => void boardQuery.refetch()}>重试</QuietButton>
              </div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-14 text-center">
              <div className="text-body-sm font-semibold text-[rgba(59,46,36,.62)]">
                {bc('board.emptyTitle')}
              </div>
              <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.42)]">
                {bc('board.emptyBody')}
              </div>
            </div>
          ) : (
            <div className="u3-noscrollx overflow-x-auto">
              <table className="u3-tbl min-w-[720px]">
                <thead>
                  <tr>
                    <th>宠物</th>
                    <th>房型</th>
                    <th className="text-right">入住 → 退房</th>
                    <th className="text-right">进度</th>
                    <th>今日打卡</th>
                    <th>状态</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <BoardingStayRow
                      key={row.stay.id}
                      row={row}
                      roomName={roomNameOf.get(row.appointment.serviceId) ?? null}
                      todayIso={today}
                      nightIndex={stayCurrentNight(row)}
                      totalNights={stayTotalNights(row)}
                      overdueDays={stayOverdueDays(row)}
                      selected={selectedId === row.stay.id}
                      onSelect={() => setSelectedId(row.stay.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 详情：lg 右侧栏 */}
        <div className="sticky top-4 hidden max-h-[calc(100vh-6rem)] lg:block">
          {selected ? (
            <BoardingStayDetail row={selected} />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-panel bg-[#FFFDF6] text-caption text-[rgba(59,46,36,.42)] shadow-[0_0_0_1px_rgba(59,46,36,.09)]">
              {bc('board.detailPlaceholder')}
            </div>
          )}
        </div>

        {/* 详情：窄屏选中后下方展开 */}
        {selected ? (
          <div className="mt-3 lg:hidden">
            <BoardingStayDetail row={selected} />
          </div>
        ) : null}
      </div>

      {/* M7 容量日历（WCapCal 首用：月格按日容量态；口径注记明面） */}
      <div className="wsk mt-[18px]">
        {calQuery.isPending && storeId ? (
          <section className="wsk-capcal" aria-label={bc('board.capCalLoading')}>
            <Skeleton className="h-3.5 w-24" />
            <div className="mt-3 grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-[40px] rounded-[10px]" />
              ))}
            </div>
          </section>
        ) : calQuery.isError ? (
          <section className="wsk-card text-center">
            <div className="text-caption text-[rgba(59,46,36,.62)]">{bc('board.capCalError')}</div>
            <div className="mt-3 flex justify-center">
              <QuietButton onClick={() => void calQuery.refetch()}>重试</QuietButton>
            </div>
          </section>
        ) : (
          <WCapCal
            monthLabel={calMonthLabel}
            weekdays={['一', '二', '三', '四', '五', '六', '日']}
            days={calDays}
          />
        )}
        <p className="wsk-note mt-2 px-1">{bc('board.capCalNote')}</p>
        {/* 疫苗硬规则置灰注（现状校验口径透出：硬拦截在员工端入住页） */}
        <p className="wsk-note mt-1 px-1 opacity-70">{bc('board.vaccineNote')}</p>
      </div>
    </MainScaffold>
  );
}
