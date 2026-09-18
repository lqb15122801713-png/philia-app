/**
 * 购物袋入口（T5.3；U4-D3 对齐试样 07 屏 .pill-code 工艺）：
 * 页头右侧细线 pill——袋图标 +「购物袋 · N」（N>0 时带出件数，u1-num 等宽）。
 * 试样：1px 细线 ring + 全圆 + 11px/600 墨 60%；角标弹跳保留（数量增加时 200ms
 * 克制缩放，对齐设计手册徽章弹出）。
 */

import { ShoppingBag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from './cartStore';

export default function CartLink({ className = '' }: { className?: string }) {
  const { count } = useCart();
  const [bump, setBump] = useState(false);
  const prevRef = useRef(count);

  useEffect(() => {
    if (count > prevRef.current) {
      setBump(true);
      const t = window.setTimeout(() => setBump(false), 260);
      prevRef.current = count;
      return () => window.clearTimeout(t);
    }
    prevRef.current = count;
    return undefined;
  }, [count]);

  return (
    <Link
      to="/mall/cart"
      aria-label={`购物袋，共 ${count} 件商品`}
      className={`flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-caption-xs font-semibold text-ink-secondary ring-1 ring-line-ring transition-transform duration-120 ease-philia-spring active:scale-92 ${className}`}
    >
      <ShoppingBag className="h-3 w-3" strokeWidth={1.8} />
      购物袋
      {count > 0 ? (
        <span
          className={`u1-num text-ink transition-transform duration-300 ease-philia-spring ${
            bump ? 'scale-125' : 'scale-100'
          }`}
        >
          · {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
