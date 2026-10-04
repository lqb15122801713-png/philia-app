/**
 * 协议签署（agreement）域文案键表（体验大批片 2 · copy key 一期硬约定，
 * 纪律同 components/member/copy.ts）
 *
 * 覆盖：寄养下单页（BoardingSinglePage）协议勾选行 + 全文弹层、
 * 成功页（BookingSuccessPage）协议签署入口。
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 协议全文走 BOARDING_AGREEMENTS（同 copy/pay.ts 的 PAY_AGREEMENTS 工艺：
 * 全文非字典件不入 copy 端口表，版本号随签署快照留痕 contentVersion）。
 */

import { withCopyOverrides } from '@philia/shared';

const AGREEMENT_COPY_TABLE = {
  /* ---- 协议名（勾选行链接 + 弹层标题共用） ---- */
  'agreement.boarding_consent': '《寄养服务协议》',
  'agreement.medical_auth': '《医疗授权书》',

  /* ---- 勾选行 / 弹层 ---- */
  'agreement.agreeLabel': '我已阅读并同意',
  'agreement.versionNote': '版本 {version}',
  'agreement.agreeCta': '已阅读并同意',
} as const;

export const AGREEMENT_COPY = withCopyOverrides(AGREEMENT_COPY_TABLE);

export type AgreementCopyKey = keyof typeof AGREEMENT_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function agc(key: AgreementCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = AGREEMENT_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/* ------------------------------------------------------------------ */
/* 寄养协议两份（体验大批片 2 · 签署落点=pay.signAgreement（agreements 表快照）：   */
/* 版本对齐服务端常量 config/agreements.ts（v1.0-beta，server 快照以此为准——      */
/* server 存内测简版 content，本表为 UI 阅读正式文本，集成期主窗对齐口径）；       */
/* medical_auth 另随 appointment.create 的 medicalAuth 字段留快照于预约行。      */
/* 口径来源：寄养安全规则明面（疫苗硬校验/紧急联系人/遛弯次数）+ 医疗授权        */
/* 常规要件（授权范围/费用承担/免责边界）。正文不涉禁词表字（自审零命中）。      */
/* ------------------------------------------------------------------ */

export type BoardingAgreementKey = 'boarding_consent' | 'medical_auth';

export interface BoardingAgreement {
  agreementKey: BoardingAgreementKey;
  /** 版本号（随签署快照留痕；文案修订即升版） */
  version: string;
  /** 展示名（copy 键） */
  titleKey: AgreementCopyKey;
  /** 协议全文（真实可读正文，非占位符；\n 分段） */
  content: string;
}

export const BOARDING_AGREEMENTS: readonly BoardingAgreement[] = [
  {
    agreementKey: 'boarding_consent',
    version: 'v1.0-beta',
    titleKey: 'agreement.boarding_consent',
    content: `一、服务内容：本店按您选择的房型与入住/退房日期提供寄养照看服务，包含每日喂食喂水、清洁与基础照看；寄养期间的服务记录（照看日志与照片）可在预约详情实时查看。
二、入住条件：宠物疫苗有效期须覆盖至退房日；请您如实填写宠物健康与性格信息，并提供至少一位紧急联系人，以便特殊情况及时联络。
三、遛弯安排：您可按需填写每日遛弯次数，门店按公示口径执行并记录；极端天气或宠物身体不适时，门店可酌情调整为室内活动并如实记录。
四、健康异常处理：寄养期间如宠物出现明显不适，门店将第一时间联系您与紧急联系人；联系不上且情况紧急时，按《医疗授权书》约定处理。
五、费用与取消：寄养费用按晚计，以门店结算为准；取消规则以预约详情页公示为准，开始前 4 小时以上可免费取消。
六、物品与安全：请勿放置贵重物品于宠物用品中；离店交接时请核对随身物品。因宠物自身原因（打架、挣脱等）造成的意外，门店将尽到看护与及时告知义务，并按实际情况协商处理。
七、明示确认：您勾选本协议并提交预约，即表示已知悉并认可上述寄养服务约定。`,
  },
  {
    agreementKey: 'medical_auth',
    version: 'v1.0-beta',
    titleKey: 'agreement.medical_auth',
    content: `一、授权范围：寄养/服务期间，如宠物突发疾病或意外伤害，且门店无法及时联系到您及紧急联系人时，您授权门店将宠物送往正规动物诊疗机构进行必要的紧急处置。
二、费用承担：紧急医疗处置产生的合理费用由您承担，门店保留诊疗单据与费用凭证，事后向您如实出示。
三、处置边界：本授权仅限维持生命体征与防止伤情恶化的必要紧急处置；非紧急的检查、治疗与手术，门店须事先征得您的明确同意。
四、告知义务：门店在采取紧急处置前后，将尽快通过电话与您及紧急联系人沟通情况，并在服务记录中如实留痕。
五、既往病史：请您在档案与备注中如实填写宠物既往病史、过敏源与在用药物；因隐瞒重要健康信息导致的处置偏差，门店不承担相应责任。
六、授权期限：本授权自您勾选同意之时起生效，覆盖本次寄养/服务全程，服务结束自动失效。
七、明示确认：您勾选本授权书，即表示已阅读全文并同意上述紧急医疗授权安排。`,
  },
] as const;
