/**
 * 设置 /settings（U3 批次 · 任务 M · 规格书 §12 · 母本试样 707-752 行 / .set-row/.sw CSS 148-156）
 *
 * 布局：MainScaffold（title 设置 / sub 门店与经营口径·改动即生效）→ 双栏 u3-panel：
 * - 左=门店（set-row 行式，点击展开编辑行）：门店名称 / 营业时间（可约栅格之源，
 *   7 天开关+起止编辑 → store.update openHours）/ 地址与坐标（store.update）/
 *   服务项与时长（时长引擎之母 → upsertService + ServiceEditorDialog）；
 * - 右=经营口径：自动接单（S4 默认开，无开关仅口径展示「已启用」）+
 *   通知偏好三档 sw（薄荷开 / 墨 12% 关 → localStorage philia.merchant.notifyPrefs，
 *   点击即切，仅本机生效，v2 接服务端）。
 *
 * 原四个 Section 的 mutation 全部保留（store.update / store.upsertService），
 * 仅视觉改双栏面板行式。营业时间改动 → 客户端可约栅格联动由服务端栅格引擎自然生效（不动）。
 *
 * 已知服务端缺口（沿用）：getWithServices 只回 active=true 服务项，无「含下架」全量列表
 * 接口——下架项本页在本次会话内以本地 overrides 保持可见（可重新上架），刷新后不再列出。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import MainScaffold, { QuietButton } from '../components/MainScaffold';
import ServiceEditorDialog from '../components/staff-admin/ServiceEditorDialog';
import { errMsg, fmtMoney } from '../components/staff-admin/format';
import {
  DAY_KEYS,
  DAY_LABEL,
  DAY_SHORT,
  type DayKey,
  type OpenHoursLike,
  type ServiceRow,
} from '../components/staff-admin/types';
import { Empty, Field, inputCls, numStyle, Switch, toast, ToasterMount } from '../components/staff-admin/ui';

/* ------------------------------------------------------------------ */
/* 营业时间                                                             */
/* ------------------------------------------------------------------ */

interface DayHours {
  on: boolean;
  open: string;
  close: string;
}
type WeekHours = Record<DayKey, DayHours>;

function toWeekHours(openHours: OpenHoursLike | null | undefined): WeekHours {
  const out = {} as WeekHours;
  for (const k of DAY_KEYS) {
    const r = openHours?.[k];
    out[k] = r ? { on: true, open: r.open, close: r.close } : { on: false, open: '09:00', close: '21:00' };
  }
  return out;
}

/** 连续日压缩（与员工页同口径：run ≥3 →「一至五」，短 run →「六/日」） */
function compressDays(days: DayKey[]): string {
  const runs: DayKey[][] = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && DAY_KEYS.indexOf(d) === DAY_KEYS.indexOf(last[last.length - 1]) + 1) {
      last.push(d);
    } else {
      runs.push([d]);
    }
  }
  return runs
    .map((r) =>
      r.length >= 3
        ? `${DAY_SHORT[r[0]]}至${DAY_SHORT[r[r.length - 1]]}`
        : r.map((k) => DAY_SHORT[k]).join('/'),
    )
    .join('/');
}

/** 营业时间行摘要：七天同时段 →「周一至周日 09:00–20:00」；否则按营业天数概括 */
function hoursSummary(hours: WeekHours): string {
  const on = DAY_KEYS.filter((k) => hours[k].on);
  if (on.length === 0) return '七天均店休';
  const uniform = on.every((k) => hours[k].open === hours[on[0]].open && hours[k].close === hours[on[0]].close);
  if (uniform) return `${compressDays(on)} ${hours[on[0]].open}–${hours[on[0]].close}`;
  return `${on.length} 天营业 · 时段逐日不同`;
}

/* ------------------------------------------------------------------ */
/* 推送通知偏好（本地占位 · v2 接服务端）                                */
/* ------------------------------------------------------------------ */

const NOTIFY_KEY = 'philia.merchant.notifyPrefs';
interface NotifyPrefs {
  newAppointment: boolean;
  cancelRequest: boolean;
  boardingOverdue: boolean;
}
/** U3 口径（试样 12 设置）：新预约/取消申请默认开；寄养打卡提醒默认关 */
const NOTIFY_ITEMS: Array<{ key: keyof NotifyPrefs; label: string; hint: string }> = [
  { key: 'newAppointment', label: '新预约通知', hint: 'SSE store 频道 · 声音提醒' },
  { key: 'cancelRequest', label: '取消申请提醒', hint: '≤4h 申请需审批' },
  { key: 'boardingOverdue', label: '寄养打卡提醒', hint: '每日 16:00 未打卡提醒员工' },
];

function loadNotifyPrefs(): NotifyPrefs {
  try {
    const raw = window.localStorage.getItem(NOTIFY_KEY);
    if (raw) return { newAppointment: true, cancelRequest: true, boardingOverdue: false, ...JSON.parse(raw) };
  } catch {
    /* localStorage 不可用时用默认值 */
  }
  return { newAppointment: true, cancelRequest: true, boardingOverdue: false };
}

/* ------------------------------------------------------------------ */
/* set-row 行（试样 .set-row：label+small 左，值/开关右，墨 6% 顶线）     */
/* ------------------------------------------------------------------ */

function SetRow({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-[rgba(74,59,46,.06)] px-[17px] py-[13px] text-caption">
      <div className="min-w-0 flex-1">
        <div className="text-ink">{title}</div>
        {hint ? <div className="mt-[2px] text-caption-xs text-[rgba(74,59,46,.42)]">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** 可展开行：右侧动作签（试样 .set-row .vl 口径：编辑 › / 管理 ›）点击后在行下展开编辑区 */
function ExpandRow({
  title,
  hint,
  value,
  open,
  onToggle,
  actionLabel = '编辑 ›',
  children,
}: {
  title: string;
  hint?: string;
  value?: string;
  open: boolean;
  onToggle: () => void;
  /** 收起前动作签（试样：服务项行=「管理 ›」，其余=「编辑 ›」） */
  actionLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[rgba(74,59,46,.06)]">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-[17px] py-[13px] text-left text-caption transition-colors duration-150 hover:bg-[rgba(74,59,46,.03)]"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="text-ink">{title}</div>
          {hint ? <div className="mt-[2px] text-caption-xs text-[rgba(74,59,46,.42)]">{hint}</div> : null}
        </div>
        <span className="shrink-0 text-caption font-bold text-[rgba(74,59,46,.62)]">
          {value ? <span className="u1-num mr-1.5">{value}</span> : null}
          {open ? '收起 ›' : actionLabel}
        </span>
      </button>
      {open ? <div className="px-[17px] pb-4 pt-1">{children}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const { trpc, queryClient } = usePhiliaClient();

  const meQuery = useQuery({ queryKey: ['auth', 'me', 'full'], queryFn: () => trpc.auth.me.query() });
  const store = meQuery.data?.store ?? null;
  const storeId = store?.id ?? null;

  const servicesQuery = useQuery({
    queryKey: ['store', 'getWithServices', storeId],
    queryFn: () => trpc.store.getWithServices.query({ storeId: storeId! }),
    enabled: !!storeId,
  });

  /** 左栏当前展开行（一次只开一行，行式面板保持紧凑） */
  const [openRow, setOpenRow] = useState<'name' | 'hours' | 'addr' | 'services' | null>(null);
  const toggleRow = (k: 'name' | 'hours' | 'addr' | 'services') =>
    setOpenRow((cur) => (cur === k ? null : k));

  /* ---------------- 门店信息表单（name 与地址坐标分两行保存，同一 store.update 链路） ---------------- */
  const [info, setInfo] = useState({ name: '', address: '', lat: '', lng: '' });
  const [infoPending, setInfoPending] = useState(false);

  /* ---------------- 营业时间 ---------------- */
  const [hours, setHours] = useState<WeekHours>(() => toWeekHours(null));
  const [hoursPending, setHoursPending] = useState(false);

  // 门店行就绪/切换时在渲染期回填表单（react-hooks v6 口径：不在 effect 里同步 setState；
  // 仅在 storeId 变化时回填，避免保存后输入被覆盖）
  const [backfilledFor, setBackfilledFor] = useState<string | null>(null);
  if (store && store.id !== backfilledFor) {
    setBackfilledFor(store.id);
    setInfo({
      name: store.name ?? '',
      address: store.address ?? '',
      lat: store.lat != null ? String(store.lat) : '',
      lng: store.lng != null ? String(store.lng) : '',
    });
    setHours(toWeekHours(store.openHours as OpenHoursLike | null));
  }

  const saveName = async () => {
    if (!info.name.trim()) {
      toast('门店名称不能为空', 'error');
      return;
    }
    setInfoPending(true);
    try {
      await trpc.store.update.mutate({ name: info.name.trim() });
      toast('门店名称已保存');
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setInfoPending(false);
    }
  };

  const saveAddr = async () => {
    let lat: number | null = null;
    let lng: number | null = null;
    if (info.lat.trim()) {
      lat = Number(info.lat);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        toast('纬度须为 -90 ~ 90 的数字', 'error');
        return;
      }
    }
    if (info.lng.trim()) {
      lng = Number(info.lng);
      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        toast('经度须为 -180 ~ 180 的数字', 'error');
        return;
      }
    }
    setInfoPending(true);
    try {
      await trpc.store.update.mutate({ address: info.address.trim(), lat, lng });
      toast('地址与坐标已保存');
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setInfoPending(false);
    }
  };

  const saveHours = async () => {
    for (const k of DAY_KEYS) {
      const d = hours[k];
      if (d.on && d.open >= d.close) {
        toast(`${DAY_LABEL[k]} 的开门时间须早于关门时间`, 'error');
        return;
      }
    }
    const openHours = {} as Record<DayKey, { open: string; close: string } | null>;
    for (const k of DAY_KEYS) {
      openHours[k] = hours[k].on ? { open: hours[k].open, close: hours[k].close } : null;
    }
    setHoursPending(true);
    try {
      await trpc.store.update.mutate({ openHours });
      toast('营业时间已保存');
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setHoursPending(false);
    }
  };

  /* ---------------- 服务项与定价 ---------------- */
  // 本地 overrides：upsert 返回的行按 id 合并——下架项本次会话内保持可见（缺口见文件头）
  const [overrides, setOverrides] = useState<Map<string, ServiceRow>>(new Map());
  const activeServices = useMemo(
    () => (servicesQuery.data?.services ?? []) as ServiceRow[],
    [servicesQuery.data],
  );
  const serviceList = useMemo(() => {
    const byId = new Map<string, ServiceRow>();
    for (const s of activeServices) byId.set(s.id, overrides.get(s.id) ?? s);
    for (const [id, s] of overrides) if (!byId.has(id)) byId.set(id, s);
    return [...byId.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }, [activeServices, overrides]);

  const [editorFor, setEditorFor] = useState<ServiceRow | null | 'new'>(null);

  const mergeService = (s: ServiceRow) =>
    setOverrides((m) => {
      const next = new Map(m);
      next.set(s.id, s);
      return next;
    });

  const toggleActive = async (row: ServiceRow) => {
    const next = !row.active;
    // 乐观合并，失败回滚由 invalidate 兜底
    mergeService({ ...row, active: next });
    try {
      const r = await trpc.store.upsertService.mutate({
        id: row.id,
        type: row.type as 'grooming' | 'boarding',
        name: row.name,
        durationMin: row.durationMin ?? undefined,
        priceFen: row.priceFen,
        boardingRoomType: row.boardingRoomType ?? undefined,
        active: next,
      });
      mergeService(r.service as ServiceRow);
      toast(next ? `「${row.name}」已上架` : `「${row.name}」已下架`);
      void queryClient.invalidateQueries({ queryKey: ['store', 'getWithServices'] });
    } catch (e) {
      mergeService(row); // 回滚
      toast(errMsg(e), 'error');
    }
  };

  /* ---------------- 推送通知（本地占位） ---------------- */
  const [notify, setNotify] = useState<NotifyPrefs>(loadNotifyPrefs);
  const changeNotify = (k: keyof NotifyPrefs, v: boolean) => {
    const next = { ...notify, [k]: v };
    setNotify(next);
    try {
      window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
    } catch {
      /* 忽略持久化失败 */
    }
  };

  /* ---------------- 渲染 ---------------- */
  return (
    <MainScaffold title="设置" sub="门店与经营口径 · 改动即生效（可约/派单联动）" testid="settings-page">
      <ToasterMount />

      {meQuery.isPending ? (
        // 骨架（禁转圈）：双栏面板脉冲
        <div className="grid items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]" aria-label="加载中">
          {[1.7, 1].map((w, i) => (
            <div key={i} className="u3-panel animate-pulse">
              <div className="u3-panel-head">
                <div className="h-4 w-16 rounded-chip bg-[rgba(74,59,46,.08)]" />
              </div>
              {[0, 1, 2, 3].map((r) => (
                <div key={r} className="border-t border-[rgba(74,59,46,.06)] px-[17px] py-4">
                  <div className="h-3 rounded-chip bg-[rgba(74,59,46,.06)]" style={{ width: `${52 + w * 10 + r * 8}%` }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : !store ? (
        <Empty title="未找到门店信息" hint="请确认当前账号已完成开店绑定" />
      ) : (
        <div className="grid items-start gap-3.5 lg:grid-cols-[1.7fr_1fr]">
          {/* 左栏：门店 */}
          <div className="u3-panel">
            <div className="u3-panel-head">
              <h3>门店</h3>
              <span className="aside">名称 / 营业时间 / 地址 / 服务项</span>
            </div>

            {/* 门店名称 */}
            <ExpandRow
              title="门店名称"
              hint="对外展示"
              value={store.name ?? undefined}
              open={openRow === 'name'}
              onToggle={() => toggleRow('name')}
            >
              <Field label="门店名称">
                <input
                  className={inputCls}
                  value={info.name}
                  maxLength={64}
                  onChange={(e) => setInfo((s) => ({ ...s, name: e.target.value }))}
                />
              </Field>
              <div className="mt-3 flex justify-end">
                <QuietButton disabled={infoPending} onClick={() => void saveName()}>
                  {infoPending ? '保存中…' : '保存'}
                </QuietButton>
              </div>
            </ExpandRow>

            {/* 营业时间（可约栅格之源） */}
            <ExpandRow
              title="营业时间"
              hint={`可约栅格之源（${hoursSummary(hours)}）`}
              open={openRow === 'hours'}
              onToggle={() => toggleRow('hours')}
            >
              <div className="space-y-2">
                {DAY_KEYS.map((k) => {
                  const d = hours[k];
                  return (
                    <div
                      key={k}
                      className="flex items-center justify-between rounded-control bg-canvas px-3 py-2"
                    >
                      <span className="w-12 text-caption font-semibold text-ink">{DAY_LABEL[k]}</span>
                      {d.on ? (
                        <span className="flex items-center gap-2">
                          <input
                            type="time"
                            value={d.open}
                            onChange={(e) => setHours((w) => ({ ...w, [k]: { ...d, open: e.target.value } }))}
                            className="rounded-chip bg-[#FFFDF6] px-2 py-1 text-caption text-ink shadow-hairline ring-1 ring-line-ring focus:outline-none focus:ring-[rgba(74,59,46,.25)]"
                            style={numStyle}
                          />
                          <span className="text-caption-xs text-[rgba(74,59,46,.42)]">至</span>
                          <input
                            type="time"
                            value={d.close}
                            onChange={(e) => setHours((w) => ({ ...w, [k]: { ...d, close: e.target.value } }))}
                            className="rounded-chip bg-[#FFFDF6] px-2 py-1 text-caption text-ink shadow-hairline ring-1 ring-line-ring focus:outline-none focus:ring-[rgba(74,59,46,.25)]"
                            style={numStyle}
                          />
                        </span>
                      ) : (
                        <span className="text-caption-xs text-[rgba(74,59,46,.42)]">店休</span>
                      )}
                      <Switch
                        checked={d.on}
                        label={`${DAY_LABEL[k]}是否营业`}
                        onChange={(on) => setHours((w) => ({ ...w, [k]: { ...d, on } }))}
                      />
                    </div>
                  );
                })}
                <div className="flex justify-end pt-1">
                  <QuietButton disabled={hoursPending} onClick={() => void saveHours()}>
                    {hoursPending ? '保存中…' : '保存营业时间'}
                  </QuietButton>
                </div>
              </div>
            </ExpandRow>

            {/* 地址与坐标 */}
            <ExpandRow
              title="地址与坐标"
              hint="listNearby 距离粗排之用"
              open={openRow === 'addr'}
              onToggle={() => toggleRow('addr')}
            >
              <div className="space-y-3">
                <Field label="门店地址">
                  <input
                    className={inputCls}
                    value={info.address}
                    maxLength={255}
                    placeholder="如：朝阳区暖杏街 12 号"
                    onChange={(e) => setInfo((s) => ({ ...s, address: e.target.value }))}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="纬度" hint="-90 ~ 90，可留空">
                    <input
                      className={inputCls}
                      value={info.lat}
                      inputMode="decimal"
                      placeholder="如：39.9042"
                      onChange={(e) => setInfo((s) => ({ ...s, lat: e.target.value }))}
                    />
                  </Field>
                  <Field label="经度" hint="-180 ~ 180，可留空">
                    <input
                      className={inputCls}
                      value={info.lng}
                      inputMode="decimal"
                      placeholder="如：116.4074"
                      onChange={(e) => setInfo((s) => ({ ...s, lng: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="flex justify-end">
                  <QuietButton disabled={infoPending} onClick={() => void saveAddr()}>
                    {infoPending ? '保存中…' : '保存'}
                  </QuietButton>
                </div>
              </div>
            </ExpandRow>

            {/* 服务项与时长（时长引擎之母） */}
            <ExpandRow
              title="服务项与时长"
              hint="洗护/造型美容/寄养房型（时长引擎之母）"
              open={openRow === 'services'}
              onToggle={() => toggleRow('services')}
              actionLabel="管理 ›"
            >
              {servicesQuery.isPending ? (
                <div className="space-y-2" aria-label="加载中">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-9 animate-pulse rounded-control bg-canvas" />
                  ))}
                </div>
              ) : (
                <>
                  {serviceList.length === 0 ? (
                    <p className="py-4 text-center text-caption-xs text-[rgba(74,59,46,.42)]">
                      还没有服务项，点下方「＋ 新增服务」创建洗护或寄养服务
                    </p>
                  ) : (
                    <div>
                      {serviceList.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 border-t border-[rgba(74,59,46,.06)] py-2.5 first:border-t-0"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-caption font-semibold text-ink">
                              {s.name}
                              {!s.active ? (
                                <span className="u3-st done ml-2">已下架</span>
                              ) : null}
                            </span>
                            <div
                              className="mt-[2px] text-caption-xs text-[rgba(74,59,46,.42)]"
                              style={numStyle}
                            >
                              {s.type === 'boarding' ? '寄养' : '洗护美容'} ·{' '}
                              {s.durationMin != null ? `${s.durationMin} 分钟` : '时长 —'} ·{' '}
                              <span className="text-[rgba(74,59,46,.62)]">{fmtMoney(s.priceFen)}</span>
                              {s.boardingRoomType ? ` · 房型 ${s.boardingRoomType}` : ''}
                            </div>
                          </div>
                          <Switch
                            checked={s.active}
                            onChange={() => void toggleActive(s)}
                            label={`${s.name}上下架`}
                          />
                          <button
                            type="button"
                            onClick={() => setEditorFor(s)}
                            className="shrink-0 text-caption-xs font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.92]"
                          >
                            编辑 ›
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-caption-xs text-[rgba(74,59,46,.42)]">
                      下架项本次会话内仍列出（可重新上架）；刷新后不再显示（「含下架」列表接口 v2 补齐）
                    </p>
                    <QuietButton onClick={() => setEditorFor('new')}>＋ 新增服务</QuietButton>
                  </div>
                </>
              )}
            </ExpandRow>
          </div>

          {/* 右栏：经营口径 */}
          <div className="u3-panel">
            <div className="u3-panel-head">
              <h3>经营口径</h3>
              <span className="aside">通知偏好仅本机生效（v2 接服务端）</span>
            </div>
            <SetRow title="自动接单" hint="S4 口径 · 默认开（无开关项，仅口径展示）">
              <span className="shrink-0 text-caption font-bold text-ink">已启用</span>
            </SetRow>
            {NOTIFY_ITEMS.map((item) => (
              <SetRow key={item.key} title={item.label} hint={item.hint}>
                <Switch
                  checked={notify[item.key]}
                  onChange={(v) => changeNotify(item.key, v)}
                  label={item.label}
                />
              </SetRow>
            ))}
          </div>
        </div>
      )}

      <ServiceEditorDialog
        service={editorFor === 'new' ? null : editorFor}
        open={editorFor !== null}
        onClose={() => setEditorFor(null)}
        onSaved={(s) => {
          mergeService(s);
          void queryClient.invalidateQueries({ queryKey: ['store', 'getWithServices'] });
        }}
      />
    </MainScaffold>
  );
}
