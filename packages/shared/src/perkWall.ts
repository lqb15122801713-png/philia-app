/**
 * 权益墙格清单写死件（产品-1010 画布全屏批 片 1 · B 股 · 任务书两问闸：格清单=写死件白名单）
 *
 * - PERK_WALL_ITEMS=七格定义（格键/编辑面中文名/格名 copy 键/副签 copy 键族/默认图标键）——
 *   双端同源（customer 渲染+merchant 画布编辑）同读一件；
 * - PERK_ICON_SET=图标白名单（SVG 形状数据族；渲染件 PerkIcon 在 canvasLayout.tsx）；
 * - 格序/图标选换=布局数据（page_layouts.blocksJson 的 mc.perksWall 块 perks 位）——
 *   缺省/非法=本表默认序尾补（与画布缺省回退同族口径；server 校验白名单在 canvas.ts 契约镜像）。
 *
 * 本件=纯数据零 JSX（e2e 可直读；JSX 渲染件 PerkIcon + 读口 hook usePerkWallCells 在 canvasLayout.tsx）。
 */

/** 格键（七格；寄养折扣行已于端口批收尾片 4 裁撤，不再列） */
export type PerkKey = 'pets' | 'discount' | 'rebate' | 'groomer' | 'birthday' | 'skin' | 'archive';

/** 图标键（白名单=七格默认图标+三枚通用备选；新增图标=代码登记，不上传） */
export type PerkIconKey = PerkKey | 'heart' | 'gift' | 'star';

export interface PerkWallItemDef {
  key: PerkKey;
  /** 编辑面中文名（画布格级子区行题；客户可见名=titleCopyKey 的文案值） */
  label: string;
  /** 格名 copy 键（高危族：涉承诺话术口令复核） */
  titleCopyKey: string;
  /** 副签 copy 键（含档数值的档随件）；免费档/无数值档另有口径键 */
  subCopyKey: string;
  subFreeCopyKey?: string;
  subNoneCopyKey?: string;
  defaultIcon: PerkIconKey;
}

/** 七格定义（默认序=现状 JSX 序） */
export const PERK_WALL_ITEMS: readonly PerkWallItemDef[] = [
  { key: 'pets', label: '多宠覆盖', titleCopyKey: 'perk.pets', subCopyKey: 'perk.petsSub', subFreeCopyKey: 'perk.petsSubFree', defaultIcon: 'pets' },
  { key: 'discount', label: '服务折扣', titleCopyKey: 'perk.discount', subCopyKey: 'perk.discountSub', subNoneCopyKey: 'perk.discountNone', defaultIcon: 'discount' },
  { key: 'rebate', label: '回馈金', titleCopyKey: 'perk.rebate', subCopyKey: 'perk.rebateSub', subNoneCopyKey: 'perk.rebateNone', defaultIcon: 'rebate' },
  { key: 'groomer', label: '专属洗护师', titleCopyKey: 'perk.groomer', subCopyKey: 'perk.groomerSub', defaultIcon: 'groomer' },
  { key: 'birthday', label: '生日礼遇', titleCopyKey: 'perk.birthday', subCopyKey: 'perk.birthdaySub', defaultIcon: 'birthday' },
  { key: 'skin', label: '皮毛检测', titleCopyKey: 'perk.skin', subCopyKey: 'perk.skinSub', defaultIcon: 'skin' },
  { key: 'archive', label: '年度档案', titleCopyKey: 'perk.archive', subCopyKey: 'perk.archiveSub', defaultIcon: 'archive' },
] as const;

/** 格级布局单元（布局数据 perks 位的行形状） */
export interface PerkWallCellSpec {
  key: PerkKey;
  icon: PerkIconKey;
}

/** 默认格序（写死件默认序=缺省回退） */
export function perkWallDefaultCells(): PerkWallCellSpec[] {
  return PERK_WALL_ITEMS.map((i) => ({ key: i.key, icon: i.defaultIcon }));
}

/**
 * 布局 perks 行→有效格序：白名单过滤（未知格/图标键丢）+缺格尾补默认+重格去重保序
 * （与画布 useCanvasLayout 缺省回退同族口径）。入参=契约宽松位（server blocksJson 同形）。
 */
export function resolvePerkWallCells(perks: ReadonlyArray<{ key: string; icon: string }> | null | undefined): PerkWallCellSpec[] {
  const validKeys = new Set<string>(PERK_WALL_ITEMS.map((i) => i.key));
  const out: PerkWallCellSpec[] = [];
  const seen = new Set<string>();
  for (const p of perks ?? []) {
    if (!validKeys.has(p.key) || seen.has(p.key)) continue;
    seen.add(p.key);
    /* 白名单闸后收窄（契约宽松位→写死件类型）：格键=七格白名单，图标键=图标白名单 */
    const key = p.key as PerkKey;
    const icon: PerkIconKey = p.icon in PERK_ICON_SET ? (p.icon as PerkIconKey) : (PERK_WALL_ITEMS.find((i) => i.key === p.key)!.defaultIcon);
    out.push({ key, icon });
  }
  for (const i of PERK_WALL_ITEMS) {
    if (!seen.has(i.key)) out.push({ key: i.key, icon: i.defaultIcon });
  }
  return out;
}

/** SVG 形状描述（纯数据；渲染=canvasLayout.tsx PerkIcon） */
export interface PerkIconShape {
  tag: 'path' | 'circle' | 'rect' | 'g';
  attrs?: Record<string, string | number>;
  children?: PerkIconShape[];
}

/** 图标白名单（SVG 形状数据族；viewBox 0 0 24 24 线性，stroke 由渲染件统一给） */
export const PERK_ICON_SET: Record<PerkIconKey, PerkIconShape[]> = {
  /* 多宠覆盖（爪印线性） */
  pets: [{ tag: 'path', attrs: { d: 'M12 13.5c-2.8 0-5 2-5 4.2 0 1.4 1 2.3 2.4 2.3 1 0 1.7-.5 2.6-.5s1.6.5 2.6.5c1.4 0 2.4-.9 2.4-2.3 0-2.2-2.2-4.2-5-4.2z M6.5 10m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0 M10 7.5m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M14 7.5m-1.7 0a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0-3.4 0 M17.5 10m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0' } }],
  /* 服务折扣（山形+基线） */
  discount: [{ tag: 'path', attrs: { d: 'M4 16l5-9 4 6 3-4 4 7z M4 20h16' } }],
  /* 回馈金（圆+指针） */
  rebate: [{ tag: 'g', children: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 8 } }, { tag: 'path', attrs: { d: 'M12 7v5l3.5 2' } }] }],
  /* 专属洗护师 */
  groomer: [{ tag: 'g', children: [{ tag: 'circle', attrs: { cx: 12, cy: 8, r: 3.4 } }, { tag: 'path', attrs: { d: 'M5.5 20c1-3.4 3.5-5 6.5-5s5.5 1.6 6.5 5' } }] }],
  /* 生日礼遇（星） */
  birthday: [{ tag: 'path', attrs: { d: 'M12 4l2.2 4.6 5 .6-3.7 3.4 1 4.9-4.5-2.5-4.5 2.5 1-4.9L4.8 9.2l5-.6z' } }],
  /* 皮毛检测（靶） */
  skin: [{ tag: 'g', children: [{ tag: 'circle', attrs: { cx: 12, cy: 12, r: 8 } }, { tag: 'circle', attrs: { cx: 12, cy: 12, r: 3 } }] }],
  /* 年度档案（文档形） */
  archive: [{ tag: 'g', children: [{ tag: 'rect', attrs: { x: 5, y: 4, width: 14, height: 16, rx: 2 } }, { tag: 'path', attrs: { d: 'M9 9h6M9 13h6M9 17h4' } }] }],
  /* 备选·爱心 */
  heart: [{ tag: 'path', attrs: { d: 'M12 20s-7-4.3-7-9.3C5 7.5 7.2 5.5 9.6 5.5c1.4 0 2.4.7 2.4.7s1-.7 2.4-.7C16.8 5.5 19 7.5 19 10.7 19 15.7 12 20 12 20z' } }],
  /* 备选·礼盒 */
  gift: [{ tag: 'g', children: [{ tag: 'rect', attrs: { x: 4, y: 10, width: 16, height: 10, rx: 1.5 } }, { tag: 'path', attrs: { d: 'M12 10v10M4 10h16M12 10s-3.5-.4-4.5-2.5C8.6 5.6 10 4 11.2 4c1.5 0 1.8 2 .8 6zM12 10s3.5-.4 4.5-2.5C17.4 5.6 16 4 14.8 4c-1.5 0-1.8 2-.8 6' } }] }],
  /* 备选·星标 */
  star: [{ tag: 'path', attrs: { d: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8-5.3-2.9-5.3 2.9 1.1-5.8L3.5 9.7l5.9-.8z' } }],
};
