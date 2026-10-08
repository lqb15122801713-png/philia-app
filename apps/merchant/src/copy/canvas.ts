/**
 * 画布端口域文案键表（端口批收尾片 3 · B 股 · 商家端 ConsolePage F1 端口）
 *
 * 覆盖：CanvasPortBody（三屏页签 + 左栏块列表[拖拽/显隐/文案/槽位] + 右栏真页预览
 * iframe + 版本时间轴 + 发布/回退两步流）。
 * 纪律：照 copy/rules.ts 工艺——withCopyOverrides 代理（端口值优先、码内默认
 * fallback）、as const 冻结、数值不进表（{var} 插值）、组件内零硬编码。
 */

import { withCopyOverrides } from '@philia/shared';

const CANVAS_COPY_TABLE = {
  /* ---- 端口头 / 红线条 ---- */
  'canvas.title': '画布端口',
  'canvas.aside': '真页区块排序/显隐/文案 · 草稿→发布两步流 · 发布即三端生效',
  'canvas.redline': '区块注册表写死白名单；自由排版不做（装修编辑器=P2 后期件）',

  /* ---- 三屏页签 ---- */
  'canvas.tabHome': '客户端首页',
  'canvas.tabMemberCenter': '会员中心',
  'canvas.tabCashierMarketing': '收银营销位',

  /* ---- 左栏块列表 ---- */
  'canvas.blockListTitle': '区块排列',
  'canvas.blockListAside': '拖拽排序 · 开关显隐 · 文案点保存（预览即变，发布才上线）',
  'canvas.visibleLabel': '显示',
  'canvas.copySave': '保存',
  'canvas.copySaved': '文案已保存（预览已同步）',
  'canvas.copyHighRiskWarn': '高危键：保存即生效三端，须口令复核',
  'canvas.confirmPhrase': '确认保存',
  'canvas.confirmHint': '防误触：口令与按钮双重确认',
  'canvas.slotCurrent': '当前素材',
  'canvas.slotEmpty': '槽位暂无 live 素材（码内默认图兜底）',
  'canvas.slotGoto': '去槽位端口更换 ›',
  'canvas.dirtyBar': '{n} 项未存草稿改动',
  'canvas.resetCta': '重置',

  /* ---- 保存草稿 / 发布 / 回退 ---- */
  'canvas.saveDraft': '保存草稿',
  'canvas.draftSaved': '草稿已保存（v{version}）',
  'canvas.publishCta': '发布',
  'canvas.publishTitle': '确认发布布局',
  'canvas.publishBody': '发布后客户端/收银台真页即生效（v{version}）；旧线上版转归档留痕。',
  'canvas.publishDone': '已发布 v{version}',
  'canvas.publishNoDraft': '当前无草稿版（先「保存草稿」）',
  'canvas.confirmCta': '确认',
  'canvas.cancelCta': '取消',
  'canvas.revertCta': '回退上一版',
  'canvas.revertConfirm': '确认回退到上一版？当前线上版转归档留痕。',
  'canvas.revertDone': '已回退到 v{version}',

  /* ---- 版本时间轴 ---- */
  'canvas.versionsTitle': '版本时间轴',
  'canvas.versionsEmpty': '暂无布局版本（保存草稿即落首版）',
  'canvas.statusDraft': '草稿',
  'canvas.statusPublished': '线上',
  'canvas.statusArchived': '归档',

  /* ---- 通用 ---- */
  'canvas.noStore': '门店未解析（预览店锚缺失，布局读取已跳过）',
  'canvas.loadFail': '画布数据加载失败',
  /* 急修 1008（两问闸①留口）：画布预览端口分端映射表（JSON 串：当前端端口→客户端端口；
     生产实测拓扑=7202 商家/7201 员工→7200 客户；改拓扑零代码——端口值即改即生效）。
     注：本键是结构化配置值（非展示文案），勿加文案修饰词。 */
  'canvas.previewPortMap': '{"7202":"7200","7201":"7200"}',
} as const;

export const CANVAS_COPY = withCopyOverrides(CANVAS_COPY_TABLE);

export type CanvasCopyKey = keyof typeof CANVAS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function cv(key: CanvasCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = CANVAS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
