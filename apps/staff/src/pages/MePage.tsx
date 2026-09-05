/**
 * 我的页（契约 docs/STAFF-CONTRACTS.md · T3.1）—— 路由 /me
 *
 * - 我的排班：auth.me 返回的 staff.schedule 周模板只读渲染（今天高亮）；
 *   useMe 映射的 SessionUser 不含 schedule，故本页直接调 trpc.auth.me 取完整 staff 行。
 * - 消息列表：push.listNotifications；点击未读 → push.markRead 已读 + 失效缓存，
 *   通知带 link 时跳转。
 * - 设置：占位入口（建设中）+ 登出（logout → 清缓存 → 回 /dev-login）。
 */

import { getApiBase, logout, useMe, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ChevronRight, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Toast, { useToast } from '@/components/today/Toast';
import {
  dayKeyOf,
  hhmm,
  mmdd,
  SCHEDULE_DAYS,
  weekdayLabel,
  type NotificationItem,
} from '@/components/today/utils';

/* ------------------------------------------------------------------ */
/* 我的排班（周模板只读）                                                  */
/* ------------------------------------------------------------------ */

type Schedule = Partial<Record<string, Array<{ start: string; end: string }>>>;

function ScheduleCard({ schedule }: { schedule: Schedule | null | undefined }) {
  const todayKey = dayKeyOf(new Date());
  return (
    <section className="mt-4 rounded-card bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-2 text-title">
        <CalendarDays className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
        我的排班
      </h2>
      <ul className="mt-3 divide-y divide-line-divider">
        {SCHEDULE_DAYS.map(({ key, label }) => {
          const ranges = schedule?.[key] ?? [];
          const isToday = key === todayKey;
          return (
            <li
              key={key}
              className={`flex min-h-12 items-center justify-between py-2 ${
                isToday ? 'font-semibold text-brand-primary-pressed' : ''
              }`}
            >
              <span className="text-body-lg">
                {label}
                {isToday ? <span className="ml-1 text-caption">（今天）</span> : ''}
              </span>
              {ranges.length > 0 ? (
                <span className="font-number text-body-lg tabular-nums">
                  {ranges.map((r) => `${r.start}-${r.end}`).join(' / ')}
                </span>
              ) : (
                <span className="text-body text-ink-placeholder">休息</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 消息列表                                                              */
/* ------------------------------------------------------------------ */

function NotificationRow({
  item,
  onOpen,
}: {
  item: NotificationItem;
  onOpen: (item: NotificationItem) => void;
}) {
  const unread = item.readAt === null;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex min-h-14 w-full items-start gap-2 px-1 py-3 text-left transition active:opacity-70"
      >
        <span
          className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
            unread ? 'bg-brand-primary' : 'bg-line-strong'
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className={`block text-body-lg ${unread ? 'font-semibold' : ''}`}>{item.title}</span>
          <span className="mt-0.5 block text-body text-ink-secondary">{item.body}</span>
          <span className="mt-0.5 block font-number text-caption text-ink-placeholder tabular-nums">
            {mmdd(item.createdAt)} {hhmm(item.createdAt)} {weekdayLabel(item.createdAt)}
          </span>
        </span>
        {item.link ? <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-ink-placeholder" /> : null}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                  */
/* ------------------------------------------------------------------ */

export default function MePage() {
  const navigate = useNavigate();
  const { trpc, queryClient } = usePhiliaClient();
  const { user } = useMe();
  const [toast, showToast] = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  // 员工详情（排班周模板在 staff.schedule JSON 里；auth.me 返回完整 staff 行）
  const meQuery = useQuery({
    queryKey: ['auth', 'me', 'staffDetail'],
    queryFn: () => trpc.auth.me.query(),
  });
  const staff = meQuery.data?.staff ?? null;
  const store = meQuery.data?.store ?? null;

  // 站内消息
  const notifQuery = useQuery({
    queryKey: ['push', 'listNotifications'],
    queryFn: () => trpc.push.listNotifications.query({ limit: 30 }),
  });
  const notifications = notifQuery.data?.items ?? [];
  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  /** 点击消息：已读 + 有链接则跳转 */
  const openNotification = async (item: NotificationItem) => {
    if (item.readAt === null) {
      try {
        await trpc.push.markRead.mutate({ ids: [item.id] });
        await queryClient.invalidateQueries({ queryKey: ['push', 'listNotifications'] });
      } catch {
        showToast('网络不佳，已读状态稍后同步');
      }
    }
    if (item.link) navigate(item.link);
  };

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout(getApiBase());
      await queryClient.invalidateQueries();
      navigate('/dev-login', { replace: true });
    } catch {
      showToast('登出失败，请检查网络后重试');
      setLoggingOut(false);
    }
  };

  return (
    <div className="px-4 pb-6">
      {/* 个人信息头 */}
      <header className="pt-6">
        <h1 className="text-title-lg">我的</h1>
        <p className="mt-2 text-body-lg">
          <span className="font-semibold">{user?.nickname ?? staff?.name ?? '员工'}</span>
          {store ? <span className="text-ink-secondary"> · {store.name}</span> : null}
        </p>
        {staff?.skills && staff.skills.length > 0 ? (
          <p className="mt-1 flex flex-wrap gap-1.5">
            {staff.skills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-brand-secondary-light px-2.5 py-0.5 text-caption text-ink"
              >
                {s === 'wash' ? '洗护' : s === 'groom' ? '美容' : s === 'boarding' ? '寄养' : s}
              </span>
            ))}
          </p>
        ) : null}
      </header>

      {/* 我的排班（周模板只读） */}
      <ScheduleCard schedule={staff?.schedule as Schedule | null | undefined} />

      {/* 消息列表 */}
      <section className="mt-4 rounded-card bg-card p-4 shadow-card">
        <h2 className="flex items-center justify-between text-title">
          <span className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
            消息
          </span>
          {unreadCount > 0 ? (
            <span className="rounded-full bg-brand-primary-light px-2.5 py-0.5 text-caption font-medium text-brand-primary-pressed">
              {unreadCount} 条未读
            </span>
          ) : null}
        </h2>
        {notifQuery.isPending ? (
          <p className="py-6 text-center text-body text-ink-secondary">加载中…</p>
        ) : notifQuery.isError ? (
          <div className="py-4 text-center">
            <p className="text-body text-ink-secondary">消息加载失败</p>
            <button
              type="button"
              onClick={() => void notifQuery.refetch()}
              className="mt-2 text-body font-semibold text-brand-primary"
            >
              重新加载
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <p className="py-6 text-center text-body text-ink-placeholder">暂无消息</p>
        ) : (
          <ul className="mt-1 divide-y divide-line-divider">
            {notifications.map((n) => (
              <NotificationRow key={n.id} item={n} onOpen={openNotification} />
            ))}
          </ul>
        )}
      </section>

      {/* 设置（占位）+ 登出 */}
      <section className="mt-4 rounded-card bg-card p-4 shadow-card">
        <h2 className="flex items-center gap-2 text-title">
          <Settings className="h-5 w-5 text-brand-primary" strokeWidth={1.5} />
          设置
        </h2>
        <ul className="mt-1 divide-y divide-line-divider">
          {['账号与资料', '通知设置', '关于菲丽亚员工端'].map((label) => (
            <li key={label}>
              <div className="flex min-h-14 items-center justify-between py-2 text-ink-placeholder">
                <span className="text-body-lg">{label}</span>
                <span className="text-caption">建设中</span>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void doLogout()}
          className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-full border border-line-strong text-body-lg font-semibold text-danger-deep transition active:scale-[0.98] disabled:opacity-60"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.5} />
          {loggingOut ? '登出中…' : '退出登录'}
        </button>
      </section>

      <Toast message={toast} />
    </div>
  );
}
