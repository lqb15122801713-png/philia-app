/**
 * 商品图（T5.3）：加载失败/无图时降级为暖色爪印占位（种子数据的 /brand/*.png
 * 未必存在，真实上传图走后端签名 URL，经 resolveImgSrc 归一化）。
 */

import { getApiBase } from '@philia/shared';
import { PawPrint } from 'lucide-react';
import { useState } from 'react';
import { resolveImgSrc } from './format';

export default function ProductImage({
  src,
  alt,
  className = '',
  imgClassName = '',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  imgClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const resolved = resolveImgSrc(src, getApiBase());

  if (!resolved || broken) {
    return (
      <div className={`flex items-center justify-center bg-sunken ${className}`} aria-label={alt}>
        <PawPrint className="h-8 w-8 text-ink-placeholder" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <div className={`overflow-hidden bg-sunken ${className}`}>
      <img
        src={resolved}
        alt={alt}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
    </div>
  );
}
