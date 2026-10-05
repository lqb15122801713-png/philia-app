/**
 * 服务执行域文案键表（copy key 一期硬约定 · 换皮批片 5 C 块）
 *
 * 纪律：执行页异常态/引导态题+说明一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 入键位置=GuidePage 调用方（GuidePage 的 title/description 为 props，组件本身不改）。
 * 不抽：通用 UI 词（返回任务台/重试）、server 错误透传、六步轨道步名（冻结，走 STEP_NAME）、
 * 吸底主钮随态文案（操作反馈）。
 *
 * 补缺大批片 4：增 exec.report* 组——第六步「美容报告卡」附加段全部文案
 * （卡题/体征五项 label/三态 label/note 与建议 placeholder/送达承诺句/体重未登记兜底）。
 */

import { withCopyOverrides } from '@philia/shared';

const EXECUTE_COPY_TABLE = {
  /* ---- 守卫/异常引导页（GuidePage 调用侧） ---- */
  'execute.guide.forbidden.title': '无法执行该预约',
  'execute.guide.forbidden.desc': '该预约未指派给你，或不属于本店（非本人单）',
  'execute.guide.notFound.title': '预约不存在',
  'execute.guide.notFound.desc': '可能已被取消或删除',
  'execute.guide.loadFailed.title': '加载失败',
  'execute.guide.boarding.title': '这是寄养预约',
  'execute.guide.boarding.desc': '寄养服务请走入住登记流程',
  'execute.guide.boarding.action': '前往入住登记',
  'execute.guide.notCheckedIn.title': '该预约尚未核销',
  'execute.guide.notCheckedIn.desc': '请先在任务台核销到店，再开始服务',
  'execute.guide.completed.title': '服务已完成',
  'execute.guide.completed.desc': '该预约的六步服务已全部完成',
  'execute.guide.cancelled.title': '预约已取消',
  'execute.guide.cancelRequested.title': '取消审核中',
  'execute.guide.cancelled.desc': '如有疑问请联系商家',
  'execute.guide.notInitialized.title': '六步服务流未初始化',
  'execute.guide.notInitialized.desc': '请重新核销或联系商家处理',

  /* ---- /execute/current 兼容入口空引导 ---- */
  'execute.guide.noCurrent.title': '当前没有进行中的服务',
  'execute.guide.noCurrent.desc': '到任务台核销客户预约码后，即可开始服务执行',
  'execute.guide.noCurrent.action': '回到任务台',

  /* ---- 补缺大批片 4 · 第六步「美容报告卡」（附加段；未动不传参=server 缺省口径） ---- */
  'exec.report.title': '美容报告（随完成同步家长）',
  'exec.report.delivery': '完成后，报告将在 30 分钟内送达家长',
  'exec.report.vital.weight': '体重',
  'exec.report.vital.skin': '皮肤',
  'exec.report.vital.ear': '耳朵',
  'exec.report.vital.coat': '被毛',
  'exec.report.vital.nail': '指甲',
  'exec.report.status.normal': '正常',
  'exec.report.status.attention': '注意',
  'exec.report.status.abnormal': '异常',
  'exec.report.weight.empty': '档案未登记',
  'exec.report.note.placeholder': '补充一句情况说明（选填）',
  'exec.report.advice.label': '下次建议（选填）',
  'exec.report.advice.placeholder': '如：两周后建议复查耳道',

  /* ---- 片 3 B5-2：拍照只许现场拍（诚实口径注记：服务端校验拍摄时刻，不吹「防住」） ---- */
  'exec.photo.onsiteNote': '照片须现场拍摄（服务端校验拍摄时刻），相册旧图将被拒收或标记',

  /* ---- 片 3 B5-3：中途退出记忆续做（暂存仅本机，明面注记） ---- */
  'exec.draft.banner': '检测到上次未提交的填写（{time} 暂存）',
  'exec.draft.restore': '继续上次填写',
  'exec.draft.discard': '丢弃',
  'exec.draft.localNote': '暂存仅保存在本机，换设备或清缓存不保留',
} as const;

export const EXECUTE_COPY = withCopyOverrides(EXECUTE_COPY_TABLE);

export type ExecuteCopyKey = keyof typeof EXECUTE_COPY;
