/**
 * 门店设置（/settings · T4.3 · coder-staff-admin）
 *
 * 四个区块：
 * 1. 门店信息：名称/地址/经纬度 → store.update（T4.3 新增服务端授权，
 *    仅写本店字段，updated_at 服务端显式写）。
 * 2. 营业时间：每周七天 开/关 + 开始-结束（openHours JSON）→ store.update。
 * 3. 服务项与定价：列表 + 上下架开关 + 新增/编辑弹层 → store.upsertService；
 *    寄养类需选房型。
 * 4. 推送通知开关：本地 UI 占位（服务端无通知偏好字段，v2 接入；
 *    偏好暂存 localStorage，仅本机生效）。
 *
 * 数据源：auth.me（store 全行，含 openHours）+ store.getWithServices（active 服务项）。
 * 已知服务端缺口：getWithServices 只回 active=true 服务项，无「含下架」全量列表接口——
 * 下架项本页在本次会话内以本地 overrides 保持可见（可重新上架），刷新后不再列出。
 */

import { usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ServiceEditorDialog from '../components/staff-admin/ServiceEditorDialog';
import { errMsg, fmtMoney } from '../components/staff-admin/format';
import {
  DAY_KEYS,
  DAY_LABEL,
  type DayKey,
  type OpenHoursLike,
  type ServiceRow,
} from '../components/staff-admin/types';
import {
  Badge,
  Btn,
  Empty,
  Field,
  Loading,
  Switch,
  ToasterMount,
  inputCls,
  numStyle,
  toast,
} from '../components/staff-admin/ui';

/* ------------------------------------------------------------------ */
/* 区块壳                                                              */
/* ------------------------------------------------------------------ */

function Section({
  title,
  desc,
  action,
  children,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card bg-card p-5 shadow-card">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-title font-semibold text-ink">{title}</h2>
          {desc ? <p className="mt-0.5 text-caption text-ink-secondary">{desc}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 营业时间编辑器                                                       */
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

/* ------------------------------------------------------------------ */
/* 推送通知偏好（本地占位 · v2 接服务端）                                */
/* ------------------------------------------------------------------ */

const NOTIFY_KEY = 'philia.merchant.notifyPrefs';
interface NotifyPrefs {
  newAppointment: boolean;
  cancelRequest: boolean;
  boardingOverdue: boolean;
}
const NOTIFY_ITEMS: Array<{ key: keyof NotifyPrefs; label: string; hint: string }> = [
  { key: 'newAppointment', label: '新预约提醒', hint: '客户提交预约后实时提醒' },
  { key: 'cancelRequest', label: '取消申请提醒', hint: '服务开始前 4 小时内的取消需审核' },
  { key: 'boardingOverdue', label: '寄养超期提醒', hint: '寄养单超过预计退房时间未结算时提醒' },
];

function loadNotifyPrefs(): NotifyPrefs {
  try {
    const raw = window.localStorage.getItem(NOTIFY_KEY);
    if (raw) return { newAppointment: true, cancelRequest: true, boardingOverdue: true, ...JSON.parse(raw) };
  } catch {
    /* localStorage 不可用时用默认值 */
  }
  return { newAppointment: true, cancelRequest: true, boardingOverdue: true };
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

  /* ---------------- 门店信息表单 ---------------- */
  const [info, setInfo] = useState({ name: '', address: '', lat: '', lng: '' });
  const [infoPending, setInfoPending] = useState(false);
  useEffect(() => {
    if (!store) return;
    setInfo({
      name: store.name ?? '',
      address: store.address ?? '',
      lat: store.lat != null ? String(store.lat) : '',
      lng: store.lng != null ? String(store.lng) : '',
    });
    // 仅在门店切换时回填（避免保存后输入被覆盖）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const saveInfo = async () => {
    if (!info.name.trim()) {
      toast('门店名称不能为空', 'error');
      return;
    }
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
      await trpc.store.update.mutate({
        name: info.name.trim(),
        address: info.address.trim(),
        lat,
        lng,
      });
      toast('门店信息已保存');
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setInfoPending(false);
    }
  };

  /* ---------------- 营业时间 ---------------- */
  const [hours, setHours] = useState<WeekHours>(() => toWeekHours(null));
  const [hoursPending, setHoursPending] = useState(false);
  useEffect(() => {
    if (store) setHours(toWeekHours(store.openHours as OpenHoursLike | null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

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
  if (meQuery.isPending) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Loading />
      </div>
    );
  }
  if (!store) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Empty title="未找到门店信息" hint="请确认当前账号已完成开店绑定" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <ToasterMount />
      <div>
        <h1 className="text-title-lg font-semibold text-ink">门店设置</h1>
        <p className="mt-0.5 text-caption text-ink-secondary">{store.name}</p>
      </div>

      {/* 1. 门店信息 */}
      <Section title="门店信息" desc="名称与地址会展示给预约客户；经纬度用于「附近门店」排序">
        <div className="space-y-3">
          <Field label="门店名称">
            <input
              className={inputCls}
              value={info.name}
              maxLength={64}
              onChange={(e) => setInfo((s) => ({ ...s, name: e.target.value }))}
            />
          </Field>
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
            <Btn variant="primary" onClick={() => void saveInfo()} disabled={infoPending}>
              {infoPending ? '保存中…' : '保存门店信息'}
            </Btn>
          </div>
        </div>
      </Section>

      {/* 2. 营业时间 */}
      <Section title="营业时间" desc="每周七天；关掉的日期为店休，客户不可预约">
        <div className="space-y-2">
          {DAY_KEYS.map((k) => {
            const d = hours[k];
            return (
              <div key={k} className="flex items-center justify-between rounded-input bg-sunken px-3 py-2">
                <span className="w-12 text-body font-medium text-ink">{DAY_LABEL[k]}</span>
                {d.on ? (
                  <span className="flex items-center gap-2">
                    <input
                      type="time"
                      value={d.open}
                      onChange={(e) => setHours((w) => ({ ...w, [k]: { ...d, open: e.target.value } }))}
                      className="rounded-tag border border-line bg-card px-2 py-1 text-body text-ink focus:border-brand-primary focus:outline-none"
                    />
                    <span className="text-caption text-ink-placeholder">至</span>
                    <input
                      type="time"
                      value={d.close}
                      onChange={(e) => setHours((w) => ({ ...w, [k]: { ...d, close: e.target.value } }))}
                      className="rounded-tag border border-line bg-card px-2 py-1 text-body text-ink focus:border-brand-primary focus:outline-none"
                    />
                  </span>
                ) : (
                  <span className="text-caption text-ink-placeholder">店休</span>
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
            <Btn variant="primary" onClick={() => void saveHours()} disabled={hoursPending}>
              {hoursPending ? '保存中…' : '保存营业时间'}
            </Btn>
          </div>
        </div>
      </Section>

      {/* 3. 服务项与定价 */}
      <Section
        title="服务项与定价"
        desc="寄养类服务需设置房型；下架后客户不可见"
        action={
          <Btn variant="primary" size="sm" onClick={() => setEditorFor('new')}>
            <Plus size={14} strokeWidth={1.5} />
            新增服务
          </Btn>
        }
      >
        {servicesQuery.isPending ? (
          <Loading />
        ) : serviceList.length === 0 ? (
          <Empty title="还没有服务项" hint="点右上角「新增服务」创建洗护或寄养服务" />
        ) : (
          <>
            {/* lg+ 表格 */}
            <div className="hidden overflow-hidden rounded-input border border-line-divider lg:block">
              <table className="w-full text-left text-body">
                <thead>
                  <tr className="border-b border-line-divider bg-sunken text-caption text-ink-secondary">
                    <th className="px-3 py-2 font-medium">名称</th>
                    <th className="px-3 py-2 font-medium">类型</th>
                    <th className="px-3 py-2 font-medium">时长</th>
                    <th className="px-3 py-2 font-medium">价格</th>
                    <th className="px-3 py-2 font-medium">房型</th>
                    <th className="px-3 py-2 font-medium">上架</th>
                    <th className="px-3 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceList.map((s) => (
                    <tr key={s.id} className="border-b border-line-divider last:border-0 hover:bg-canvas">
                      <td className="px-3 py-2">
                        <span className="font-medium text-ink">{s.name}</span>
                        {!s.active ? (
                          <span className="ml-2">
                            <Badge tone="muted">已下架</Badge>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">
                        {s.type === 'boarding' ? '寄养' : '洗护美容'}
                      </td>
                      <td className="px-3 py-2 text-ink-secondary" style={numStyle}>
                        {s.durationMin != null ? `${s.durationMin} 分钟` : '—'}
                      </td>
                      <td className="px-3 py-2 text-ink" style={numStyle}>
                        {fmtMoney(s.priceFen)}
                      </td>
                      <td className="px-3 py-2 text-ink-secondary">{s.boardingRoomType ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Switch checked={s.active} onChange={() => void toggleActive(s)} label={`${s.name}上下架`} />
                      </td>
                      <td className="px-3 py-2">
                        <Btn variant="subtle" size="sm" onClick={() => setEditorFor(s)}>
                          <Pencil size={14} strokeWidth={1.5} />
                          编辑
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 手机卡片 */}
            <div className="space-y-2 lg:hidden">
              {serviceList.map((s) => (
                <div key={s.id} className="rounded-input bg-sunken px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-body font-medium text-ink">
                      {s.name}
                      {!s.active ? (
                        <span className="ml-2">
                          <Badge tone="muted">已下架</Badge>
                        </span>
                      ) : null}
                    </span>
                    <Switch checked={s.active} onChange={() => void toggleActive(s)} label={`${s.name}上下架`} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-caption text-ink-secondary" style={numStyle}>
                    <span>{s.type === 'boarding' ? '寄养' : '洗护美容'}</span>
                    <span>{s.durationMin != null ? `${s.durationMin} 分钟` : '时长 —'}</span>
                    <span className="text-ink">{fmtMoney(s.priceFen)}</span>
                    {s.boardingRoomType ? <span>房型 {s.boardingRoomType}</span> : null}
                  </div>
                  <div className="mt-2">
                    <Btn variant="ghost" size="sm" onClick={() => setEditorFor(s)}>
                      <Pencil size={14} strokeWidth={1.5} />
                      编辑
                    </Btn>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-caption text-ink-placeholder">
              下架的服务项本次会话内仍会列出（可重新上架）；刷新页面后下架项不再显示——
              「含下架」全量列表接口待服务端补齐（v2）。
            </p>
          </>
        )}
      </Section>

      {/* 4. 推送通知（本地占位） */}
      <Section title="推送通知" desc="提醒偏好（v2 接入服务端推送开关，当前仅保存在本机）">
        <div className="space-y-2">
          {NOTIFY_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between rounded-input bg-sunken px-3 py-2">
              <div>
                <div className="text-body text-ink">{item.label}</div>
                <div className="text-caption text-ink-placeholder">{item.hint}</div>
              </div>
              <Switch
                checked={notify[item.key]}
                onChange={(v) => changeNotify(item.key, v)}
                label={item.label}
              />
            </div>
          ))}
          <p className="text-caption text-ink-placeholder">
            以上为本地占位开关：服务端暂无通知偏好字段，v2 接入后此处配置才会影响实际推送。
          </p>
        </div>
      </Section>

      <ServiceEditorDialog
        service={editorFor === 'new' ? null : editorFor}
        open={editorFor !== null}
        onClose={() => setEditorFor(null)}
        onSaved={(s) => {
          mergeService(s);
          void queryClient.invalidateQueries({ queryKey: ['store', 'getWithServices'] });
        }}
      />
    </div>
  );
}
