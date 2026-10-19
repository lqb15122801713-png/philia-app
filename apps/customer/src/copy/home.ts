/**
 * 首页域文案键表：Banner、服务进度、主副入口、会员条、精选、活动、守护故事与 PWA 安装引导；
 * 旧首页历史键暂作兼容保留，清理另册登记。端口值优先，码内默认值回退。
 */

import { withCopyOverrides } from '@philia/shared';

const HOME_COPY_TABLE = {
  'home.liveTag': '服务进行中',
  'home.liveEta': '预计 {time} 完成',
  'home.liveViewAll': '查看全程 ›',
  'home.preprowTitle': '消毒备台 · 一客一消',
  'home.preprowDoneAt': '{time} 已完成',
  'home.preprowDone': '已完成',
  'home.idFallback': '微光',
  'home.rebateLabel': '回馈金',
  'home.idJoin': '开通会员 ›',
  'home.memberCode': '会员码',
  'home.entryGrooming': '预约洗澡美容',
  'home.entryBoarding': '预约寄养',
  'home.entryBoardingNote': '按晚 · 疫苗核验',
  'home.ringPeriod': '本期已攒回馈金 · 周期 {start} – {end}',
  'home.ringArrive': '{month} 月 {day} 日到账',
  'home.ringRule': '买商品的 {pct}%，次月回到这里。',
  'home.rebateLedger': '回馈金账本',
  'home.openMemberClaim': '开通会员，买商品返回馈金',
  'home.rebateBalanceLine': '余额 {amt} · 每月 {day} 日到账',
  'home.openMemberSub': '付费档返 {pcts}%，次月到账',
  'home.casesTitle': '店里今天的故事',
  'home.casesMore': '每日更新 ›',
  'home.caseTitle': '{pet}的{service}日记',
  'home.passStripPre': '次卡共剩 ',
  'home.passStripPost': ' 次 · 到店出示会员码',
  'home.statsDays': '陪伴天数',
  'home.statsServices': '服务次数',
  'home.statsSpend': '累计消费',
  'home.petsTitle': '我的毛孩子',
  'home.petsEmpty': '还没有毛孩子档案，去添加 TA 吧',
  'home.petsLoadFail': '毛孩子加载失败',
  'home.panelEntryTitle': '预约洗护',
  'home.panelEntrySub': '选择门店、服务和时间',

  'home.bannerAlt': '首页品牌横幅',
  'home.bannerSeason': '秋季洗护季',
  'home.bannerSub': '满减进行中 · {store}可用',
  'home.bannerCta': '立即预约',
  'home.storeFallback': '附近门店',
  'home.petFallback': '爱宠',
  'home.serviceFallback': '洗护',
  'home.pickup': '到店领',
  'home.serviceSyncing': '当前步骤同步中',
  'home.currentStep': '当前：{step}',
  'home.primaryGrooming': '洗护预约',
  'home.primaryGroomingSub': '到店洗护',
  'home.primaryBoarding': '寄养',
  'home.primaryBoardingSub': '日托／过夜',
  'home.primaryMall': '商城',
  'home.primaryMallSub': '精选好物',
  'home.coupons': '券包',
  'home.groupbuy': '团购',
  'home.store': '门店',
  'home.featuredTitle': '精选服务',
  'home.featuredGrooming': '秋日洗护套餐',
  'home.featuredGroomingSub': '含洗澡·吹干·基础护理',
  'home.featuredBoarding': '日托寄养',
  'home.featuredBoardingSub': '专业看护·视频同步',
  'home.featuredServiceGeneric': '门店精选服务',
  'home.goBooking': '去预约',
  'home.activityLead': '回馈金加码 · 洗护满减叠加',
  'home.activityLimited': '限时',
  'home.activityView': '查看',
  'home.activityStore': '门店礼遇',
  'home.activityStoreSub': '到店首单洗护赠基础护理',
  'home.activityClaim': '立即领取',
  'home.activityDraw': '回馈抽奖',
  'home.activityDrawSub': '积分换好礼',
  'home.activityCoupons': '券包市集',
  'home.activityCouponsSub': '叠加更划算',
  'home.storiesTitle': '菲利亚守护每一天',
  'home.storyMember': '会员体系',
  'home.storyMemberSub': '银卡起阶 · 回馈金与专属礼遇',
  'home.storyCare': '洗护 · 消毒洁净',
  'home.storyCareSub': '每一步可追溯 · 让毛孩子安心',
  'home.serviceLiveTag': '服务进行中',
  'home.memberTierFallback': '微光',
  'home.memberCodeAction': '会员码',

  'home.pwaInstallTitle': '把菲丽亚装到主屏',
  'home.pwaInstallAction': '安装',
  'home.pwaInstallDismiss': '暂不',
  'home.pwaInstallIosGuide': '用 Safari 分享 → 添加到主屏幕',
  'home.slotPreviewBadge': '预览中',
} as const;

export const HOME_COPY = withCopyOverrides(HOME_COPY_TABLE);

export type HomeCopyKey = keyof typeof HOME_COPY;

export function hc(key: HomeCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = HOME_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
