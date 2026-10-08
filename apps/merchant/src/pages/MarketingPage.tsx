/**
 * 会员营销 /marketing（商家端大批片 5 · 批内末片）
 * u3-panel 竖排五区（工艺照 InventoryPage）：
 * ①会员标签（tagList 按类/值滤 + 打标弹层 tagSet[upsert 覆盖写]）
 * ②券矩阵（couponList 按六类滤签 + 新建券弹层 couponCreate；类型徽签复用既有 Badge tone）
 * ③定向发放（campaignGrant 弹层[选券/标题/目标类值] + campaignList 台账[已发份数]）
 * ④生日营销（birthdayBoard：tier 配置卡 + upcoming 近 30 天提醒[会员/宠物] + grants 台账）
 * ⑤活动配置（promoList：类型签 + effectiveStatus 状态徽 + 新建/编辑弹层 promoUpsert
 *   [按类型给规则 JSON 简表] + promoStackRules 互斥公示卡[四键当前值+端口可改注]）。
 * 全区 owner|manager（server merchantManagerProcedure 硬闸；页内 canManage 闸门引导页）。
 * 页顶互链「营销台账 →」/marketing-ledger（rail 十九口冻结不改=页面互链口径）。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@philia/shared';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { fmtMoney, yuanToFen } from '../components/mall-admin/format';
import { Badge, Btn, Field, inputCls, Modal, toast, ToasterMount } from '../components/staff-admin/ui';
import { mk } from '../copy/marketing';
import { useMerchantRole } from '../lib/roles';

type Mkt = inferRouterOutputs<AppRouter>['marketing'];
type TagRow = Mkt['tagList'][number];
type CouponRow = Mkt['couponList']['items'][number];
type CampaignRow = Mkt['campaignList'][number];
type BdayBoard = Mkt['birthdayBoard'];
type UpcomingRow = BdayBoard['upcoming'][number];
type GrantRow = BdayBoard['grants'][number];
type PromoRow = Mkt['promoList']['items'][number];

type TagKind = 'species' | 'size' | 'pref';
type CouponType = 'register' | 'recharge' | 'consume' | 'birthday' | 'festival' | 'wakeup';
type PromoType = 'full_minus' | 'discount' | 'second_piece' | 'exchange_gift' | 'time_promo';

const TAG_KINDS: readonly TagKind[] = ['species', 'size', 'pref'];
const COUPON_TYPES: readonly CouponType[] = ['register', 'recharge', 'consume', 'birthday', 'festival', 'wakeup'];
const PROMO_TYPES: readonly PromoType[] = ['full_minus', 'discount', 'second_piece', 'exchange_gift', 'time_promo'];

/* ------------------------------------------------------------------ */
/* 助手                                                                */
/* ------------------------------------------------------------------ */

const pad2 = (n: number): string => String(n).padStart(2, '0');
/** Date → YYYY-MM-DD（null → —） */
function isoDate(d: Date | null | undefined): string {
  if (!d) return '—';
  const t = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(t.getTime())) return '—';
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

/** 标签类中文签 */
function tagKindLabel(kind: string): string {
  if (kind === 'species') return mk('mk.tag.kindSpecies');
  if (kind === 'size') return mk('mk.tag.kindSize');
  if (kind === 'pref') return mk('mk.tag.kindPref');
  return kind;
}

/** 券类型中文签 */
function couponTypeLabel(t: string): string {
  switch (t) {
    case 'register': return mk('mk.coupon.typeRegister');
    case 'recharge': return mk('mk.coupon.typeRecharge');
    case 'consume': return mk('mk.coupon.typeConsume');
    case 'birthday': return mk('mk.coupon.typeBirthday');
    case 'festival': return mk('mk.coupon.typeFestival');
    case 'wakeup': return mk('mk.coupon.typeWakeup');
    default: return t;
  }
}

/** 券类型徽签（六类复用既有 Badge tone，不私造色） */
function couponTypeBadge(t: string) {
  const tone = t === 'register' || t === 'festival' ? 'brand' : t === 'recharge' || t === 'birthday' ? 'success' : 'muted';
  return <Badge tone={tone}>{couponTypeLabel(t)}</Badge>;
}

/** 活动类型中文签 */
function promoTypeLabel(t: string): string {
  switch (t) {
    case 'full_minus': return mk('mk.promo.typeFullMinus');
    case 'discount': return mk('mk.promo.typeDiscount');
    case 'second_piece': return mk('mk.promo.typeSecondPiece');
    case 'exchange_gift': return mk('mk.promo.typeExchangeGift');
    case 'time_promo': return mk('mk.promo.typeTimePromo');
    default: return t;
  }
}

/** 活动 effectiveStatus 状态徽（draft 灰 / scheduled 淡金[蓝缺位复用 brand] / active 绿 / ended 墨） */
function promoStatusBadge(s: string) {
  if (s === 'active') return <Badge tone="success">{mk('mk.promo.stActive')}</Badge>;
  if (s === 'scheduled') return <Badge tone="brand">{mk('mk.promo.stScheduled')}</Badge>;
  if (s === 'ended') return <span className="u3-st live">{mk('mk.promo.stEnded')}</span>;
  return <Badge tone="muted">{mk('mk.promo.stDraft')}</Badge>;
}

/** 面板三态体（加载骨架 / 失败重试 / 空态 / 内容） */
function PanelBody({
  q, empty, children,
}: {
  q: { isPending: boolean; isError: boolean; refetch: () => Promise<unknown> };
  empty: string;
  children: ReactNode;
}) {
  if (q.isPending) {
    return (
      <div className="space-y-2 px-[17px] py-3" aria-label="加载中">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-12 text-center">
        <p className="text-body-sm text-[rgba(59,46,36,.62)]">{mk('mk.common.loadFail')}</p>
        <div className="mt-4">
          <Btn variant="subtle" size="sm" onClick={() => void q.refetch()}>
            {mk('mk.common.retry')}
          </Btn>
        </div>
      </div>
    );
  }
  if (!children) {
    return (
      <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-8 text-center text-caption text-[rgba(59,46,36,.62)]">
        {empty}
      </p>
    );
  }
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* 区 1 打标弹层                                                        */
/* ------------------------------------------------------------------ */

function TagSetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trpc, queryClient } = usePhiliaClient();
  const [userId, setUserId] = useState('');
  const [kind, setKind] = useState<TagKind>('species');
  const [value, setValue] = useState('dog');

  const setM = useMutation({
    mutationFn: () => trpc.marketing.tagSet.mutate({ userId: userId.trim(), kind, value: value.trim() }),
    onSuccess: () => {
      toast(mk('mk.tag.done'));
      void queryClient.invalidateQueries({ queryKey: ['marketing'] });
      onClose();
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });

  const switchKind = (k: TagKind) => {
    setKind(k);
    setValue(k === 'species' ? 'dog' : k === 'size' ? 'small' : '');
  };
  const valid = userId.trim() !== '' && value.trim() !== '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mk('mk.tag.modalTitle')}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{mk('mk.common.cancel')}</Btn>
          <Btn variant="primary" disabled={!valid || setM.isPending} onClick={() => setM.mutate()}>
            {setM.isPending ? mk('mk.common.submitting') : mk('mk.common.submit')}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={mk('mk.tag.userId')} hint={mk('mk.tag.userIdHint')}>
          <input className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)} />
        </Field>
        <Field label={mk('mk.tag.kind')}>
          <select className={inputCls} value={kind} onChange={(e) => switchKind(e.target.value as TagKind)}>
            {TAG_KINDS.map((k) => (
              <option key={k} value={k}>{tagKindLabel(k)}</option>
            ))}
          </select>
        </Field>
        <Field label={mk('mk.tag.value')} hint={kind === 'pref' ? mk('mk.tag.prefHint') : undefined}>
          {kind === 'species' ? (
            <select className={inputCls} value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="dog">{mk('mk.tag.speciesDog')}</option>
              <option value="cat">{mk('mk.tag.speciesCat')}</option>
            </select>
          ) : kind === 'size' ? (
            <select className={inputCls} value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="small">{mk('mk.tag.sizeSmall')}</option>
              <option value="medium">{mk('mk.tag.sizeMedium')}</option>
              <option value="large">{mk('mk.tag.sizeLarge')}</option>
            </select>
          ) : (
            <input className={inputCls} maxLength={16} value={value} onChange={(e) => setValue(e.target.value)} />
          )}
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 区 2 新建券弹层                                                      */
/* ------------------------------------------------------------------ */

function CouponCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trpc, queryClient } = usePhiliaClient();
  const [couponType, setCouponType] = useState<CouponType>('register');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [threshold, setThreshold] = useState('0');
  const [days, setDays] = useState('30');
  const [quota, setQuota] = useState('');

  const amountFen = yuanToFen(amount);
  const thresholdFen = threshold.trim() === '' ? 0 : yuanToFen(threshold);
  const daysNum = Number(days);
  const quotaNum = quota.trim() === '' ? null : Number(quota);
  const valid =
    title.trim() !== '' &&
    amountFen !== null && amountFen >= 1 &&
    thresholdFen !== null &&
    Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 3650 &&
    (quotaNum === null || (Number.isInteger(quotaNum) && quotaNum >= 1));

  const createM = useMutation({
    mutationFn: () =>
      trpc.marketing.couponCreate.mutate({
        couponType,
        title: title.trim(),
        amountFen: amountFen!,
        thresholdFen: thresholdFen ?? 0,
        validDays: daysNum,
        totalQuota: quotaNum,
      }),
    onSuccess: () => {
      toast(mk('mk.coupon.done'));
      void queryClient.invalidateQueries({ queryKey: ['marketing'] });
      onClose();
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mk('mk.coupon.modalTitle')}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{mk('mk.common.cancel')}</Btn>
          <Btn variant="primary" disabled={!valid || createM.isPending} onClick={() => createM.mutate()}>
            {createM.isPending ? mk('mk.common.submitting') : mk('mk.common.submit')}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={mk('mk.coupon.fType')}>
          <select className={inputCls} value={couponType} onChange={(e) => setCouponType(e.target.value as CouponType)}>
            {COUPON_TYPES.map((t) => (
              <option key={t} value={t}>{couponTypeLabel(t)}</option>
            ))}
          </select>
        </Field>
        <Field label={mk('mk.coupon.fTitle')}>
          <input className={inputCls} maxLength={64} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={mk('mk.coupon.fAmount')}>
          <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={mk('mk.coupon.fThreshold')}>
          <input className={inputCls} inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        </Field>
        <Field label={mk('mk.coupon.fDays')}>
          <input className={inputCls} type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
        <Field label={mk('mk.coupon.fQuota')}>
          <input className={inputCls} type="number" min={1} value={quota} onChange={(e) => setQuota(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 区 3 定向发放弹层                                                    */
/* ------------------------------------------------------------------ */

function CampaignGrantDialog({
  open, onClose, coupons,
}: {
  open: boolean; onClose: () => void; coupons: CouponRow[];
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const [couponId, setCouponId] = useState('');
  const [title, setTitle] = useState('');
  const [targetKind, setTargetKind] = useState<'' | TagKind>('');
  const [targetValue, setTargetValue] = useState('');
  const [note, setNote] = useState('');

  const grantM = useMutation({
    mutationFn: () =>
      trpc.marketing.campaignGrant.mutate({
        couponId,
        title: title.trim(),
        ...(targetKind ? { targetKind, targetValue: targetValue.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (r) => {
      toast(mk('mk.campaign.done', { m: r.matched, g: r.granted }));
      void queryClient.invalidateQueries({ queryKey: ['marketing'] });
      onClose();
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });

  const valid = couponId !== '' && title.trim() !== '' && (targetKind === '' || targetValue.trim() !== '');
  /* 仅在架券可发（server 同口径校验） */
  const onCoupons = coupons.filter((c) => c.status === 'on');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mk('mk.campaign.modalTitle')}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{mk('mk.common.cancel')}</Btn>
          <Btn variant="primary" disabled={!valid || grantM.isPending} onClick={() => grantM.mutate()}>
            {grantM.isPending ? mk('mk.common.submitting') : mk('mk.common.submit')}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={mk('mk.campaign.fCoupon')} hint={onCoupons.length === 0 ? mk('mk.campaign.noCoupon') : undefined}>
          <select className={inputCls} value={couponId} onChange={(e) => setCouponId(e.target.value)}>
            <option value="">—</option>
            {onCoupons.map((c) => (
              <option key={c.id} value={c.id}>
                {couponTypeLabel(c.couponType)} · {c.title}（{fmtMoney(c.amountFen)}）
              </option>
            ))}
          </select>
        </Field>
        <Field label={mk('mk.campaign.fTitle')}>
          <input className={inputCls} maxLength={64} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={mk('mk.campaign.fTargetKind')}>
          <select
            className={inputCls}
            value={targetKind}
            onChange={(e) => {
              const k = e.target.value as '' | TagKind;
              setTargetKind(k);
              setTargetValue(k === 'species' ? 'dog' : k === 'size' ? 'small' : '');
            }}
          >
            <option value="">{mk('mk.campaign.targetAll')}</option>
            {TAG_KINDS.map((k) => (
              <option key={k} value={k}>{tagKindLabel(k)}</option>
            ))}
          </select>
        </Field>
        {targetKind !== '' ? (
          <Field label={mk('mk.campaign.fTargetValue')} hint={targetKind === 'pref' ? mk('mk.tag.prefHint') : undefined}>
            {targetKind === 'species' ? (
              <select className={inputCls} value={targetValue} onChange={(e) => setTargetValue(e.target.value)}>
                <option value="dog">{mk('mk.tag.speciesDog')}</option>
                <option value="cat">{mk('mk.tag.speciesCat')}</option>
              </select>
            ) : targetKind === 'size' ? (
              <select className={inputCls} value={targetValue} onChange={(e) => setTargetValue(e.target.value)}>
                <option value="small">{mk('mk.tag.sizeSmall')}</option>
                <option value="medium">{mk('mk.tag.sizeMedium')}</option>
                <option value="large">{mk('mk.tag.sizeLarge')}</option>
              </select>
            ) : (
              <input className={inputCls} maxLength={16} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            )}
          </Field>
        ) : null}
        <Field label={mk('mk.campaign.fNote')}>
          <input className={inputCls} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 区 5 活动新建/编辑弹层（规则 JSON 简表按类型 2-3 键）                    */
/* ------------------------------------------------------------------ */

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function PromoDialog({
  open, onClose, editing,
}: {
  open: boolean; onClose: () => void; editing: PromoRow | null;
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const rules = (editing?.rulesJson ?? {}) as Record<string, unknown>;
  const numOf = (k: string): string =>
    typeof rules[k] === 'number' ? String((rules[k] as number) / 100) : '';
  const rateOf = (k: string): string => (typeof rules[k] === 'number' ? String(rules[k]) : '');
  const strOf = (k: string): string => (typeof rules[k] === 'string' ? (rules[k] as string) : '');

  const [type, setType] = useState<PromoType>((editing?.type ?? 'full_minus') as PromoType);
  const [name, setName] = useState(editing?.name ?? '');
  const [threshold, setThreshold] = useState(numOf('thresholdFen'));
  const [minus, setMinus] = useState(numOf('minusFen'));
  const [rate, setRate] = useState(rateOf('rate'));
  const [gift, setGift] = useState(strOf('gift'));
  const [dailyStart, setDailyStart] = useState(strOf('dailyStart'));
  const [dailyEnd, setDailyEnd] = useState(strOf('dailyEnd'));
  const [startsAt, setStartsAt] = useState(editing?.startsAt ? isoDate(editing.startsAt) : '');
  const [endsAt, setEndsAt] = useState(editing?.endsAt ? isoDate(editing.endsAt) : '');
  const [status, setStatus] = useState<'draft' | 'scheduled'>(editing?.status === 'scheduled' ? 'scheduled' : 'draft');

  /* 规则 JSON 简表组装（按类型 2-3 键；null=不合法） */
  const buildRules = (): Record<string, unknown> | null => {
    if (type === 'full_minus') {
      const th = yuanToFen(threshold);
      const mi = yuanToFen(minus);
      if (th === null || mi === null || mi < 1) return null;
      return { thresholdFen: th, minusFen: mi };
    }
    if (type === 'discount' || type === 'second_piece') {
      const r = Number(rate);
      if (!Number.isFinite(r) || r <= 0 || r > 1) return null;
      return { rate: r };
    }
    if (type === 'exchange_gift') {
      const th = threshold.trim() === '' ? 0 : yuanToFen(threshold);
      if (th === null || gift.trim() === '') return null;
      return { thresholdFen: th, gift: gift.trim() };
    }
    /* time_promo */
    const r = Number(rate);
    if (!HHMM_RE.test(dailyStart) || !HHMM_RE.test(dailyEnd) || !Number.isFinite(r) || r <= 0 || r > 1) return null;
    return { dailyStart, dailyEnd, rate: r };
  };
  const rulesJson = buildRules();
  const valid = name.trim() !== '' && rulesJson !== null;

  const upsertM = useMutation({
    mutationFn: () =>
      trpc.marketing.promoUpsert.mutate({
        ...(editing ? { id: editing.id } : {}),
        type,
        name: name.trim(),
        rulesJson: rulesJson!,
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        status,
      }),
    onSuccess: () => {
      toast(mk('mk.promo.done'));
      void queryClient.invalidateQueries({ queryKey: ['marketing'] });
      onClose();
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? mk('mk.promo.modalEdit') : mk('mk.promo.modalCreate')}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>{mk('mk.common.cancel')}</Btn>
          <Btn variant="primary" disabled={!valid || upsertM.isPending} onClick={() => upsertM.mutate()}>
            {upsertM.isPending ? mk('mk.common.submitting') : mk('mk.common.submit')}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={mk('mk.promo.fType')}>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as PromoType)}>
            {PROMO_TYPES.map((t) => (
              <option key={t} value={t}>{promoTypeLabel(t)}</option>
            ))}
          </select>
        </Field>
        <Field label={mk('mk.promo.fName')}>
          <input className={inputCls} maxLength={64} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {type === 'full_minus' ? (
          <>
            <Field label={mk('mk.promo.ruleThreshold')}>
              <input className={inputCls} inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </Field>
            <Field label={mk('mk.promo.ruleMinus')}>
              <input className={inputCls} inputMode="decimal" value={minus} onChange={(e) => setMinus(e.target.value)} />
            </Field>
          </>
        ) : null}
        {type === 'discount' || type === 'second_piece' ? (
          <Field label={mk('mk.promo.ruleRate')}>
            <input className={inputCls} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
        ) : null}
        {type === 'exchange_gift' ? (
          <>
            <Field label={mk('mk.promo.ruleThreshold')}>
              <input className={inputCls} inputMode="decimal" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </Field>
            <Field label={mk('mk.promo.ruleGift')}>
              <input className={inputCls} maxLength={64} value={gift} onChange={(e) => setGift(e.target.value)} />
            </Field>
          </>
        ) : null}
        {type === 'time_promo' ? (
          <>
            <Field label={mk('mk.promo.ruleDailyStart')}>
              <input className={inputCls} placeholder="10:00" value={dailyStart} onChange={(e) => setDailyStart(e.target.value)} />
            </Field>
            <Field label={mk('mk.promo.ruleDailyEnd')}>
              <input className={inputCls} placeholder="20:00" value={dailyEnd} onChange={(e) => setDailyEnd(e.target.value)} />
            </Field>
            <Field label={mk('mk.promo.ruleRate')}>
              <input className={inputCls} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
          </>
        ) : null}
        <Field label={mk('mk.promo.fStartsAt')}>
          <input className={inputCls} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </Field>
        <Field label={mk('mk.promo.fEndsAt')}>
          <input className={inputCls} type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </Field>
        <Field label={mk('mk.promo.fStatus')}>
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'scheduled')}>
            <option value="draft">{mk('mk.promo.fStatusDraft')}</option>
            <option value="scheduled">{mk('mk.promo.fStatusScheduled')}</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function MarketingPage() {
  const { trpc } = usePhiliaClient();
  const role = useMerchantRole();

  /* ---- 区 1 会员标签 ---- */
  const [tagKind, setTagKind] = useState<'' | TagKind>('');
  const [tagValue, setTagValue] = useState('');
  const tagsQ = useQuery({
    queryKey: ['marketing', 'tagList', tagKind, tagValue],
    queryFn: () =>
      trpc.marketing.tagList.query({
        ...(tagKind ? { kind: tagKind } : {}),
        ...(tagValue.trim() ? { value: tagValue.trim() } : {}),
      }),
    enabled: role.canManage,
  });
  const [tagOpen, setTagOpen] = useState(false);

  /* ---- 区 2 券矩阵 ---- */
  const [couponType, setCouponType] = useState<'' | CouponType>('');
  const couponsQ = useQuery({
    queryKey: ['marketing', 'couponList', couponType],
    queryFn: () => trpc.marketing.couponList.query(couponType ? { couponType } : {}),
    enabled: role.canManage,
  });
  const [couponOpen, setCouponOpen] = useState(false);

  /* ---- 区 3 定向发放 ---- */
  const campaignsQ = useQuery({
    queryKey: ['marketing', 'campaignList'],
    queryFn: () => trpc.marketing.campaignList.query(),
    enabled: role.canManage,
  });
  const [grantOpen, setGrantOpen] = useState(false);

  /* ---- 区 4 生日营销 ---- */
  const bdayQ = useQuery({
    queryKey: ['marketing', 'birthdayBoard'],
    queryFn: () => trpc.marketing.birthdayBoard.query(),
    enabled: role.canManage,
  });

  /* ---- 区 5 活动配置 + 互斥公示 ---- */
  const promosQ = useQuery({
    queryKey: ['marketing', 'promoList'],
    queryFn: () => trpc.marketing.promoList.query(),
    enabled: role.canManage,
  });
  const stackQ = useQuery({
    queryKey: ['marketing', 'promoStackRules'],
    queryFn: () => trpc.marketing.promoStackRules.query(),
    enabled: role.canManage,
  });
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoEditing, setPromoEditing] = useState<PromoRow | null>(null);

  if (!role.canManage) {
    return <RoleGuidePage title={mk('mk.guide.title')} hint={mk('mk.guide.hint')} />;
  }

  const tags = tagsQ.data ?? [];
  const coupons = couponsQ.data?.items ?? [];
  const campaigns = campaignsQ.data ?? [];
  const bday = bdayQ.data;
  const promos = promosQ.data?.items ?? [];
  const stackRules = (stackQ.data?.rules ?? {}) as Record<string, Record<string, unknown>>;
  const tier = (bday?.tier ?? {}) as Record<string, unknown>;

  return (
    <MainScaffold title={mk('mk.page.title')} sub={mk('mk.page.sub')} testid="marketing-page">
      <ToasterMount />

      {/* 页面互链（rail 十九口冻结不改=页面互链口径） */}
      <p className="mb-3 text-caption-xs">
        <Link to="/marketing-ledger" className="text-brand underline underline-offset-2" data-testid="marketing-to-ledger">
          {mk('mk.page.toLedger')}
        </Link>
      </p>

      {/* 区 1 会员标签 */}
      <div className="u3-panel mb-4" data-testid="marketing-tags">
        <div className="u3-panel-head">
          <h3>{mk('mk.tag.title')}</h3>
          <span className="aside">{mk('mk.tag.aside')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5">
          {(['', ...TAG_KINDS] as const).map((k) => (
            <button
              key={k || 'all'}
              type="button"
              className={`u3-chipf${tagKind === k ? ' on' : ''}`}
              data-testid={`marketing-tag-kind-${k || 'all'}`}
              onClick={() => setTagKind(k)}
            >
              {k === '' ? mk('mk.tag.filterAll') : tagKindLabel(k)}
            </button>
          ))}
          <input
            className="u1-ring w-44 rounded-control bg-card px-3 py-2 text-caption text-ink placeholder:text-[rgba(59,46,36,.42)] focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
            placeholder={mk('mk.tag.valueFilterPh')}
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            data-testid="marketing-tag-value-filter"
          />
          <span className="flex-1" />
          <Btn variant="primary" size="sm" onClick={() => setTagOpen(true)} data-testid="marketing-tag-set">
            {mk('mk.tag.setCta')}
          </Btn>
        </div>
        <PanelBody q={tagsQ} empty={mk('mk.tag.empty')}>
          {tags.length === 0 ? null : (
            <table className="u3-tbl">
              <thead>
                <tr>
                  <th>{mk('mk.tag.colMember')}</th>
                  <th>{mk('mk.tag.colKind')}</th>
                  <th>{mk('mk.tag.colValue')}</th>
                  <th className="text-right">{mk('mk.tag.colTime')}</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t: TagRow) => (
                  <tr key={t.id}>
                    <td className="font-semibold">{t.nickname ?? t.userId.slice(-6)}</td>
                    <td>{tagKindLabel(t.kind)}</td>
                    <td className="font-bold">{t.value}</td>
                    <td className="u1-num text-right text-caption-xs">{fmtDateTime(t.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PanelBody>
      </div>

      {/* 区 2 券矩阵 */}
      <div className="u3-panel mb-4" data-testid="marketing-coupons">
        <div className="u3-panel-head">
          <h3>{mk('mk.coupon.title')}</h3>
          <span className="aside">{mk('mk.coupon.aside')}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5">
          {(['', ...COUPON_TYPES] as const).map((t) => (
            <button
              key={t || 'all'}
              type="button"
              className={`u3-chipf${couponType === t ? ' on' : ''}`}
              data-testid={`marketing-coupon-type-${t || 'all'}`}
              onClick={() => setCouponType(t)}
            >
              {t === '' ? mk('mk.tag.filterAll') : couponTypeLabel(t)}
            </button>
          ))}
          <span className="flex-1" />
          <Btn variant="primary" size="sm" onClick={() => setCouponOpen(true)} data-testid="marketing-coupon-create">
            {mk('mk.coupon.createCta')}
          </Btn>
        </div>
        <PanelBody q={couponsQ} empty={mk('mk.coupon.empty')}>
          {coupons.length === 0 ? null : (
            <div className="u3-noscrollx overflow-x-auto">
              <table className="u3-tbl min-w-[860px]">
                <thead>
                  <tr>
                    <th>{mk('mk.coupon.colType')}</th>
                    <th>{mk('mk.coupon.colTitle')}</th>
                    <th className="text-right">{mk('mk.coupon.colAmount')}</th>
                    <th className="text-right">{mk('mk.coupon.colThreshold')}</th>
                    <th className="text-right">{mk('mk.coupon.colDays')}</th>
                    <th className="text-right">{mk('mk.coupon.colQuota')}</th>
                    <th>{mk('mk.coupon.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td>{couponTypeBadge(c.couponType)}</td>
                      <td className="font-semibold">{c.title}</td>
                      <td className="u1-num text-right font-bold">{fmtMoney(c.amountFen)}</td>
                      <td className="u1-num text-right">
                        {c.thresholdFen > 0 ? fmtMoney(c.thresholdFen) : mk('mk.coupon.thresholdNone')}
                      </td>
                      <td className="u1-num text-right">{c.validDays}</td>
                      <td className="u1-num text-right">{c.totalQuota ?? mk('mk.coupon.quotaNone')}</td>
                      <td>
                        <span className={`u3-st ${c.status === 'on' ? 'live' : 'done'}`}>
                          {c.status === 'on' ? mk('mk.coupon.statusOn') : mk('mk.coupon.statusOff')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </div>

      {/* 区 3 定向发放 */}
      <div className="u3-panel mb-4" data-testid="marketing-campaigns">
        <div className="u3-panel-head">
          <h3>{mk('mk.campaign.title')}</h3>
          <span className="aside">{mk('mk.campaign.aside')}</span>
        </div>
        <div className="flex items-center justify-end border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5">
          <Btn variant="primary" size="sm" onClick={() => setGrantOpen(true)} data-testid="marketing-campaign-grant">
            {mk('mk.campaign.grantCta')}
          </Btn>
        </div>
        <PanelBody q={campaignsQ} empty={mk('mk.campaign.empty')}>
          {campaigns.length === 0 ? null : (
            <div className="u3-noscrollx overflow-x-auto">
              <table className="u3-tbl min-w-[760px]">
                <thead>
                  <tr>
                    <th>{mk('mk.campaign.colTitle')}</th>
                    <th>{mk('mk.campaign.colCoupon')}</th>
                    <th>{mk('mk.campaign.colTarget')}</th>
                    <th className="text-right">{mk('mk.campaign.colGranted')}</th>
                    <th>{mk('mk.campaign.colNote')}</th>
                    <th className="text-right">{mk('mk.campaign.colTime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c: CampaignRow) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.title}</td>
                      <td>
                        {couponTypeBadge(c.couponType)}
                        <span className="ml-1.5 text-caption-xs">{c.couponTitle}</span>
                      </td>
                      <td className="text-caption-xs">
                        {c.targetKind ? `${tagKindLabel(c.targetKind)}=${c.targetValue ?? ''}` : mk('mk.campaign.targetAll')}
                      </td>
                      <td className="u1-num text-right font-bold">{mk('mk.campaign.grantedUnit', { n: c.grantedCount })}</td>
                      <td className="max-w-40 truncate text-caption-xs text-[rgba(59,46,36,.62)]">{c.note ?? '—'}</td>
                      <td className="u1-num text-right text-caption-xs">{fmtDateTime(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </div>

      {/* 区 4 生日营销 */}
      <div className="u3-panel mb-4" data-testid="marketing-birthday">
        <div className="u3-panel-head">
          <h3>{mk('mk.bday.title')}</h3>
          <span className="aside">{mk('mk.bday.aside')}</span>
        </div>
        <PanelBody q={bdayQ} empty={mk('mk.bday.upcomingEmpty')}>
          {bday ? (
            <>
              {/* tier 配置卡（端口 birthday_perk_tier 当前值） */}
              <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] pb-1 pt-3">
                <div className="mb-2 text-caption font-semibold">{mk('mk.bday.tierTitle')}</div>
                {typeof tier.amountFen === 'number' ? (
                  <div className="u3-kv !px-0 !pb-3" data-testid="marketing-bday-tier">
                    <div className="cell">
                      <div className="cap">{mk('mk.bday.tierAmount')}</div>
                      <div className="v">{fmtMoney(tier.amountFen as number)}</div>
                    </div>
                    <div className="cell">
                      <div className="cap">{mk('mk.bday.tierThreshold')}</div>
                      <div className="v">
                        {typeof tier.thresholdFen === 'number' && (tier.thresholdFen as number) > 0
                          ? fmtMoney(tier.thresholdFen as number)
                          : mk('mk.coupon.thresholdNone')}
                      </div>
                    </div>
                    <div className="cell">
                      <div className="cap">{mk('mk.bday.tierDays')}</div>
                      <div className="v">{typeof tier.validDays === 'number' ? String(tier.validDays) : '—'}</div>
                    </div>
                  </div>
                ) : (
                  <p className="pb-3 text-caption-xs text-[rgba(59,46,36,.42)]">{mk('mk.bday.tierEmpty')}</p>
                )}
              </div>
              {/* upcoming 提醒名单 */}
              <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
                <div className="mb-2 text-caption font-semibold">{mk('mk.bday.upcomingTitle')}</div>
                {bday.upcoming.length === 0 ? (
                  <p className="py-3 text-center text-caption text-[rgba(59,46,36,.62)]">{mk('mk.bday.upcomingEmpty')}</p>
                ) : (
                  <div className="flex flex-wrap gap-2" data-testid="marketing-bday-upcoming">
                    {bday.upcoming.map((u: UpcomingRow, i) => (
                      <span key={`${u.kind}-${'userId' in u ? u.userId : u.petId}-${i}`} className="u3-st wait">
                        {u.kind === 'member' ? mk('mk.bday.kindMember') : mk('mk.bday.kindPet')}
                        · {('nickname' in u ? u.nickname : null) ?? ('name' in u ? u.name : null) ?? '—'}
                        <span className="u1-num">{u.birthday ? u.birthday.slice(5) : '—'}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* grants 台账 */}
              <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
                <div className="mb-2 text-caption font-semibold">{mk('mk.bday.grantsTitle')}</div>
                {bday.grants.length === 0 ? (
                  <p className="py-3 text-center text-caption text-[rgba(59,46,36,.62)]">{mk('mk.bday.grantsEmpty')}</p>
                ) : (
                  <table className="u3-tbl" data-testid="marketing-bday-grants">
                    <thead>
                      <tr>
                        <th>{mk('mk.tag.colMember')}</th>
                        <th>{mk('mk.campaign.colTitle')}</th>
                        <th className="text-right">{mk('mk.campaign.colTime')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bday.grants.map((g: GrantRow) => (
                        <tr key={g.id}>
                          <td className="font-semibold">{g.nickname ?? g.userId.slice(-6)}</td>
                          <td>{g.kind === 'birthday_pet' ? mk('mk.bday.grantPet') : mk('mk.bday.grantOwner')}</td>
                          <td className="u1-num text-right text-caption-xs">{fmtDateTime(g.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {bday.note ? (
                <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {bday.note}
                </p>
              ) : null}
            </>
          ) : null}
        </PanelBody>
      </div>

      {/* 区 5 活动配置 */}
      <div className="u3-panel mb-4" data-testid="marketing-promos">
        <div className="u3-panel-head">
          <h3>{mk('mk.promo.title')}</h3>
          <span className="aside">{mk('mk.promo.aside')}</span>
        </div>
        <div className="flex items-center justify-end border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5">
          <Btn
            variant="primary"
            size="sm"
            onClick={() => {
              setPromoEditing(null);
              setPromoOpen(true);
            }}
            data-testid="marketing-promo-create"
          >
            {mk('mk.promo.createCta')}
          </Btn>
        </div>
        <PanelBody q={promosQ} empty={mk('mk.promo.empty')}>
          {promos.length === 0 ? null : (
            <div className="u3-noscrollx overflow-x-auto">
              <table className="u3-tbl min-w-[860px]">
                <thead>
                  <tr>
                    <th>{mk('mk.promo.colName')}</th>
                    <th>{mk('mk.promo.colType')}</th>
                    <th>{mk('mk.promo.colStatus')}</th>
                    <th>{mk('mk.promo.colRange')}</th>
                    <th>{mk('mk.promo.colRules')}</th>
                    <th>{mk('mk.promo.colOps')}</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p.id} data-testid={`marketing-promo-${p.id}`}>
                      <td className="font-semibold">{p.name}</td>
                      <td>
                        <Badge tone="muted">{promoTypeLabel(p.type)}</Badge>
                      </td>
                      <td>{promoStatusBadge(p.effectiveStatus)}</td>
                      <td className="u1-num whitespace-nowrap text-caption-xs">
                        {p.startsAt || p.endsAt ? `${isoDate(p.startsAt)} ~ ${isoDate(p.endsAt)}` : mk('mk.promo.rangeNone')}
                      </td>
                      <td className="u1-num max-w-48 truncate text-caption-xs text-[rgba(59,46,36,.62)]" title={JSON.stringify(p.rulesJson)}>
                        {JSON.stringify(p.rulesJson)}
                      </td>
                      <td>
                        <Btn
                          variant="subtle"
                          size="sm"
                          onClick={() => {
                            setPromoEditing(p);
                            setPromoOpen(true);
                          }}
                          data-testid={`marketing-promo-edit-${p.id}`}
                        >
                          {mk('mk.promo.editCta')}
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
        {promosQ.data?.note ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5 text-caption-xs text-[rgba(59,46,36,.42)]">
            {promosQ.data.note}
          </p>
        ) : null}
      </div>

      {/* 区 5b 促销互斥·叠加规则公示卡 */}
      <div className="u3-panel mb-4" data-testid="marketing-stack-rules">
        <div className="u3-panel-head">
          <h3>{mk('mk.stack.title')}</h3>
        </div>
        <PanelBody q={stackQ} empty={mk('mk.stack.note')}>
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2">
            {(
              [
                ['coupon_stack_rule', mk('mk.stack.couponStack')],
                ['promo_stack_campaign_coupon', mk('mk.stack.campaignCoupon')],
                ['promo_stack_campaign_member', mk('mk.stack.campaignMember')],
                ['promo_stack_multi_campaign', mk('mk.stack.multiCampaign')],
              ] as const
            ).map(([k, label]) => {
              const v = stackRules[k];
              /* OP-03 P2-3（端口批收尾片 4）：公示只留人话——ruleLabel 中文映射主显
                 （server 透出；缺省回落 rule 原文），键名收 title Tooltip 不再裸露 */
              const ruleText =
                v && typeof v.ruleLabel === 'string'
                  ? (v.ruleLabel as string)
                  : v && typeof v.rule === 'string'
                    ? (v.rule as string)
                    : JSON.stringify(v ?? {});
              return (
                <div className="u3-field" key={k} data-testid={`marketing-stack-${k}`} title={k}>
                  <span className="lb">{label}</span>
                  <span className="vl">
                    <span className="u1-num">{ruleText}</span>
                    {v && typeof v.note === 'string' ? (
                      <span className="ml-2 text-caption-xs font-normal text-[rgba(59,46,36,.42)]">{v.note as string}</span>
                    ) : null}
                  </span>
                </div>
              );
            })}
            <p className="py-2.5 text-caption-xs text-[rgba(59,46,36,.42)]">{stackQ.data?.note ?? mk('mk.stack.note')}</p>
          </div>
        </PanelBody>
      </div>

      <TagSetDialog open={tagOpen} onClose={() => setTagOpen(false)} />
      <CouponCreateDialog open={couponOpen} onClose={() => setCouponOpen(false)} />
      <CampaignGrantDialog open={grantOpen} onClose={() => setGrantOpen(false)} coupons={coupons} />
      <PromoDialog key={promoEditing?.id ?? 'new'} open={promoOpen} onClose={() => setPromoOpen(false)} editing={promoEditing} />
    </MainScaffold>
  );
}
