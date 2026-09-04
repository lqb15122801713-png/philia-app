/**
 * ConvexTabBar · 客户端专用五栏凸起底部导航
 *
 * 规格见 docs/DESIGN.md §6.1：
 * - 栏体高 56px、白底、顶部 1px 发丝线；5 个槽位，中间槽位留给凸起按钮
 * - SVG 凹口：栏体顶边在中央下凹约 14px「怀抱」圆形按钮，贝塞尔平滑过渡
 * - philia 按钮：64px 正圆、向上凸起（bottom 12px）、bg-philia-gradient 渐变、
 *   shadow-philia 暖色投影、内嵌白色爪心剪影；无文字、永远彩色；
 *   activeService 时外罩 animate-halo 呼吸光环；按下 scale 0.92 / 120ms
 * - 常规 tab：24px 1.5px 线性图标 + 12px 文字；未选中暖灰棕，选中品牌色
 *
 * 用法（客户端）：
 *   <ConvexTabBar items={tabs} philiaPath="/philia" activeService={hasLive} />
 * onNavigate / activeKey 均可省略，内部回退到 react-router 的 useNavigate / useLocation。
 */

import { useLocation, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import defaultPhiliaIcon from '../assets/philia-tab-icon.png';

/** 常规 tab 项（共 4 个，philia 按钮独占中间槽位、不在此列）。 */
export interface ConvexTabBarItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

export interface ConvexTabBarProps {
  /** 4 个常规 tab，按从左到右顺序传入，中间自动空出 philia 槽位。 */
  items: ConvexTabBarItem[];
  /** philia 按钮目标路径。 */
  philiaPath: string;
  /** 当前选中 key；缺省用路由 location 推导。 */
  activeKey?: string;
  /** 导航回调；缺省用 useNavigate。 */
  onNavigate?: (path: string) => void;
  /** 有进行中服务时为 true，philia 按钮外圈出现呼吸光环。 */
  activeService?: boolean;
  /** philia 按钮中央图标（默认白色爪心剪影）。 */
  philiaIcon?: string;
}

/** 常规 tab 按钮：1.5px 线性图标 + 12px 文字，按下 scale 0.92 / 120ms。 */
function TabItem({
  item,
  active,
  onPress,
}: {
  item: ConvexTabBarItem;
  active: boolean;
  onPress: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={`flex h-14 flex-col items-center justify-center gap-0.5 transition-transform duration-120 ease-philia-spring active:scale-92 ${
        active ? 'text-brand-primary' : 'text-ink-secondary'
      }`}
    >
      <Icon className="h-6 w-6" strokeWidth={1.5} />
      <span className="text-caption">{item.label}</span>
    </button>
  );
}

export default function ConvexTabBar({
  items,
  philiaPath,
  activeKey,
  onNavigate,
  activeService = false,
  philiaIcon = defaultPhiliaIcon,
}: ConvexTabBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const go = onNavigate ?? navigate;

  // activeKey 缺省时按路径前缀推导
  const isItemActive = (item: ConvexTabBarItem) =>
    activeKey !== undefined
      ? item.key === activeKey
      : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
  const philiaActive =
    location.pathname === philiaPath || location.pathname.startsWith(`${philiaPath}/`);

  const left = items.slice(0, 2);
  const right = items.slice(2, 4);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-tabbar" aria-label="底部导航">
      <div className="relative mx-auto max-w-lg">
        {/* 栏体：左右白底段 + 中央 SVG 凹口 */}
        <div className="relative h-14">
          <div
            className="absolute inset-y-0 left-0 border-t border-line-divider bg-card"
            style={{ right: 'calc(50% + 56px)' }}
          />
          <div
            className="absolute inset-y-0 right-0 border-t border-line-divider bg-card"
            style={{ left: 'calc(50% + 56px)' }}
          />
          {/* 凹口：宽 112px（视觉开口约 76px）、深 14px，三次贝塞尔平滑回栏体 */}
          <svg
            className="absolute left-1/2 top-0 -translate-x-1/2"
            width="112"
            height="56"
            viewBox="0 0 112 56"
            aria-hidden="true"
          >
            <path
              d="M0 0 C 20 0 32 14 56 14 C 80 14 92 0 112 0 L112 56 L0 56 Z"
              fill="#FFFFFF"
            />
            <path
              d="M0 0 C 20 0 32 14 56 14 C 80 14 92 0 112 0"
              fill="none"
              stroke="#F0EBE5"
              strokeWidth="1"
            />
          </svg>

          {/* 5 槽位：左 2 + 空（philia）+ 右 2 */}
          <div className="absolute inset-0 grid grid-cols-5">
            {left.map((item) => (
              <TabItem key={item.key} item={item} active={isItemActive(item)} onPress={() => go(item.path)} />
            ))}
            <span aria-hidden="true" />
            {right.map((item) => (
              <TabItem key={item.key} item={item} active={isItemActive(item)} onPress={() => go(item.path)} />
            ))}
          </div>

          {/* philia 凸起按钮：64px 渐变正圆、暖色投影、永远彩色无文字。
              光环放在外层 wrapper 上，避免 box-shadow 动画覆盖 shadow-philia 投影 */}
          <span
            className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full ${
              activeService ? 'animate-halo' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => go(philiaPath)}
              aria-label="Philia"
              aria-current={philiaActive ? 'page' : undefined}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-philia-gradient shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              <img
                src={philiaIcon}
                alt=""
                className={`h-8 w-8 transition-transform duration-300 ease-philia-out ${
                  philiaActive ? 'rotate-90' : ''
                }`}
              />
            </button>
          </span>
        </div>

        {/* 全面屏底部安全区，栏体同色填充 */}
        <div className="bg-card pb-[env(safe-area-inset-bottom)]" />
      </div>
    </nav>
  );
}
