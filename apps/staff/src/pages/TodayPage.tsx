/**
 * 今日任务页（契约 docs/STAFF-CONTRACTS.md · T3.1）—— 路由 /today
 *
 * 批次 S1（任务 C）双任务台分流：
 * - 角色获取：复用既有 auth.me（useMe），staff.role 随员工行返回，不新增服务端接口；
 * - role=frontdesk → 前台任务台（FrontdeskDesk：扫码核销大按钮 + 今日接待 待核销/已核销分组）；
 * - role=groomer → 美容师任务台（GroomerDesk：原今日时间轴 + 未来 7 天前瞻，无核销入口）；
 * - 已登录但无 staff 记录（user.staffId 为空）→ 友好空态（联系店主分配角色），不白屏不报错；
 * - 加载中显示骨架，分流前不闪任何一台的内容。
 */

import { useMe } from '@philia/shared';
import { PawPrint } from 'lucide-react';
import FrontdeskDesk from '@/components/today/FrontdeskDesk';
import GroomerDesk from '@/components/today/GroomerDesk';

export default function TodayPage() {
  const { user, loading } = useMe();

  // 加载态：骨架（与两台骨架卡同风格，避免分流前闪屏；U4-E 骨架=u1-card+chip 档圆角条）
  if (loading) {
    return (
      <div className="px-[22px] pb-6">
        <div className="pt-6">
          <div className="h-8 w-32 animate-pulse rounded-chip bg-sunken" />
          <div className="mt-2 h-5 w-48 animate-pulse rounded-chip bg-sunken" />
        </div>
        <div className="mt-6 space-y-3" aria-label="加载中">
          {[0, 1, 2].map((i) => (
            <div key={i} className="u1-card animate-pulse p-4">
              <div className="h-6 w-20 rounded-chip bg-sunken" />
              <div className="mt-2 h-5 w-40 rounded-chip bg-sunken" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 无 staff 记录（已登录但店主尚未分配员工身份/角色）→ 友好空态，不白屏不报错
  // （emoji 禁令 → lucide 墨色线图标；字阶 14/20 闸门档）
  if (!user?.staffId) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
        <span
          aria-hidden
          className="flex h-24 w-24 items-center justify-center rounded-full bg-sunken"
        >
          <PawPrint className="h-11 w-11 text-ink" strokeWidth={1.5} />
        </span>
        <h1 className="mt-5 text-title-lg">还未分配员工角色</h1>
        <p className="mt-2 text-body-sm text-ink-secondary">
          当前账号「{user?.nickname ?? user?.id}」还没有绑定门店员工身份。
          <br />
          请联系店主在商家端「员工管理」邀请入职并分配角色（前台 / 美容师）后再使用。
        </p>
      </div>
    );
  }

  return user.staffRole === 'frontdesk' ? <FrontdeskDesk /> : <GroomerDesk />;
}
