/**
 * 槽位注册表种子行（端口批片 C · A5 落地）——单源件：
 * seed.ts 重置后补种用；迁移 0025 种子段同口径（手工保持同帧，改槽=两端同步+新迁移）。
 * 口径：version=1 / status='live' / url=null=渐变或图标占位（R10 不落假图，前端 fallback=码内默认）。
 */
export const SLOT_SEED_ROWS: Array<{ key: string; url: string | null; alt: string }> = [
  { key: 'home.banner', url: '/brand/banner-home-1200.png', alt: '首页品牌横幅' },
  { key: 'login.hero.staff', url: '/brand/banner-home-1200.png', alt: '员工端登录页主视觉' },
  { key: 'pets.emptyIllustration', url: '/brand/empty-appointments-800.png', alt: '宠物/预约空态插画' },
  { key: 'member.famCard', url: null, alt: '多宠氛围卡（渐变占位，待素材通道真件）' },
  { key: 'member.cardFace', url: null, alt: '会员卡面（档色谱渐变占位，待素材通道真件）' },
  { key: 'product.placeholder', url: null, alt: '商品无图占位模板（爪印图标占位，待素材通道真件）' },
];
