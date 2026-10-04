/**
 * 薪资提成域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：薪资域说明文（口径注脚/绩效池说明/扣减口径/快照说明）与空态一律经本表取值，
 * 组件内零硬编码；文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：金额/比例/系数/版本号到渲染层读端口插值（JSX 内 mono 片段，
 * 键只持静态 Lead/Tail 碎片，同 me.ts 纪律）。
 * 骨架批片 1（S-05）：区块题/状态签/通用 UI 词已随骨架帧抽键（pay.sec·pay.line·pay.retry 等族）；
 * 不抽：server 下发文案（policyNote/cardNote/perf.note）。
 */

import { withCopyOverrides } from '@philia/shared';

const PAY_COPY_TABLE = {
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

  /* ---- 骨架帧（S-05：backbar + 大数字卡 mono34+trio 分项） ---- */
  'pay.title': '薪资提成',
  'pay.aside.frozen': '已快照冻结',
  'pay.aside.realtime': '实时计算',
  'pay.total.label': '本月提成合计',
  'pay.trio.service': '服务',
  'pay.trio.card': '售卡',
  'pay.trio.product': '商品',

  /* ---- 加载/失败 ---- */
  'pay.load.fail': '薪资提成加载失败，请检查网络后重试',
  'pay.retry': '重新加载',

  /* ---- 区块题（S7 明细分组） ---- */
  'pay.sec.service': '服务提成',
  'pay.sec.card': '售卡提成',
  'pay.sec.product': '商品提成',
  'pay.sec.store': '全店提成',
  'pay.sec.perf': '绩效',
  'pay.sec.deductions': '扣减记录',
  'pay.sec.history': '历史月份',
  'pay.sec.subtotal': '小计',

  /* ---- 计提行 ---- */
  'pay.line.billNo': '单号',
  'pay.line.pending': '超产能·待店长批准',
  'pay.line.overwork': '超产能·1.5 倍已批准',
  'pay.line.probation': '试用期 ×50%',
  'pay.line.base': '基数',

  /* ---- 绩效格 ---- */
  'pay.perf.quarterTail': '季度',
  'pay.perf.base': '当季基数',
  'pay.perf.grade': '档位',
  'pay.perf.coeff': '系数',
  'pay.perf.na': '试用期不设绩效与全勤',

  /* ---- 扣减行 ---- */
  'pay.deductions.creatorLead': '录入人',

  /* ---- 历史快照行 ---- */
  'pay.history.kind.commission': '提成月结',
  'pay.history.kind.perf': '绩效季结',
  'pay.history.settled': '已结算',
  'pay.history.quarterTag': '季度绩效快照',
  'pay.history.loading': '快照明细加载中…',
  'pay.history.fail': '明细加载失败，请稍后重试',
  'pay.history.expand': '展开',
  'pay.snap.service': '服务',
  'pay.snap.product': '商品',
  'pay.snap.store': '全店',
  'pay.snap.commission': '提成合计',
  'pay.snap.perf': '绩效应付',
} as const;

export const PAY_COPY = withCopyOverrides(PAY_COPY_TABLE);

export type PayCopyKey = keyof typeof PAY_COPY;
