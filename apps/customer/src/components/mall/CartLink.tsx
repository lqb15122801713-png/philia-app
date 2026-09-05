/**
 * 购物车入口（T5.3）：右上购物车图标 + 角标数量。
 * 角标动画：检测到数量增加时做一次克制的缩放弹跳（200ms philia-spring，对齐设计手册徽章弹出）。
 */

import { ShoppingCart } from 'lucide-react';
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
      aria-label={`购物车，共 ${count} 件商品`}
      className={`relative flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 ${className}`}
    >
      <ShoppingCart className="h-5 w-5 text-ink" strokeWidth={1.5} />
      {count > 0 ? (
        <span
          className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-primary px-1 font-number text-[11px] font-semibold text-white transition-transform duration-300 ease-philia-spring ${
            bump ? 'scale-125' : 'scale-100'
          }`}
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
