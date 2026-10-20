/**
 * 槽位注册表种子行（端口批片 C · A5 落地）——单源件：
 * seed.ts 重置后补种用；迁移 0025 种子段同口径（手工保持同帧，改槽=两端同步+新迁移）。
 * 口径：version=1 / status='live' / url=null=渐变或图标占位（R10 不落假图，前端 fallback=码内默认）。
 */
export const SLOT_SEED_ROWS: Array<{
  key: string;
  url: string | null;
  alt: string;
  /** D-42 三行文案（可选；片4 批C/批D 新槽带默认文案，旧槽无=纯图版） */
  title_main?: string;
  title_sub?: string;
  cta_text?: string;
}> = [
  { key: 'home.banner', url: '/brand/banner-home-1200.png', alt: '首页品牌横幅' },
  { key: 'login.hero.staff', url: '/brand/banner-home-1200.png', alt: '员工端登录页主视觉' },
  { key: 'pets.emptyIllustration', url: '/brand/empty-appointments-800.png', alt: '宠物/预约空态插画' },
  { key: 'member.famCard', url: null, alt: '多宠氛围卡（渐变占位，待素材通道真件）' },
  { key: 'member.cardFace', url: null, alt: '会员卡面（档色谱渐变占位，待素材通道真件）' },
  { key: 'product.placeholder', url: null, alt: '商品无图占位模板（爪印图标占位，待素材通道真件）' },
  /* ---- 产品-1015 换皮 片4-运营商城 · 端口轻批（迁移 0086 同口径）：批D 商城促销横幅 + 批C 杂志三条 ---- */
  { key: 'mall.hero', url: null, alt: '商城促销横幅（渐变占位，待素材通道真件）', title_main: '本周上新', title_sub: '给它囤点好的 · 门店同价', cta_text: '去逛逛' },
  { key: 'philia.magazine.lead', url: null, alt: '杂志封面主打（渐变占位，待素材通道真件）', title_main: '秋日洗护季特刊', title_sub: '换季掉毛与皮肤干燥——给它一套入秋洗护方案', cta_text: '读本期' },
  { key: 'philia.magazine.02', url: null, alt: '杂志条目二（渐变占位，待素材通道真件）', title_main: '猫咪换季软便怎么办', title_sub: '饮食过渡七日法 · 编辑部' },
  { key: 'philia.magazine.03', url: null, alt: '杂志条目三（渐变占位，待素材通道真件）', title_main: '狗狗脚掌护理入门', title_sub: '秋冬干裂预防 · 编辑部' },
];
