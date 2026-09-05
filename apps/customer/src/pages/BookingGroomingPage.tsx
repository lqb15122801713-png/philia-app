/**
 * 洗护预约（T2.2 · ≤4 屏硬指标）：
 *   屏1 选服务项（getWithServices 的 grooming 卡：名称/时长/价格）
 *   屏2 选门店（listNearby 卡；切换联动刷新服务与槽位）
 *   屏3 选员工（随缘 + listStaffPublic 横滑）+ 选时间（SlotPicker 日分组 30min 槽格，满槽灰显）
 *   屏4 确认（选宠物 / 收款方式 / 备注 → appointment.create → /booking/success?aid=）
 * 顶部步骤条 + 已选条件摘要胶囊（点击回跳修改）；提交 loading；冲突/满槽友好 toast。
 *
 * 说明：appointment.create 暂无 staffId 入参，指定员工以备注前缀「【希望洗护师：X】」
 * 传达门店，待服务端加字段后可无损迁移。
 */

import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhiliaClient } from '@philia/shared';
import PetPicker from '@/components/booking/PetPicker';
import SlotPicker from '@/components/booking/SlotPicker';
import StaffPicker from '@/components/booking/StaffPicker';
import StepIndicator from '@/components/booking/StepIndicator';
import SummaryChips from '@/components/booking/SummaryChips';
import { friendlyError, useToast } from '@/components/booking/Toast';
import { fenToYuan, fmtDateTime, PAYMENT_MODE_META } from '@/components/booking/format';

const STEPS = ['选服务', '选门店', '选时间', '确认'];

export default function BookingGroomingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trpc, queryClient } = usePhiliaClient();
  const { toastEl, showToast } = useToast();

  const [step, setStep] = useState(1);
  const [storeId, setStoreId] = useState<string | null>(searchParams.get('storeId'));
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null); // null = 随缘
  const [slot, setSlot] = useState<Date | null>(null);
  const [petId, setPetId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'pay_at_store' | 'pass_deduct'>('pay_at_store');
  const [note, setNote] = useState('');

  /* ---- 数据 ---- */
  const nearbyQ = useQuery({
    queryKey: ['store', 'listNearby'],
    queryFn: () => trpc.store.listNearby.query({}),
  });
  // URL ?storeId= 优先，否则最近门店（无坐标时列表第一家）
  const effStoreId = storeId ?? nearbyQ.data?.stores[0]?.id ?? null;

  const servicesQ = useQuery({
    queryKey: ['store', 'getWithServices', effStoreId, serviceId],
    queryFn: () =>
      trpc.store.getWithServices.query({
        storeId: effStoreId!,
        serviceId: serviceId ?? undefined,
      }),
    enabled: effStoreId !== null,
  });

  const staffQ = useQuery({
    queryKey: ['store', 'listStaffPublic', effStoreId],
    queryFn: () => trpc.store.listStaffPublic.query({ storeId: effStoreId! }),
    enabled: effStoreId !== null && step >= 3,
  });

  const petsQ = useQuery({
    queryKey: ['pet', 'list'],
    queryFn: () => trpc.pet.list.query(),
    enabled: step >= 4,
  });

  const groomingServices = useMemo(
    () => (servicesQ.data?.services ?? []).filter((s) => s.type === 'grooming'),
    [servicesQ.data],
  );
  const service = groomingServices.find((s) => s.id === serviceId) ?? null;
  const store = servicesQ.data?.store ?? nearbyQ.data?.stores.find((s) => s.id === effStoreId) ?? null;
  const staffName = staffQ.data?.staff.find((s) => s.id === staffId)?.name ?? null;

  /* ---- 联动：换门店清服务/员工/时间；换服务清时间 ---- */
  const pickStore = (id: string) => {
    if (id === effStoreId) return;
    setStoreId(id);
    setServiceId(null);
    setStaffId(null);
    setSlot(null);
  };
  const pickService = (id: string) => {
    setServiceId(id);
    setSlot(null);
  };

  /* ---- 提交 ---- */
  const createM = useMutation({
    mutationFn: () => {
      const noteParts = [
        staffName ? `【希望洗护师：${staffName}】` : '',
        note.trim(),
      ].filter(Boolean);
      return trpc.appointment.create.mutate({
        storeId: effStoreId!,
        petId: petId!,
        serviceId: serviceId!,
        type: 'grooming',
        scheduledStart: slot!,
        paymentMode,
        ...(noteParts.length > 0 ? { note: noteParts.join(' ') } : {}),
      });
    },
    onSuccess: (appt) => {
      void queryClient.invalidateQueries({ queryKey: ['appointment'] });
      navigate(`/booking/success?aid=${encodeURIComponent(appt.id)}`, { replace: true });
    },
    onError: (err) => {
      showToast(friendlyError(err, '预约失败，请稍后再试'));
      // 满槽/冲突：刷新槽位数据让用户重选
      void servicesQ.refetch();
    },
  });

  // 门店无洗护服务（或门店无效致查询失败）时，屏1 允许直接去屏2 换店，不卡死
  const noServices =
    (servicesQ.isSuccess && groomingServices.length === 0) || servicesQ.isError;
  const canNext =
    (step === 1 && (serviceId !== null || noServices)) ||
    (step === 2 && effStoreId !== null) ||
    (step === 3 && slot !== null);

  /* ---- 渲染 ---- */
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A7A6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-title-lg">预约洗护</h1>
      </header>

      <div className="mt-4">
        <StepIndicator steps={STEPS} current={step} />
      </div>

      {/* 已选条件摘要胶囊（点击回跳） */}
      <div className="mt-4">
        <SummaryChips
          chips={[
            ...(service && step > 1
              ? [{ label: '服务', value: service.name, onClick: () => setStep(1) }]
              : []),
            ...(store && step > 2 ? [{ label: '门店', value: store.name, onClick: () => setStep(2) }] : []),
            ...(slot && step > 3
              ? [{ label: '时间', value: fmtDateTime(slot), onClick: () => setStep(3) }]
              : []),
          ]}
        />
      </div>

      {/* 屏1：选服务项 */}
      {step === 1 ? (
        <section className="mt-4">
          {servicesQ.isPending ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-card bg-sunken" />)}</div>
          ) : groomingServices.length === 0 ? (
            <p className="rounded-card bg-sunken px-4 py-8 text-center text-caption text-ink-secondary">
              该门店暂无可约洗护服务，去下一步换家门店看看
            </p>
          ) : (
            <div className="space-y-2">
              {groomingServices.map((s) => {
                const active = s.id === serviceId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickService(s.id)}
                    className={`flex w-full items-center justify-between rounded-card bg-card p-4 text-left shadow-card transition active:scale-[0.99] ${active ? 'ring-2 ring-brand-primary' : ''}`}
                  >
                    <span>
                      <span className="block text-body font-semibold">{s.name}</span>
                      <span className="mt-0.5 block text-caption text-ink-secondary">
                        约 {s.durationMin ?? 60} 分钟
                      </span>
                    </span>
                    <span className="font-number text-price text-brand-primary">{fenToYuan(s.priceFen)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* 屏2：选门店 */}
      {step === 2 ? (
        <section className="mt-4 space-y-2">
          {nearbyQ.isPending ? (
            [1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-card bg-sunken" />)
          ) : (
            (nearbyQ.data?.stores ?? []).map((s) => {
              const active = s.id === effStoreId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickStore(s.id)}
                  className={`w-full rounded-card bg-card p-4 text-left shadow-card transition active:scale-[0.99] ${active ? 'ring-2 ring-brand-primary' : ''}`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-body font-semibold">{s.name}</span>
                    {active ? <span className="text-caption text-brand-primary">当前选择</span> : null}
                  </span>
                  {s.address ? (
                    <span className="mt-0.5 block text-caption text-ink-secondary">{s.address}</span>
                  ) : null}
                </button>
              );
            })
          )}
        </section>
      ) : null}

      {/* 屏3：选员工 + 选时间 */}
      {step === 3 ? (
        <section className="mt-4">
          <h2 className="text-title">选择洗护师</h2>
          <div className="mt-2">
            <StaffPicker
              staff={staffQ.data?.staff ?? []}
              selectedId={staffId}
              onSelect={setStaffId}
              loading={staffQ.isPending}
            />
          </div>

          <h2 className="mt-5 text-title">选择时间</h2>
          <div className="mt-2">
            {store ? (
              <SlotPicker
                store={store}
                slots={servicesQ.data?.slots ?? []}
                selected={slot}
                onSelect={setSlot}
                loading={servicesQ.isPending || servicesQ.isFetching}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 屏4：确认 */}
      {step === 4 ? (
        <section className="mt-4">
          <h2 className="text-title">选择宠物</h2>
          <div className="mt-2">
            <PetPicker
              pets={petsQ.data ?? []}
              selectedId={petId}
              onSelect={setPetId}
              loading={petsQ.isPending}
            />
          </div>

          <h2 className="mt-5 text-title">收款方式</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['pay_at_store', 'pass_deduct'] as const).map((m) => {
              const active = paymentMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMode(m)}
                  className={`rounded-card bg-card p-3.5 text-left shadow-card transition active:scale-[0.99] ${active ? 'ring-2 ring-brand-primary' : ''}`}
                >
                  <span className="block text-body font-semibold">{PAYMENT_MODE_META[m].label}</span>
                  <span className="mt-0.5 block text-caption text-ink-secondary">
                    {PAYMENT_MODE_META[m].hint}
                  </span>
                </button>
              );
            })}
          </div>

          <h2 className="mt-5 text-title">备注</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="毛孩子的注意事项，如怕水、需剃脚底毛…"
            className="mt-2 w-full rounded-input border border-line bg-card px-3.5 py-3 text-body placeholder:text-ink-placeholder focus:border-brand-primary focus:outline-none"
          />

          {service ? (
            <div className="mt-4 flex items-center justify-between rounded-card bg-card px-4 py-3 shadow-card">
              <span className="text-body text-ink-secondary">合计</span>
              <span className="font-number text-price text-brand-primary">{fenToYuan(service.priceFen)}</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 底部 CTA */}
      <div className="mt-6">
        {step < 4 ? (
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setStep(step + 1)}
            className="h-12 w-full rounded-full bg-brand-primary text-body font-semibold text-white shadow-card transition-transform duration-120 ease-philia-spring active:scale-92 disabled:bg-line disabled:text-ink-placeholder"
          >
            下一步
          </button>
        ) : (
          <button
            type="button"
            disabled={petId === null || createM.isPending}
            onClick={() => createM.mutate()}
            className="h-12 w-full rounded-full bg-philia-gradient text-body font-semibold text-white shadow-philia transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
          >
            {createM.isPending ? '提交中…' : '确认预约'}
          </button>
        )}
      </div>
    </div>
  );
}
