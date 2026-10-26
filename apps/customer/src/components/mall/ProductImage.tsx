import { getApiBase, slotContentOf, resolveSlotUrl } from '@philia/shared';
import { useState } from 'react';
import { mlc } from '../../copy/mall';
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
  const [slotBroken, setSlotBroken] = useState(false);
  const resolved = resolveImgSrc(src, getApiBase());

  if (!resolved || broken) {
    const slotUrl = slotBroken ? null : resolveSlotUrl(slotContentOf('product.placeholder')?.url);
    if (slotUrl) {
      return (
        <div className={`overflow-hidden bg-sunken ${className}`}>
          <img
            src={slotUrl}
            alt={alt}
            loading="lazy"
            onError={() => setSlotBroken(true)}
            className={`h-full w-full object-cover ${imgClassName}`}
          />
        </div>
      );
    }
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-[linear-gradient(135deg,#FAF7F0_0%,#F3EEE4_55%,#E9E1D2_100%)] ${className}`}
      >
        <span className="rounded-full bg-card/75 px-2.5 py-1 text-[12px] font-medium text-ink-secondary" data-u4-secondary>
          {mlc('mall.pendingImage')}
        </span>
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
