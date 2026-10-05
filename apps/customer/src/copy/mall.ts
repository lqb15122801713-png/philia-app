/**
 * 商城域文案键表（copy key 一期硬约定 · 纪律同 components/member/copy.ts）
 *
 * 纪律：商城域界面文案（屏题/空态/CTA/提示）一律经本表取值，组件内零硬编码；
 * 文案端口已落（端口批片 B）：本表经 withCopyOverrides 代理——端口值优先、码内默认 fallback。
 *
 * 数值不进本表：价格/比例/折扣等到渲染层读端口插值。
 */

import { withCopyOverrides } from '@philia/shared';

const MALL_COPY_TABLE = {
  /* ---- 商品订单 /mall/orders（换皮批片 5 · UX 片 2 走查 P2 群：空态错配购物车文案，
     改订单系三句话——题（是什么）/说明（为什么）/出口（去哪→服务预约入口 /booking）） ---- */
  'mall.orders.emptyTitle': '还没有订单',
  'mall.orders.emptyBody': '下单的商品和进度都会在这里',
  'mall.orders.emptyCta': '去看看服务 ›',

  /* ---- 商城首页 /mall（M-01 定稿） ---- */
  'mall.headTitle': '商城',
  'mall.headSub': 'MALL · 给它买点好的',
  /* 配送条槽位（PD-15 V1.1 槽位 13：置灰不上假时效，留口注记） */
  'mall.deliveryTitle': '配送至 · ——',
  'mall.deliverySub': '配送时效 · 即将点亮',
  'mall.searchPlaceholder': '搜索主粮、零食、玩具…',
  /* 空态三句话（搜索/分类两口径） */
  'mall.emptyTitle': '没有找到相关商品',
  'mall.emptyBodyKeyword': '换个关键词试试，或看看其他分类',
  'mall.emptyBodyCategory': '这个分类暂时没有商品，看看别的吧',
  'mall.emptyClearSearch': '清空搜索',
  'mall.loadFail': '商品加载失败，请稍后重试',
  'mall.pullMore': '上拉加载更多',
  'mall.endLine': '共 {total} 件商品 · 到底啦',
  /* 商品卡（M-01：回馈金返显 mono 8.5 + 售罄签） */
  'mall.rebateLine': '返 {amt} 回馈金',
  'mall.soldOut': '已售罄',
  /* 跨店加车确认（MallPage/PDP 同链路） */
  'mall.conflictTitle': '购物车仅限同一门店商品',
  'mall.conflictBody': '购物车内已有「{store}」的商品，加入本商品将清空原购物车。',
  'mall.conflictOk': '清空并加入',

  /* ---- 商品详情 /mall/product/:id（M-02 定稿） ---- */
  'mall.pdpBackMall': '返回商城',
  'mall.pdpStoreLine': '{store} · 门店同价 · 正品保障',
  'mall.pdpStockLeft': '仅剩 {n} 件',
  'mall.pdpDetailTitle': '商品详情',
  'mall.pdpAddCart': '加入购物袋',
  'mall.pdpBuyNow': '立即购买',

  /* ---- 购物袋 /mall/cart（M-03 定稿） ---- */
  'mall.cartTitle': '购物袋',
  'mall.cartEmptyTitle': '购物袋还空着呢',
  'mall.cartEmptyBody': 'philia 帮你看着货架，\n门店同款好物都在商城里',
  'mall.cartEmptyCta': '去逛逛 ›',
  /* 单店限制提示（规则明面） */
  'mall.cartStoreNote': '当前为「{store}」的商品 · 一次下单仅支持同一门店',
  'mall.cartCheckout': '去结算',

  /* ---- 确认订单 /mall/checkout ---- */
  'mall.checkoutTitle': '确认订单',
  /* 支付成功页（W1-D1 同构：单据摘要 + 双出口） */
  'mall.paySuccessTitle': '支付成功',
  'mall.paySuccessSub': '门店会尽快为你发货，进度可在订单列表查看',
  'mall.viewOrders': '查看订单',
  'mall.backHome': '返回首页',
  'mall.keepShopping': '再逛逛商城 ›',
  /* 无商品来源空态三句话 */
  'mall.checkoutEmptyTitle': '没有待结算的商品',
  'mall.checkoutEmptyBody': '去商城挑点好物，或回购物袋勾选商品',
  'mall.checkoutGoMall': '去逛逛',
  'mall.checkoutGoCart': '回购物袋',
  'mall.listShip': '{store} · 门店发货',
  'mall.priceNote': '金额以提交时门店现价为准',
  'mall.submitOrder': '提交订单',

  /* ---- 客户端体验大批 片 3：结算配送方式（createOrder 入参 deliveryMethod；
     pickup/same_city 时地址非必填 + 内测期免运费注记） ---- */
  'mall.deliveryMethod': '配送方式',
  'mall.deliveryExpress': '快递',
  'mall.deliverySameCity': '同城',
  'mall.deliveryPickup': '自提',
  'mall.deliveryFreeNote': '内测期免运费',
  'mall.addrOptionalNote': '自提 / 同城可暂不填收货地址，到店报手机号即可',
  /* 结算「可用券推荐」区（availableCoupons 按门槛过滤；核销=登记抵扣口径注记） */
  'mall.couponTitle': '可用券',
  'mall.couponUseNote': '核销=登记抵扣，线下结算时出示',
  'mall.couponPick': '选用',
  'mall.couponPicked': '已选 · 登记抵扣',
  'mall.couponOff': '减 {amt}',

  /* ---- 客户端体验大批 片 3：订单卡配送方式徽 + 物流注记 + 写评价入口 ---- */
  'mall.trackingNote': '轨迹以快递公司为准',

  /* ---- 商品订单 /mall/orders（页面与订单卡） ---- */
  'mall.ordersTitle': '商品订单',
  'mall.ordersLoadFail': '订单加载失败，请稍后重试',
  'mall.ordersTabEmpty': '暂无{tab}的订单',
  'mall.orderPreparing': '门店正在备货，请耐心等待',
  'mall.orderReceived': '已于 {time} 确认收货',
  'mall.orderSumLine': '共 {qty} 件，合计',
  'mall.goPay': '去支付',
  'mall.confirmReceive': '确认收货',
  'mall.reorder': '再来一单',
  /* 二次确认弹层 */
  'mall.receiveConfirmTitle': '确认已收到商品？',
  'mall.receiveConfirmBody': '确认后订单将转为已完成，请确保商品已完好送达。',
  'mall.cancelConfirmTitle': '取消该订单？',
  'mall.cancelConfirmBody': '取消后库存将释放，订单不可恢复。',
} as const;

export const MALL_COPY = withCopyOverrides(MALL_COPY_TABLE);

export type MallCopyKey = keyof typeof MALL_COPY;

/** 文案键取值 + 占位插值（{var}）；插值参数全部来自端口/数据，不经本表硬编码 */
export function mlc(key: MallCopyKey, vars?: Record<string, string | number>): string {
  const tpl: string = MALL_COPY[key];
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

