/**
 * PhotoWall · 服务照片墙
 *
 * 两种形态：
 * 1. 九宫格缩略图流：3 列等宽、4px 间距、1:1 裁切、8px 圆角、懒加载，
 *    新照片加载完成后淡入；超过 9 张时第 9 格叠「+N」暖棕半透明蒙层。
 * 2. before/after 并排双图（stepKey === 'before_after'）：两张 4:3 图并排，
 *    左「服务前」右「服务后」角标，中央接缝处 24px 白圆箭头暗示变化方向。
 *
 * 查看原图的全屏查看器由页面层实现，本组件只通过 onPhotoClick 回调抛出点击事件。
 * 规格见 docs/DESIGN.md §6.3。
 */

import { ArrowRight } from 'lucide-react';

/** 照片墙单张照片。 */
export interface PhotoWallPhoto {
  id: string;
  /** 原图地址（点击查看原图用）。 */
  url: string;
  /** 缩略图地址；缺省回退到 url。 */
  thumbUrl?: string;
  /** 角标文字（如「服务前」「服务后」之外的自定义标注）。 */
  tag?: string;
}

export interface PhotoWallProps {
  photos: PhotoWallPhoto[];
  /** 传入 'before_after' 时切换为左右并排双图模式。 */
  stepKey?: string;
  /** 点击照片回调（查看原图由页面层处理）。 */
  onPhotoClick?: (photo: PhotoWallPhoto, index: number) => void;
}

/** 单格缩略图：懒加载 + 加载完成后淡入。 */
function Thumb({
  photo,
  index,
  onPhotoClick,
  className = '',
}: {
  photo: PhotoWallPhoto;
  index: number;
  onPhotoClick?: (photo: PhotoWallPhoto, index: number) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onPhotoClick?.(photo, index)}
      className={`relative block w-full overflow-hidden rounded-tag bg-sunken ${className}`}
      aria-label={photo.tag ?? `照片 ${index + 1}`}
    >
      <img
        src={photo.thumbUrl ?? photo.url}
        alt={photo.tag ?? `照片 ${index + 1}`}
        loading="lazy"
        className="h-full w-full object-cover opacity-0 transition-opacity duration-300"
        onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
      />
      {photo.tag ? (
        <span className="absolute left-1 top-1 rounded-tag bg-[rgba(61,50,41,0.45)] px-1.5 py-0.5 text-caption text-white">
          {photo.tag}
        </span>
      ) : null}
    </button>
  );
}

/** before/after 并排双图：左前右后，接缝处叠白圆箭头。 */
function BeforeAfterWall({
  photos,
  onPhotoClick,
}: {
  photos: PhotoWallPhoto[];
  onPhotoClick?: (photo: PhotoWallPhoto, index: number) => void;
}) {
  const before = photos[0];
  const after = photos[1] ?? photos[0];
  if (!before) return null;

  const slots: { photo: PhotoWallPhoto; label: string; badgeClass: string; index: number }[] = [
    // 服务前：奶杏浅底 + 暖深棕字；服务后：品牌色底 + 白字
    { photo: before, label: '服务前', badgeClass: 'bg-brand-secondary-light text-ink', index: 0 },
    { photo: after, label: '服务后', badgeClass: 'bg-brand-primary text-white', index: 1 },
  ];

  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-2">
        {slots.map(({ photo, label, badgeClass, index }) => (
          <button
            key={label}
            type="button"
            onClick={() => onPhotoClick?.(photo, index)}
            className="relative block aspect-[4/3] w-full overflow-hidden rounded-tag bg-sunken"
            aria-label={label}
          >
            <img
              src={photo.thumbUrl ?? photo.url}
              alt={label}
              loading="lazy"
              className="h-full w-full object-cover opacity-0 transition-opacity duration-300"
              onLoad={(e) => e.currentTarget.classList.remove('opacity-0')}
            />
            <span className={`absolute left-1.5 top-1.5 rounded-tag px-1.5 py-0.5 text-caption ${badgeClass}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
      {/* 中央接缝：24px 白圆箭头，暗示 前 → 后 的变化方向 */}
      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-card">
        <ArrowRight className="h-3.5 w-3.5 text-brand-primary" strokeWidth={1.5} />
      </span>
    </div>
  );
}

export default function PhotoWall({ photos, stepKey, onPhotoClick }: PhotoWallProps) {
  if (photos.length === 0) return null;

  if (stepKey === 'before_after') {
    return <BeforeAfterWall photos={photos} onPhotoClick={onPhotoClick} />;
  }

  // 超过 9 张：前 8 张正常展示，第 9 格叠「+N」蒙层（N 含被盖住的那张）
  const overflow = photos.length > 9 ? photos.length - 8 : 0;
  const visible = overflow > 0 ? photos.slice(0, 9) : photos;

  return (
    <div className="grid grid-cols-3 gap-1">
      {visible.map((photo, index) => {
        const isOverlayCell = overflow > 0 && index === 8;
        return (
          <div key={photo.id} className="relative aspect-square">
            <Thumb photo={photo} index={index} onPhotoClick={onPhotoClick} className="aspect-square" />
            {isOverlayCell ? (
              <button
                type="button"
                onClick={() => onPhotoClick?.(photo, index)}
                className="absolute inset-0 flex items-center justify-center rounded-tag bg-[rgba(61,50,41,0.45)] text-title text-white"
                aria-label={`还有 ${overflow} 张照片`}
              >
                +{overflow}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
