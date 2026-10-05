/**
 * 协议中心（agreements）域文案键表（客户端体验大批 片 1 · copy key 一期硬约定，
 * 纪律同 copy/pay.ts 的 PAY_AGREEMENTS 工艺：标题入键表、全文走独立导出件）
 *
 * 覆盖：AgreementsPage /settings/agreements（四件协议列表 + 点开全文）。
 * - 会员服务协议：读 copy/pay.ts PAY_AGREEMENTS 同源件（member_service，版本同源）；
 * - 用户协议 / 隐私政策 / 寄养协议：内测期简版诚实文本（AGR_DOCS），不虚构条款，
 *   明面注记「内测期简版，正式条款以上线版本与门店公示为准」。
 */

import { withCopyOverrides } from '@philia/shared';

const AGREEMENTS_COPY_TABLE = {
  /* ---- 协议中心 /settings/agreements ---- */
  'agr.pushLabel': 'AGREEMENTS',
  'agr.title': '协议中心',
  'agr.version': '版本 {version}',
  /* 内测期简版明面注记（诚实口径：不虚构条款） */
  'agr.betaMark': '内测期简版',
  'agr.betaNote': '本协议为内测期简版文本，正式条款以上线版本与门店公示为准。',
  'agr.user': '《用户协议》',
  'agr.privacy': '《隐私政策》',
  'agr.memberService': '《会员服务协议》',
  'agr.boarding': '《寄养协议》',
} as const;

export const AGREEMENTS_COPY = withCopyOverrides(AGREEMENTS_COPY_TABLE);

export type AgreementsCopyKey = keyof typeof AGREEMENTS_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function agc(key: AgreementsCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = AGREEMENTS_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/* ------------------------------------------------------------------ */
/* 内测期简版协议三件（用户协议 / 隐私政策 / 寄养协议；会员服务协议读         */
/* copy/pay.ts PAY_AGREEMENTS 同源件，本件不重复收录）。                     */
/* 诚实口径：只写内测期真实成立的口径，不虚构条款；全文以 \n 分段。           */
/* ------------------------------------------------------------------ */

export type BetaAgreementKey = 'user' | 'privacy' | 'boarding';

export interface BetaAgreement {
  agreementKey: BetaAgreementKey;
  /** 版本号（文案修订即升版） */
  version: string;
  /** 展示名（本表 copy 键） */
  titleKey: AgreementsCopyKey;
  /** 协议全文（内测期简版诚实文本，非占位符；\n 分段） */
  content: string;
}

export const AGR_DOCS: readonly BetaAgreement[] = [
  {
    agreementKey: 'user',
    version: 'v0.1-beta',
    titleKey: 'agr.user',
    content: `一、服务范围：内测期间，本应用提供宠物洗护、寄养预约与商城下单的线上入口，实际服务由线下门店履约，服务内容、价格与门店公示一致。
二、账号：内测期使用手机号或门店发放的种子账号登录；请妥善保管登录状态，账号仅限本人使用。
三、交易：线上支付通道为内测演示通道，不产生真实扣款；真实消费以门店收银与订单记录为准。
四、变更与终止：内测期功能与规则可能调整，调整以应用内公告与门店公示为准；您可随时停止使用并申请注销账号。
五、其他：本协议为内测期简版文本，未尽事宜以门店公示规则为准；正式上线版本协议发布后，以新版本为准。`,
  },
  {
    agreementKey: 'privacy',
    version: 'v0.1-beta',
    titleKey: 'agr.privacy',
    content: `一、我们收集什么：手机号（登录与找回账号）、昵称/头像/生日/性别（个人资料，可选填）、收货地址与发票抬头（履约所需）、预约与订单记录（服务留痕）。
二、用于什么：仅用于登录鉴权、预约履约、订单履约与服务通知；不出售、不共享给无关第三方。
三、权限：消息通知与定位为可选权限，可在「设置 · 权限与隐私」随时关闭；营销类通知可单独关闭，交易/服务/账户通知为保障服务履约不可关闭。拒绝授权不影响基本功能使用（《个人信息保护法》最小必要口径）。
四、留存：订单与服务留痕依法保留；注销账号后个人资料删除，留痕记录按法规期限保留。
五、其他：本政策为内测期简版文本，正式政策以上线版本为准。`,
  },
  {
    agreementKey: 'boarding',
    version: 'v0.1-beta',
    titleKey: 'agr.boarding',
    content: `一、服务内容：寄养按晚计费，房型与价格以预约页与门店公示为准；寄养期间门店按约定频次照护并记录过程。
二、入住条件：宠物须完成门店要求的疫苗与驱虫核验，健康异常或具攻击性的宠物门店有权拒收或中止寄养。
三、押金：寄养可能收取押金，押金收取与退还由门店登记留痕，进度以「消费记录 · 押金进度」页为准。
四、风险告知：寄养期间如宠物突发疾病，门店将第一时间联系您并按您的指示处理；紧急情况下门店可先送医再通知，费用按门店公示口径结算。
五、其他：本协议为内测期简版文本，具体照护细则以门店现场签署的寄养单与公示为准。`,
  },
] as const;
