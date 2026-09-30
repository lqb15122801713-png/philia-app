/**
 * 薪资提成域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：薪资域说明文（口径注脚/绩效池说明/扣减口径/快照说明）与空态一律经本表取值，
 * 组件内零硬编码；文案端口建成后迁移为后台可改——本表即端口 schema 的种子键集，
 * 键名小写点分、冻结不改。
 *
 * 数值不进本表：金额/比例/系数/版本号到渲染层读端口插值（JSX 内 u1-num 片段，
 * 键只持静态 Lead/Tail 碎片，同 me.ts 纪律）。
 * 不抽：区块题（服务提成/绩效/扣减记录/历史月份）、状态签（已结算/超产能…）、
 * server 下发文案（policyNote/cardNote/perf.note）、通用 UI 词（重新加载）。
 */

export const PAY_COPY = {
  /* ---- 分列空态 ---- */
  'pay.empty.service': '本月暂无服务计提单',
  'pay.empty.product': '本月暂无商品计提单',
  'pay.empty.default': '本月暂无此类计提单',

  /* ---- 本月合计卡 / 绩效区说明 ---- */
  'pay.probation.note': '试用期：商品/售卡类提成 ×50%',
  'pay.pool.groomer': '美容师绩效池（本人操作洗美营收·门市价）',
  'pay.pool.frontdesk': '前台绩效池（本人接待归属洗美营收·门市价）',
  'pay.perf.estimateLead': '预估绩效（基数 ×',
  'pay.perf.estimateTail': '× 系数，季度发放）',
  'pay.perf.noGrade': '本季尚未评级，评级后核算应付绩效',

  /* ---- 扣减记录 ---- */
  'pay.deductions.empty': '本月无扣减',
  'pay.deductions.note': '扣减只扣绩效，不扣提成',

  /* ---- 历史快照 ---- */
  'pay.history.empty': '暂无历史快照——每月结算后自动生成',
  'pay.history.note': '已快照月份按冻结口径展示，冲减差额进当月调整项',

  /* ---- 页脚口径 ---- */
  'pay.footer.lead': '仅本人可见 · 规则版本',
} as const;

export type PayCopyKey = keyof typeof PAY_COPY;
