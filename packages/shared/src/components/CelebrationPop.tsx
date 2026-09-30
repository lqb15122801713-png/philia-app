/**
 * CelebrationPop · pop 动画 + 圆勾原子件（换皮批片 5「同型归并」）
 *
 * 归并出处：
 * - apps/staff/src/components/execute/CelebrationOverlay.tsx（celebrate-pop keyframes）
 * - apps/customer/src/components/live/CelebrationOverlay.tsx（live-pop keyframes）
 * 两个原实现的 bg-success 绿圆是违规残留；原子件直接落地色纪律：
 * 成功不设绿——深棕墨圆底（bg-ink）+ 淡金勾（text-brand-primary）。
 * 文案/布局/计时责任不在原子件，由壳层负责；preset 无 pop keyframes，故内联 <style>。
 */

import { Check } from 'lucide-react';

export interface CelebrationPopProps {
  /** 圆直径 px，默认 64；勾图标取直径一半。 */
  size?: number;
}

export default function CelebrationPop({ size = 64 }: CelebrationPopProps) {
  return (
    <>
      <style>{`@keyframes philia-celebrate-pop{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.12);opacity:1}100%{transform:scale(1);opacity:1}}`}</style>
      <span
        aria-hidden
        className="flex items-center justify-center rounded-full bg-ink shadow-elevated"
        style={{
          width: size,
          height: size,
          animation: 'philia-celebrate-pop .55s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <Check
          className="text-brand-primary"
          style={{ width: size / 2, height: size / 2 }}
          strokeWidth={2.5}
        />
      </span>
    </>
  );
}
