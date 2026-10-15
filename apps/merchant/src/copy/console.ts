/**
 * 商家端骨架批文案键表（商家端控制台骨架批 · 片 5 段 0 · 地基段）
 * 依据=UX-02 两端定稿语言包 V1.1 §一.4（rail 十五口冻结+dock 五槽）+§二 M1–M8 构件册。
 * 纪律：键名小写点分、as const 冻结、文案端口已落（withCopyOverrides 代理——端口值优先、码内默认 fallback）。
 * 键族：wnav.*=rail 十五口（产品-1015 换皮 片0：回归 READY §3 MerchantRail15——经营6/商城3/管理6，
 *   排班/薪资/XP 审核三口下轨、键保留）+foot+dock 五槽；wsk.*=M 件族骨架通用件。
 * 新键随批注册进 copy_overrides（生成器重跑+迁移申报）。
 */

import { withCopyOverrides } from '@philia/shared';

const CONSOLE_COPY_TABLE = {
  /* ---- wnav rail 分组签（十五口冻结：经营 6 / 商城 3 / 管理 6 + foot） ---- */
  'wnav.groupOps': '经营',
  'wnav.groupMall': '商城',
  'wnav.groupAdmin': '管理',

  /* ---- wnav rail 十五口（UX-08 §一 逐字；片0 回归 Ready §3 MerchantRail15） ---- */
  'wnav.overview': '总览·驾驶舱',
  'wnav.appts': '门店端·预约',
  'wnav.boarding': '寄养',
  'wnav.cashier': '收银台',
  'wnav.close': '日结',
  'wnav.refunds': '退款',
  'wnav.orders': '商城订单',
  'wnav.products': '商品',
  'wnav.pass': '会员·次卡',
  'wnav.staff': '员工',
  'wnav.ops': '运营 · 审批中心',
  'wnav.monitor': '监控 Hub',
  'wnav.finance': '报表',
  'wnav.matrix': '权限矩阵',
  'wnav.settings': '门店档案·设置',

  /* ---- wnav 管理组下轨三口（片0：排班/薪资/XP 审核出 rail；键保留——页面可直达，
      端口行仍在册，恢复上轨=新裁定） ---- */
  'wnav.schedules': '排班',
  'wnav.payroll': '薪资',
  'wnav.xpAdmin': 'XP 审核',

  /* ---- wnav foot 运营后台端（owner-only 三端口收编为其子行；PD-25 D-56 展示改名，CJ-1014-01） ---- */
  'wnav.footConsole': '运营后台端',
  'wnav.footRules': '规则配置',

  /* ---- wnav dock 五槽（片0 回归 Ready §1.D：总览/门店/收银/报表/我的） ---- */
  'wnav.dockOverview': '总览',
  'wnav.dockStore': '门店',
  'wnav.dockCashier': '收银',
  'wnav.dockReport': '报表',
  /* 片0：码内默认回「我的」；运行值注意 copy_overrides 仍有 active 行「设置」（迁移 0049），
     端口值优先——翻牌须产品侧经文案端口/另批迁移（本片零新迁移不动 server） */
  'wnav.dockMe': '我的',

  /* ---- wnav 段 0 占位空态（/matrix /console 锚点稳定文案，段 3 替换） ---- */
  'wnav.placeholderPending': '待段 3 落位',
  'wnav.placeholderBody': '本屏锚点与导航结构段 0 先冻结，内容与交互段 3 落位。',

  /* ---- wsk M2 异常前置卡 ---- */
  'wsk.alertGo': '去处理',
  'wsk.alertEmpty': '当前没有异常',

  /* ---- wsk M4 合计条 ---- */
  'wsk.totalSpark': '近 14 日',

  /* ---- wsk M6 晨报卡 ---- */
  'wsk.postcardEyebrow': 'MORNING POST',
  'wsk.postcardTitle': '晨报。',
  'wsk.postcardMore': '读完整晨报',

  /* ---- wsk M7 账目件 / 容量日历 ---- */
  'wsk.folioTotal': '合计',
  'wsk.capCalLegend': '容量点=已住/容量',
  'wsk.capCalFull': '满',

  /* ---- wsk 红线明面带（W-06 注记四句，钉在收款面板下） ---- */
  'wsk.redlineTitle': '红线明面',
  'wsk.redline1': '无充值入口',
  'wsk.redline2': '年费≠储值',
  'wsk.redline3': '四分列对账',
  'wsk.redline4': '扣次非现金',

  /* ---- wsk 权限矩阵四态格 ---- */
  'wsk.matrixOk': '✓',
  'wsk.matrixNo': '—',
  'wsk.matrixReadonly': '只读',
  'wsk.matrixLocked': '锁死',

  /* ---- wsk M8 发布流 / 留痕 / 危险区 ---- */
  'wsk.pubDraft': '草稿',
  'wsk.pubPreview': '预览',
  'wsk.pubPush': '发布推三端',
  'wsk.pubRollback': '回滚',
  'wsk.logEmpty': '还没有留痕',
  'wsk.dangerTitle': '危险区',

  /* ---- wsk 通用 ---- */
  'wsk.empty': '暂无内容',
} as const;

export const CONSOLE_COPY = withCopyOverrides(CONSOLE_COPY_TABLE);
export type ConsoleCopyKey = keyof typeof CONSOLE_COPY_TABLE;

/** 文案键取值 + {var} 插值（访问器同构各端 copy 件；staff skc 同工艺） */
export function cc(key: ConsoleCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = CONSOLE_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
