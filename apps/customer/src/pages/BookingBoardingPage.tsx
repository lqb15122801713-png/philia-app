/**
 * 【批次 4 起为旧版向导】B4-2 后默认路由 /booking/boarding 已切换为单屏页
 * （BoardingSinglePage）；本文件整体保留于隐藏路由 /booking/boarding/wizard
 * 作回滚保障，验收通过后下批次再删。以下历史注释保留原样。
 *
 * 寄养预约（T2.2 · 4 屏）：
 *   屏1 选入住/退房日期（今日起 14 天；退房 > 入住；门店休息日禁选）
 *   屏2 选房型（boarding 服务项卡，含 boarding_room_type；顶部可切换门店，联动刷新）
 *   屏3 选宠物（疫苗硬校验：vaccine_valid_until 为空或早于退房日 → 红色阻断卡 + 跳档案页补录）
 *   屏4 确认提交（scheduled_start=入住日开店时刻、scheduled_end=退房日同时刻）
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import BoardingDateRangePicker, { checkinAt } from '@/components/booking/BoardingDateRangePicker';
import PetPicker from '@/components/booking/PetPicker';
import StepIndicator from '@/components/booking/StepIndicator';
import SummaryChips from '@/components/booking/SummaryChips';
import { friendlyError, useToast } from '@/components/booking/Toast';
import { fenToYuan, fmtMD, nightsBetween, PAYMENT_MODE_META, toISODate, weekCN } from '@/components/booking/format';
import type { StoreItem } from '@/components/booking/types';

const STEPS = ['选日期', '选房型', '选宠物', '确认'];
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** 门店某日是否休息 */
const isClosed = (store: StoreItem | null, d: Date) =>
  !store?.openHours?.[DAY_KEYS[d.getDay()]!];

export default function BookingBoardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast();

  const [step, setStep] = useState(1);
  const [storeId, setStoreId] = useState<string | null>(searchParams.get('storeId'));
  const [checkin, setCheckin] = useState<Date | null>(null);
  const [checkout, setCheckout] = useState<Date | null>(null);
  // v1.1-b1：?serviceId= 预填（首页推荐服务 / philia 一键复购链接均带该参数）
  const [serviceId, setServiceId] = useState<string | null>(searchParams.get('serviceId'));
  // v1.1-b2：?petId= 预填（B2-3 完成单「再次预约」链接带该参数，与 serviceId 预填同模式）
  const [petId, setPetId] = useState<string | null>(searchParams.get('petId'));
  // B2-7R（产品裁定A）：次卡仅洗护可用，寄养固定到店付（不再渲染次卡扣次选项）
  const paymentMode = 'pay_at_store' as const;
  const [note, setNote] = useState('');

  /* ---- 数据 ---- */
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query({}),
  });
  const effStoreId = storeId ?? nearbyQ.data?.stores[0]?.id ?? null;
  const store = nearbyQ.data?.stores.find((s) => s.id === effStoreId) ?? null;

  const servicesQ = useQuery({
    queryKey: ['store', 'getWithServices', effStoreId, 'boarding'],
    queryFn: () => trpc.store.getWithServices.query({ storeId: effStoreId! }),
    enabled: effStoreId !== null && step >= 2,
  });
  const boardingServices = useMemo(
    () => (servicesQ.data?.services ?? []).filter((s) => s.type === 'boarding'),
    [servicesQ.data],
  );
  const service = boardingServices.find((s) => s.id === serviceId) ?? null;

  // v1.1-b3 B3-2（W-12）：房型逐晚余量——已选日期区间时查区间（卡片显示区间内
  // 最小剩余）；未选日期（如切店后日期被清空）时查「今晚」
  const availRange = useMemo(() => {
    if (checkin && checkout) return { from: checkin, to: checkout, tonight: false };
    const now = new Date();
    const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: t0, to: new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + 1), tonight: true };
  }, [checkin, checkout]);
  const availQ = useQuery({
    queryKey: ['store', 'boardingAvailability', effStoreId, availRange.from.getTime(), availRange.to.getTime()],
    queryFn: () =>
      trpc.store.boardingAvailability.query({
        storeId: effStoreId!,
        from: availRange.from,
        to: availRange.to,
      }),
    enabled: effStoreId !== null && step >= 2,
  });
  /** 房型卡剩余间数：已选区间取区间内逐晚最小剩余；未选日期取今晚剩余 */
  const remainingOf = (sid: string): number | null => {
    const row = availQ.data?.services.find((a) => a.serviceId === sid);
    if (!row || row.remaining.length === 0) return null;
    return Math.min(...row.remaining);
  };

  // v1.1-b1：URL 预填的 serviceId 若不属于该店寄养房型则清掉（避免看不见的选中态放行下一步）
  useEffect(() => {
    if (servicesQ.isSuccess && serviceId && !boardingServices.some((s) => s.id === serviceId)) {
      setServiceId(null);
    }
  }, [servicesQ.isSuccess, boardingServices, serviceId]);

  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
    // v1.1-b1：首屏即查（空宠物 → 建档岔路卡），不再等选宠屏
    enabled: true,
  });
  /** 空宠物：第一屏显示建档岔路卡；「随便看看」仅浏览，确认屏不可达 */
  const noPets = petsQ.isSuccess && (petsQ.data?.length ?? 0) === 0;
  const [forkDismissed, setForkDismissed] = useState(false);

  // v1.1-b2：URL 预填的 petId 若不在本人宠物列表则清掉（避免看不见的选中态直接放行提交）
  useEffect(() => {
    if (petsQ.isSuccess && petId && !(petsQ.data ?? []).some((p) => p.id === petId)) {
      setPetId(null);
    }
  }, [petsQ.isSuccess, petsQ.data, petId]);

  const pickStore = (id: string) => {
    if (id === effStoreId) return;
    setStoreId(id);
    setServiceId(null);
    // 新门店若在所选日期休息，清掉该日期
    const next = nearbyQ.data?.stores.find((s) => s.id === id) ?? null;
    if (checkin && isClosed(next, checkin)) setCheckin(null);
    if (checkout && isClosed(next, checkout)) setCheckout(null);
  };

  /* ---- 提交 ---- */
  const createM = useMutation({
    mutationFn: () => {
      if (!store || !checkin || !checkout) throw new Error('信息不完整');
      const start = checkinAt(store, checkin);
      const end = checkinAt(store, checkout);
      return trpc.appointment.create.mutate({
        storeId: store.id,
        petId: petId!,
        serviceId: serviceId!,
        type: 'boarding',
        scheduledStart: start,
        scheduledEnd: end,
        paymentMode,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
    },
    onSuccess: (appt) => {
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      // B3-2：下单占晚后余量变化，使余量缓存失效（返回向导时重取）
      void queryClient.invalidateQueries({ queryKey: ['store', 'boardingAvailability'] });
      navigate(`/booking/success?aid=${encodeURIComponent(appt.id)}`, { replace: true });
    },
    onError: (err) => showToast(friendlyError(err, '预约失败，请稍后再试')),
  });

  const nights = checkin && checkout ? nightsBetween(checkin, checkout) : 0;
  const canNext =
    (step === 1 && checkin !== null && checkout !== null) ||
    (step === 2 && serviceId !== null) ||
    (step === 3 && petId !== null);

  return (
    <div className="px-4 py-6">
      {toastEl}

      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep(step - 1) : navigate(-1))}
          aria-label="返回"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-card active:scale-92"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-ink-secondary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-title-lg">预约寄养</h1>
      </header>

      <div className="mt-4">
        <StepIndicator steps={STEPS} current={step} />
      </div>

      <div className="mt-4">
        <SummaryChips
          chips={[
            ...(checkin && checkout && step > 1
              ? [
                  {
                    label: '日期',
                    value: `${fmtMD(checkin)}→${fmtMD(checkout)}·${nights}晚`,
                    onClick: () => setStep(1),
                  },
                ]
              : []),
            ...(service && step > 2
              ? [{ label: '房型', value: service.boardingRoomType ?? service.name, onClick: () => setStep(2) }]
              : []),
          ]}
        />
      </div>

      {/* 屏1：入住 / 退房日期 */}
      {step === 1 ? (
        <section className="mt-4">
          {/* v1.1-b1：空宠物建档岔路卡（可跳过浏览，但确认屏不可达） */}
          {noPets && !forkDismissed ? (
            <div className="mb-4 flex flex-col items-center rounded-card bg-card px-4 py-6 text-center shadow-card">
              <img src="/brand/empty-appointments-800.png" alt="还没有宠物档案" className="w-40 max-w-full rounded-card" />
              <p className="mt-3 text-title">还没有宠物档案</p>
              <p className="mt-1 text-caption text-ink-secondary">预约寄养前需要先为毛孩子建立档案</p>
              <button
                type="button"
                onClick={() => navigate('/philia/pets')}
                className="mt-4 flex h-11 items-center rounded-full bg-brand-primary px-8 text-body font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                先建立宠物档案
              </button>
              <button
                type="button"
                onClick={() => setForkDismissed(true)}
                className="mt-3 text-caption text-ink-secondary underline-offset-2 hover:underline"
              >
                随便看看
              </button>
            </div>
          ) : null}
          {store ? (
            <p className="mb-3 text-caption text-ink-secondary">
              寄养门店：<span className="font-medium text-ink">{store.name}</span>
              （可在下一步更换）
            </p>
          ) : null}

          {/* 两阶段日期选择（B2-5 交互，B3-4 抽为共用组件 BoardingDateRangePicker） */}
          <BoardingDateRangePicker
            store={store}
            checkin={checkin}
            checkout={checkout}
            onCheckinChange={setCheckin}
            onCheckoutChange={setCheckout}
          />
        </section>
      ) : null}

      {/* 屏2：选房型（可切门店） */}
      {step === 2 ? (
        <section className="mt-4">
          <h2 className="text-title">寄养门店</h2>
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
            {(nearbyQ.data?.stores ?? []).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickStore(s.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-body transition ${
                  s.id === effStoreId
                    ? 'bg-brand-primary font-semibold text-ink'
                    : 'bg-card text-ink shadow-card'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          <h2 className="mt-5 text-title">选择房型</h2>
          <div className="mt-2 space-y-2">
            {servicesQ.isPending ? (
              [1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-card bg-sunken" />)
            ) : servicesQ.isError ? (
              <div className="rounded-card bg-sunken px-4 py-8 text-center">
                <p className="text-caption text-ink-secondary">房型加载失败，请检查网络</p>
                <button
                  type="button"
                  onClick={() => void servicesQ.refetch()}
                  className="mt-2 text-caption font-semibold text-brand-primary"
                >
                  重新加载
                </button>
              </div>
            ) : boardingServices.length === 0 ? (
              <p className="rounded-card bg-sunken px-4 py-8 text-center text-caption text-ink-secondary">
                该门店暂无寄养房型，换一家看看
              </p>
            ) : (
              boardingServices.map((s) => {
                const active = s.id === serviceId;
                const remaining = remainingOf(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    className={`flex w-full items-center justify-between rounded-card bg-card p-4 text-left shadow-card transition active:scale-[0.99] ${active ? 'ring-2 ring-brand-primary' : ''}`}
                  >
                    <span>
                      <span className="block text-body font-semibold">
                        {s.boardingRoomType ?? s.name}
                      </span>
                      {s.boardingRoomType ? (
                        <span className="mt-0.5 block text-caption text-ink-secondary">{s.name}</span>
                      ) : null}
                      {/* v1.1-b3 B3-2（W-12）：剩余间数透出——已选区间=区间内最小剩余；未选日期=今晚剩余 */}
                      {remaining !== null ? (
                        <span
                          className={`mt-0.5 block text-caption ${
                            remaining === 0 ? 'text-danger-deep' : 'text-success-deep'
                          }`}
                        >
                          {availRange.tonight ? `今晚剩余 ${remaining} 间` : `剩余 ${remaining} 间`}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-right">
                      <span className="block font-number text-price text-brand-primary">
                        {fenToYuan(s.priceFen)}
                      </span>
                      <span className="text-caption text-ink-placeholder">/ 晚</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      ) : null}

      {/* 屏3：选宠物（疫苗硬校验，须覆盖到退房日） */}
      {step === 3 ? (
        <section className="mt-4">
          <h2 className="text-title">选择宠物</h2>
          <p className="mt-1 text-caption text-ink-secondary">
            寄养要求疫苗有效期覆盖至退房日（{checkout ? toISODate(checkout) : '—'}）
          </p>
          <div className="mt-2">
            <PetPicker
              pets={petsQ.data ?? []}
              selectedId={petId}
              onSelect={setPetId}
              requireVaccineUntil={checkout}
              loading={petsQ.isPending}
            />
          </div>
        </section>
      ) : null}

      {/* 屏4：确认 */}
      {step === 4 ? (
        <section className="mt-4">
          <div className="rounded-card bg-card p-4 shadow-card">
            <h2 className="text-title">预约信息</h2>
            <dl className="mt-2 space-y-1.5 text-body">
              <div className="flex justify-between">
                <dt className="text-ink-secondary">门店</dt>
                <dd>{store?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">入住</dt>
                <dd>{checkin ? `${fmtMD(checkin)} ${weekCN(checkin)}` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">退房</dt>
                <dd>{checkout ? `${fmtMD(checkout)} ${weekCN(checkout)}（${nights} 晚）` : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-secondary">房型</dt>
                <dd>{service ? (service.boardingRoomType ?? service.name) : '—'}</dd>
              </div>
            </dl>
          </div>

          <h2 className="mt-5 text-title">收款方式</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {/* B2-7R（产品裁定A）：次卡仅洗护可用，寄养固定到店付，不渲染次卡扣次入口 */}
            <div className="rounded-card bg-card p-3.5 text-left shadow-card ring-2 ring-brand-primary">
              <span className="block text-body font-semibold">{PAYMENT_MODE_META.pay_at_store.label}</span>
              <span className="mt-0.5 block text-caption text-ink-secondary">
                {PAYMENT_MODE_META.pay_at_store.hint}
              </span>
            </div>
          </div>

          <h2 className="mt-5 text-title">备注</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="饮食习惯、每日喂药、性格注意事项…"
            className="mt-2 w-full rounded-input border border-line bg-card px-3.5 py-3 text-body placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
          />

          {service ? (
            <div className="mt-4 rounded-card bg-card px-4 py-3 shadow-card">
              {/* v1.1-b1：寄养按晚计费（服务端 priceFen=单晚价×ceil((end-start)/24h)），合计区明示口径 */}
              <div className="flex items-center justify-between">
                <span className="text-body text-ink-secondary">合计</span>
                <span className="font-number text-caption text-ink-secondary">
                  单价 {fenToYuan(service.priceFen)}/晚 × {nights} 晚
                </span>
              </div>
              <div className="mt-1 flex items-center justify-end">
                <span className="font-number text-price text-brand-primary">
                  = {fenToYuan(service.priceFen * Math.max(nights, 1))}
                </span>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mt-6">
        {step < 4 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
            className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-ink shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:bg-line disabled:text-ink-placeholder"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            disabled={createM.isPending}
            onClick={() => createM.mutate()}
            className="h-12 w-full rounded-full bg-philia-gradient text-body font-semibold text-ink shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
          >
            {createM.isPending ? '提交中…' : '确认预约'}
          </button>
        )}
      </div>
    </div>
  );
}
