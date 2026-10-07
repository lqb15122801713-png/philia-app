/**
 * 规则配置域文案键表（copy key 一期硬约定 · 纪律照 apps/customer/src/components/member/copy.ts）
 *
 * 覆盖：RulesConfigPage（五域说明文 = 域分区 notice × 3 + 重确认警示 × 5 + 口径小字）。
 * 纪律：经营性文案（屏题副题/域说明文/危险操作警示/口径明面）一律经本表取值，
 * 组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 * 数值不进本表：版本号/条数等到渲染层读数据经 {var} 插值。
 */

import { withCopyOverrides } from '@philia/shared';

const RULES_COPY_TABLE = {
  'rules.pageTitle': '规则配置管理',
  'rules.pageSub': '提成与 XP 全参数 · 页面可改 · 保存即生效 · 每次修改留痕版本化',
  'rules.guideTitle': '规则配置仅店主可用',
  'rules.guideHint': '提成与 XP 参数的调整入口只对店主开放。',
  'rules.errorHint': '仅店主可读取规则配置；请确认登录态后重试',

  /* ---- 五域说明文（域分区顶部小字；commission/xp 两域无 notice——留白即口径） ---- */
  'rules.noticeDuration':
    '占位待供给——当前为引擎占位值照转，老板完整供给表到后在此直接改值，保存即生效、不回溯既有单据。',
  'rules.noticeMemberPlans':
    '档位/价格/回馈金比例/服务折扣/多宠规则老板可调，保存即生效、新规只管新单（不回溯既有会员与单据）。',
  'rules.noticeRefund':
    '店长可办退款的累计阈值（超过须店主审批）与超阈值留口开关（默认关=维持硬拒）。保存即生效、只管新单不回溯；开关属流程留口，改动前先与产品侧对齐口径。',

  /* ---- 危险操作 D 套（重确认警示分域：各域只说自己的影响面） ---- */
  'rules.confirmTitle': '确认保存规则修改',
  'rules.confirmDanger': '危险操作：保存后立即生效，{warn}。新规只约束生效后的单，不回溯历史月份与已快照数据。',
  'rules.warnCommission': '影响全员提成与绩效核算',
  'rules.warnXp': '影响全员 XP 核算',
  'rules.warnDuration': '影响预约引擎时长与可约槽位',
  'rules.warnMemberPlans': '影响会员档权益与新售卡结算',
  'rules.warnRefund': '影响退款审批闸门与超阈值口径',
  'rules.confirmPhrase': '确认保存',
  'rules.confirmHint': '防误触：口令与按钮双重确认',

  /* ---- 口径小字 + 留痕区 ---- */
  'rules.caliberNote':
    '小字口径：规则保存即生效；新规只约束生效后的单，不回溯历史月份与已快照数据。本页仅店主可见可改，每次修改全留痕。',
  'rules.versionsAside': '谁 / 何时 / 前后值（最近 20 条）',
  'rules.versionsEmpty': '暂无修改记录（当前为初始种子版本）',
  'rules.discountHint': '按百分比填写：88 折 = 88%',
  'rules.splitNote': '合计须为 100%',

  /* ---- 端口批收尾片 1：件 6 规则搜索 / 件 7 逐参数帮助 ---- */
  'rules.searchPlaceholder': '搜索规则（键名 / 名称 / 帮助注）',
  'rules.searchEmpty': '无匹配规则',
  'rules.searchEmptyHint': '换个关键词试试（按规则键名、名称、帮助注过滤）',

  /* ---- 端口批收尾片 1：件 2 定时生效 ---- */
  'rules.scheduledBadge': '待生效 {time}',
  'rules.scheduledRowNote': '定时 v{version} · {time}',
  'rules.scheduledCancel': '撤销',
  'rules.scheduledCancelDone': '已撤销定时生效登记',
  'rules.effectiveSectionTitle': '定时生效（可选）',
  'rules.effectiveAtLabel': '生效时刻',
  'rules.effectiveAtHint': '留空=保存即生效；填写未来时刻=到点自动生效（登记后可撤销）',
  'rules.scheduledSaveDone': '已登记定时生效 {time}',

  /* ---- 端口批收尾片 1：件 1 配置回滚时间轴 ---- */
  'rules.historyToggle': '历史',
  'rules.historyActiveBadge': '生效中',
  'rules.rollbackBtn': '回到此版',
  'rules.rollbackConfirm': '回滚立即生效：{label} 回到 v{version}？（历史版本不动，新增回滚版本留痕）',
  'rules.rollbackDone': '已回滚到 v{version} 并立即生效',

  /* ---- 端口批收尾片 1：件 3 涉钱二级审批 ---- */
  'rules.moneyBadge': '涉钱',
  'rules.inApprovalBadge': '审批中',
  'rules.proposeOpen': '提交审批',
  'rules.reviewSave': '复核并保存',
  'rules.saveBarMoneyNote': '（含涉钱键 {n} 项须二级审批）',
  'rules.errorFixFirst': '有参数格式不正确，请先修正标红项',
  'rules.proposeDone': '已提交审批，复核通过才生效',
  'rules.proposeMixedNote': '涉钱键已提交审批（复核通过才生效）；其余键请继续确认后直接保存生效',
  'rules.approvalsTitle': '配置审批',
  'rules.approvalsAside': '涉钱参数二级审批 · 复核通过才生效',
  'rules.approvalsEmpty': '暂无配置审批单',
  'rules.approvalsError': '审批单加载失败',
  'rules.approvalStatusPending': '待复核',
  'rules.approvalStatusApproved': '已通过',
  'rules.approvalStatusRejected': '已驳回',
  'rules.approveBtn': '通过',
  'rules.rejectBtn': '驳回',
  'rules.approveConfirm': '确认通过并立即应用该变更？',
  'rules.approveDone': '已通过并生效（版本 v{version}）',
  'rules.rejectNotePrompt': '请输入驳回原因（必填）',
  'rules.rejectNoteRequired': '驳回原因不能为空',
  'rules.rejectDone': '已驳回',
  'rules.changeBefore': '现值',
  'rules.changeAfter': '改为',
} as const;

export const RULES_COPY = withCopyOverrides(RULES_COPY_TABLE);

export type RulesCopyKey = keyof typeof RULES_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function rc(key: RulesCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = RULES_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/* ------------------------------------------------------------------ */
/* 参数帮助注键表（端口批收尾片 1 · 件 7；cfghelp.* 八键）                  */
/* 独立表：不进 RULES_COPY_TABLE、不经 rc() 使用——server 端读口件            */
/* （configRules composeHelpText 覆盖源：config.list 行 helpText /          */
/*  config.dictionary 帮助注；文案端口可改=留口件）。                        */
/* 导出 CFGHELP_COPY（_COPY 后缀）供种子生成器收集进键宇宙。                 */
/* ------------------------------------------------------------------ */

const CFGHELP_COPY_TABLE = {
  'cfghelp.pay_timeout_minutes': '支付超时关单时长：paying 单超 N 分钟未支付自动关单（在途单按创建时快照不回溯）',
  'cfghelp.pay_channel_enabled':
    '线上支付通道开关：关=客户端 createOrder 拒单（内测 mock 通道；kill switch 开时本键被强制回落为关）',
  'cfghelp.plan_yinghuo': '萤火档会员价费配置：年费/回馈金比例/服务折扣/含宠数（涉钱参数，二级审批生效）',
  'cfghelp.refund_threshold_fen': '退款店长阈值（分）：超阈值退款单须店主审批（涉钱参数）',
  'cfghelp.commission_grooming_rate': '美容服务提成率（万分比）：新单按生效时版本计提（涉钱参数）',
  'cfghelp.xp_daily_cap': 'XP 日上限：单员工单日 XP 封顶（防刷口径）',
  'cfghelp.duration_base_min': '时长基础分钟：服务时长基准值（时长系数域单源）',
  'cfghelp.config_kill_switch': '全局一键开关：开=可关参数瞬时回落安全值（当前=线上支付通道关）；页面显著红态',
} as const;

export const CFGHELP_COPY = withCopyOverrides(CFGHELP_COPY_TABLE);
