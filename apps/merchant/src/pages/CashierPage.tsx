/**
 * 收银台主屏 /cashier（批次 M1 · 屏一三栏工作台 + 屏二支付面板展开层）
 *
 * 布局（试样拼装规则）：1440 三栏 = 开单区 1fr / 购物车 380px / 挂单队列 260px，
 * 间距 16，栏=纸卡 ring 20 圆角，页边距 16；390 降级 = 单栏 tab（开单/购物车/
 * 挂单流水），零件原样重排（lg: 前缀拼装，零件不变——修订单④）。
 *
 * 数据：
 * - 服务目录 store.getWithServices（active 服务）；商品 mall.listProductsForStore
 *   （仅列在架 status='on'）；待收款 cashier.pendingAppointments；
 *   挂单/今日流水 cashier.listBills（held / today）；
 * - 金额前端预览镜像服务端口径（components/cashier/model.ts computeCart），
 *   提交以服务端重算为准；
 * - SSE（MerchantEventsProvider 全域单连接）：cashier.billHeld/billSettled/
 *   billVoided + appointment.completed/paid → invalidate cashier 相关查询 +
 *   store.dashboardStats/financeStats/pass/products 键；onReconnect 全量对齐。
 *
 * 权限：merchantProcedure 级页面（owner+manager 同进）；撤单/改价/整单优惠
 * owner-only——manager 置灰 + 原因行（服务端硬闸门兜底 FORBIDDEN 如实）。
 *
 * 联动（任务书 §1.5.1）：?pull=<apptId> 启动参数自动把该预约拉入购物车
 * （幂等：已在车内不重复加；已收款/不存在安静 toast）。
 */

import { EventType, usePhiliaClient } from '@philia/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import { TRPCClientError } from '@trpc/client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import CartPanel from '@/components/cashier/CartPanel'
import { DiscountDialog, PriceDialog, VoidDialog } from '@/components/cashier/dialogs'
import HoldPanel from '@/components/cashier/HoldPanel'
import MemberSearch from '@/components/cashier/MemberSearch'
import OfflineBar from '@/components/cashier/OfflineBar'
import {
  enqueueOffline,
  flushOfflineQueue,
  isNetworkError,
  loadOfflineQueue,
  OFFLINE_QUEUE_EVENT,
  offlineQueueSize,
} from '@/components/cashier/offlineQueue'
import PaySheet from '@/components/cashier/PaySheet'
import PickPanel from '@/components/cashier/PickPanel'
import {
  BILLS_TODAY_KEY,
  CASHIER_ROOT_KEY,
  computeCart,
  CURRENT_SHIFT_KEY,
  DAY_CLOSES_KEY,
  discountOverLimit,
  fenToYuan,
  HELD_BILLS_KEY,
  PENDING_APPTS_KEY,
  TODAY_TENDER_KEY,
  toCartSnapshot,
  type BillListRow,
  type CartLine,
  type CashierMember,
  type DiscountType,
  type PendingAppt,
  type SettleInput,
  type StoreService,
} from '@/components/cashier/model'
import { useMerchantEvents } from '@/components/dashboard/MerchantEventsProvider'
import { fullDateLabel, fenToYuanGrouped, STATS_QUERY_KEY } from '@/components/dashboard/utils'
import { errMsg, fmtDateTime, PRODUCTS_KEY, type StoreProduct } from '@/components/mall-admin/format'
import { useMerchantRole } from '@/lib/roles'

type PickTab = 'service' | 'product' | 'pending'
type MobileTab = 'pick' | 'cart' | 'queue'

const FINANCE_ROOT = ['store', 'financeStats'] as const

export default function CashierPage() {
  const { trpc, queryClient } = usePhiliaClient()
  const events = useMerchantEvents()
  const role = useMerchantRole()
  const storeId = role.storeId
  const now = useMemo(() => new Date(), [])

  /* ---------------- 查询 ---------------- */
  const servicesQ = useQuery({
    queryKey: ['store', 'getWithServices', storeId],
    queryFn: () => trpc.store.getWithServices.query({ storeId: storeId! }),
    enabled: !!storeId,
    staleTime: 300_000,
  })
  const productsQ = useQuery({
    queryKey: [...PRODUCTS_KEY, 'cashier-on'],
    queryFn: () => trpc.mall.listProductsForStore.query({ page: 1, pageSize: 100 }),
  })
  const pendingQ = useQuery({
    queryKey: PENDING_APPTS_KEY,
    queryFn: () => trpc.cashier.pendingAppointments.query(),
  })
  const heldQ = useQuery({
    queryKey: HELD_BILLS_KEY,
    queryFn: () => trpc.cashier.listBills.query({ status: 'held' }),
  })
  // M1-补2 G：矩阵总规则② 店员不见流水——clerk 不拉今日流水（右栏同隐）
  const todayQ = useQuery({
    queryKey: BILLS_TODAY_KEY,
    queryFn: () => trpc.cashier.listBills.query({ range: 'today' }),
    enabled: role.canSeeTurnover,
  })
  /**
   * M1-补2 R1：头部「今日已收」改接统一聚合出口 store.todayTenderStats
   * （删掉前端 listBills 自算——§0 取证 610 错数根因：paid_fen 求和混入次卡等值）。
   * clerk：服务端硬遮罩 restricted=true（金额/笔数全 null）→ 隐藏整个金额块。
   */
  const tenderQ = useQuery({
    queryKey: TODAY_TENDER_KEY,
    queryFn: () => trpc.store.todayTenderStats.query(),
  })
  /** 会员次卡真值（与 PassPage 同接口同缓存；扣次闸门 + 取单会员回填共用） */
  const passesQ = useQuery({
    queryKey: ['pass', 'listForStore'],
    queryFn: () => trpc.pass.listForStore.query(),
  })

  const services = servicesQ.data?.services
  const products = useMemo(
    () => (productsQ.data?.items ?? []).filter((p) => p.status === 'on'),
    [productsQ.data],
  )

  /* ---------------- 购物车状态 ---------------- */
  const [lines, setLines] = useState<CartLine[]>([])
  const [member, setMember] = useState<CashierMember | null>(null)
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState(0)
  /** 取单回来的单号（再挂=同号更新轨迹；结账幂等键） */
  const [billNo, setBillNo] = useState<string | null>(null)
  const [creatorLabel, setCreatorLabel] = useState('')
  const [freshHeldNo, setFreshHeldNo] = useState<string | null>(null)
  const [pickTab, setPickTab] = useState<PickTab>('service')
  const [mobileTab, setMobileTab] = useState<MobileTab>('pick')

  const amounts = computeCart(lines, discountType, discountValue)

  const memberPass = member
    ? passesQ.data
      ? (passesQ.data.find((p) => p.userId === member.id) ?? null)
      : undefined
    : null
  const passRemain = memberPass
    ? memberPass.remainTimes
    : (member?.passRemainTimes ?? 0)
  const canUsePass =
    member != null &&
    passRemain > 0 &&
    (memberPass == null ||
      (memberPass.status === 'active' &&
        (memberPass.expiresAt === null || memberPass.expiresAt.getTime() > Date.now())))

  const clearCart = useCallback(() => {
    setLines([])
    setMember(null)
    setDiscountType('none')
    setDiscountValue(0)
    setBillNo(null)
    setCreatorLabel('')
  }, [])

  /* ---------------- 开单动作 ---------------- */
  const addLine = (line: CartLine) => {
    setLines((prev) => {
      const hit = prev.find((l) => l.refId === line.refId)
      if (hit) {
        // 商品行重复点 = 数量 +1；服务/预约行恒 1 不重复入
        if (line.kind !== 'product') return prev
        return prev.map((l) =>
          l.refId === line.refId ? { ...l, qty: Math.min(99, l.qty + 1) } : l,
        )
      }
      return [...prev, line]
    })
  }

  const onAddService = (s: StoreService) =>
    addLine({
      kind: 'service',
      refId: s.id,
      name: s.name,
      spec: s.durationMin ? `约 ${s.durationMin} 分钟` : null,
      qty: 1,
      unitPriceFen: s.priceFen,
      adjustedPriceFen: null,
      paidByPass: false,
      serviceType: s.type,
    })

  const onAddProduct = (p: StoreProduct) =>
    addLine({
      kind: 'product',
      refId: p.id,
      name: p.name,
      spec: `${p.category} · 库存 ${p.stock}`,
      qty: 1,
      unitPriceFen: p.priceFen,
      adjustedPriceFen: null,
      paidByPass: false,
      stock: p.stock,
    })

  const pullAppt = useCallback(
    (a: PendingAppt) => {
      setLines((prev) => {
        if (prev.some((l) => l.refId === a.id)) return prev // 幂等：不重复拉入
        return [
          ...prev,
          {
            kind: 'appointment',
            refId: a.id,
            name: `${a.petName} · ${a.serviceName}`,
            spec: `预约到店付 · ${a.completedAt ? fmtDateTime(a.completedAt) : '—'}`,
            qty: 1,
            unitPriceFen: a.priceFen,
            adjustedPriceFen: null,
            paidByPass: false,
          },
        ]
      })
      setMobileTab((t) => (t === 'pick' ? 'cart' : t)) // 390：拉入直达购物车（3 步链路）
    },
    [],
  )

  /* ?pull=<apptId> 联动：总览待收款 → 自动拉入购物车 */
  const [searchParams, setSearchParams] = useSearchParams()
  const pullId = searchParams.get('pull')
  const pullHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (!pullId || pullHandledRef.current === pullId || !pendingQ.data) return
    pullHandledRef.current = pullId
    const appt = pendingQ.data.find((a) => a.id === pullId)
    if (appt) {
      pullAppt(appt)
      toast(`已拉入待收款预约：${appt.petName} · ${appt.serviceName}`)
    } else {
      toast('该预约已收款或不存在', { icon: 'ℹ️' })
    }
    setSearchParams({}, { replace: true })
  }, [pullId, pendingQ.data, pullAppt, setSearchParams])

  /* ---------------- 挂单 / 取单 / 结账 / 撤单 ---------------- */
  const invalidateCashier = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: CASHIER_ROOT_KEY })
    void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: FINANCE_ROOT })
    // M1-补2 R1：同源聚合出口随收银事件一并失效（三处同数）
    void queryClient.invalidateQueries({ queryKey: TODAY_TENDER_KEY })
    void queryClient.invalidateQueries({ queryKey: CURRENT_SHIFT_KEY })
    void queryClient.invalidateQueries({ queryKey: DAY_CLOSES_KEY })
    void queryClient.invalidateQueries({ queryKey: ['appointment', 'listForStore'] })
    void queryClient.invalidateQueries({ queryKey: ['pass'] })
    void queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY })
  }, [queryClient])

  const holdM = useMutation({
    mutationFn: () => trpc.cashier.hold.mutate(toCartSnapshot(lines, member, discountType, discountValue, billNo ?? undefined)),
    onSuccess: (r) => {
      setFreshHeldNo(r.bill.billNo)
      /**
       * R6-2 挂单即时刷新修法（根因见卷宗：invalidate 前缀失效经微任务调度 +
       * SSE 帧经 outbox→broadcast 一跳，双链路都有可见空窗）——onSuccess 就地
       * 用返回快照乐观插入挂单队列缓存（立即出卡），invalidate 兜底对齐真值，
       * SSE billHeld 事件为双保险。
       */
      const optimistic: BillListRow = {
        ...r.bill,
        buyerName: r.buyerName,
        itemCount: r.items.length,
        summary:
          r.items.length <= 2
            ? r.items.map((i) => i.nameSnapshot).join('、')
            : `${r.items.slice(0, 2).map((i) => i.nameSnapshot).join('、')} 等 ${r.items.length} 项`,
        passFen: 0,
        methods: [],
      }
      queryClient.setQueryData<BillListRow[]>(HELD_BILLS_KEY, (old) => {
        const rest = (old ?? []).filter((b) => b.billNo !== r.bill.billNo)
        return [optimistic, ...rest]
      })
      toast.success(`已挂单 ${r.bill.billNo}`)
      clearCart()
      invalidateCashier()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const resumeM = useMutation({
    mutationFn: (no: string) => trpc.cashier.resume.mutate({ billNo: no }),
    onSuccess: (r) => {
      const svcTypeById = new Map((services ?? []).map((s) => [s.id, s.type] as const))
      setLines(
        r.items.map((it) => ({
          kind: it.kind as CartLine['kind'],
          refId: it.refId,
          name: it.nameSnapshot,
          spec: it.specSnapshot,
          qty: it.qty,
          unitPriceFen: it.unitPriceFen,
          adjustedPriceFen: it.adjustedPriceFen,
          paidByPass: it.paidByPass,
          serviceType: it.kind === 'service' ? svcTypeById.get(it.refId) : undefined,
          stock: null,
        })),
      )
      if (r.bill.customerId) {
        const p = passesQ.data?.find((x) => x.userId === r.bill.customerId)
        setMember({
          id: r.bill.customerId,
          nickname: r.buyerName === '散客' ? null : r.buyerName,
          phoneMasked: r.customerPhoneMasked,
          passRemainTimes: p?.remainTimes ?? 0,
          // 取单快照不含储值域（model.ts CashierMember 注释）：恒 0 → 储值胶囊不出现，
          // 要用储值支付请移除会员重新检索（余额实时口径）
          storedValueBalanceFen: 0,
          appointmentCount: 0,
        })
      } else {
        setMember(null)
      }
      setDiscountType((r.bill.discountType as DiscountType) ?? 'none')
      setDiscountValue(r.bill.discountValue)
      setBillNo(r.bill.billNo)
      setCreatorLabel(r.createdByName ?? '—')
      setMobileTab('cart')
      toast(`已取单 ${r.bill.billNo}`)
      invalidateCashier()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  const onResume = (b: BillListRow) => {
    if (lines.length > 0 && billNo !== b.billNo) {
      toast('请先结账或挂单当前单，再取其他挂单', { icon: 'ℹ️' })
      return
    }
    resumeM.mutate(b.billNo)
  }

  const [payOpen, setPayOpen] = useState(false)
  const [settledInfo, setSettledInfo] = useState<{ billNo: string; paidFen: number } | null>(null)

  /* ---------------- R4 离线暂存 / 补传（断网不静默） ---------------- */
  const [online, setOnline] = useState(() => navigator.onLine)
  const [queueTick, setQueueTick] = useState(0) // 队列变更信号（自派发事件驱动重渲染）
  const [flushing, setFlushing] = useState(false)
  const flushingRef = useRef(false)
  useEffect(() => {
    const onUp = () => setOnline(true)
    const onDown = () => setOnline(false)
    const onQueue = () => setQueueTick((t) => t + 1)
    window.addEventListener('online', onUp)
    window.addEventListener('offline', onDown)
    window.addEventListener(OFFLINE_QUEUE_EVENT, onQueue)
    return () => {
      window.removeEventListener('online', onUp)
      window.removeEventListener('offline', onDown)
      window.removeEventListener(OFFLINE_QUEUE_EVENT, onQueue)
    }
  }, [])
  /** 双信号离线态：浏览器离线 或 SSE 断开（任务书 R4①） */
  const isOffline = !online || !events.connected
  const pendingOffline = useMemo(() => {
    void queueTick
    return loadOfflineQueue()
  }, [queueTick])
  const failedOffline = pendingOffline.filter((e) => e.lastError).length

  /** 离线暂存当前购物车（含已 hold 的 bill_no——补传幂等键） */
  const stageOffline = useCallback(
    (payments: SettleInput['payments']) => {
      const okFlag = enqueueOffline({
        billNo,
        snapshot: toCartSnapshot(lines, member, discountType, discountValue),
        payments,
      })
      if (okFlag) {
        setPayOpen(false)
        setSettledInfo(null)
        clearCart()
        toast('已暂存，待补传 —— 恢复网络后自动补传', { icon: '📥' })
      } else {
        toast.error('暂存队列已满（50 单），请恢复网络后再结账')
      }
    },
    [billNo, lines, member, discountType, discountValue, clearCart],
  )

  const settleM = useMutation({
    mutationFn: (payments: SettleInput['payments']) =>
      trpc.cashier.settle.mutate({
        ...toCartSnapshot(lines, member, discountType, discountValue, billNo ?? undefined),
        payments,
      }),
    onSuccess: (r) => {
      setSettledInfo({ billNo: r.bill.billNo, paidFen: r.bill.paidFen })
      clearCart()
      invalidateCashier()
    },
    onError: (e) => {
      // R4②：结账遇网络层断线 → 转本地暂存（明示「已暂存，待补传」，禁止只转「结账中…」）
      if (isNetworkError(e)) {
        stageOffline(settleM.variables as SettleInput['payments'])
        return
      }
      if (e instanceof TRPCClientError) toast.error(e.message)
      else toast.error('结账失败，请重试')
    },
  })

  /** PaySheet 确认入口：离线直接暂存（不调接口），在线走 settle（网络错误兜底同暂存） */
  const requestSettle = useCallback(
    (payments: SettleInput['payments']) => {
      if (isOffline) {
        stageOffline(payments)
        return
      }
      settleM.mutate(payments)
    },
    // settleM 引用随渲染刷新即可（mutate 幂等安全）
    [isOffline, stageOffline, settleM],
  )

  /* 恢复自动补传（R4③）：回在线且队列非空 → 逐单串行补传，结果明示；
     网络层失败（恢复初期连接未就绪）5s 后自动重试一轮（queueTick 自增重触发） */
  useEffect(() => {
    if (isOffline || flushingRef.current || offlineQueueSize() === 0) return
    flushingRef.current = true
    setFlushing(true)
    void flushOfflineQueue(trpc)
      .then(({ ok, failed, networkDown }) => {
        if (ok > 0) toast.success(`补传成功 ${ok} 单`)
        if (failed.length > 0) {
          toast.error(`补传失败 ${failed.length} 单：${failed[0]!.reason}（已保留暂存，可再次触发或找店长）`)
        }
        // 恢复初期连接未就绪（网络层中断）：5s 后自动重试一轮
        if (networkDown) {
          window.setTimeout(() => setQueueTick((t) => t + 1), 5000)
        }
        invalidateCashier()
      })
      .finally(() => {
        flushingRef.current = false
        setFlushing(false)
      })
  }, [isOffline, queueTick, trpc, invalidateCashier])

  const [voidTarget, setVoidTarget] = useState<{
    billNo: string
    buyerName?: string
    payableFen?: number
    status?: string
  } | null>(null)
  const voidM = useMutation({
    mutationFn: (input: { billNo: string; reason?: string }) => trpc.cashier.voidBill.mutate(input),
    onSuccess: (r) => {
      toast.success(`已撤单 ${r.bill.billNo}（留痕可查）`)
      setVoidTarget(null)
      invalidateCashier()
    },
    onError: (e) => toast.error(errMsg(e)),
  })

  /* ---------------- SSE（全域单连接；对齐 DashboardPage invalidate 模式） ---------------- */
  useEffect(
    () =>
      events.onEvent((envelope) => {
        switch (envelope.type) {
          case EventType.CashierBillHeld:
          case EventType.CashierBillSettled:
          case EventType.CashierBillVoided:
          // M1-补2：反结账/班次/日结事件同链路（同源出口/挂单/流水/日结页全量对齐）
          case EventType.CashierBillReversed:
          case EventType.CashierShiftOpened:
          case EventType.CashierShiftClosed:
          case EventType.CashierDayClosed:
          case EventType.CashierDayCloseReversed:
            invalidateCashier()
            break
          case EventType.AppointmentCompleted:
          case EventType.AppointmentPaid:
          case EventType.AppointmentCancelled:
            // 待收款 tab 数据源联动（完成进 / 收款·取消出）
            void queryClient.invalidateQueries({ queryKey: PENDING_APPTS_KEY })
            void queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY })
            break
          default:
            break
        }
      }),
    [events, invalidateCashier, queryClient],
  )
  useEffect(() => events.onReconnect(invalidateCashier), [events, invalidateCashier])

  /* ---------------- 弹层状态 ---------------- */
  const [priceLine, setPriceLine] = useState<CartLine | null>(null)
  const [discountOpen, setDiscountOpen] = useState(false)

  /* ---------------- 副行真值：今日已收（R1 同源出口）· 挂单 N ----------------
   * M1-补2 R1：删除前端 listBills 自算（§0 取证 610 错数根因——paid_fen 求和
   * 混入次卡等值）；改接 store.todayTenderStats 统一聚合出口。
   * clerk（restricted=true 服务端硬遮罩）隐藏整个金额块（矩阵总规则②）。 */
  const tender = tenderQ.data && !tenderQ.data.restricted ? tenderQ.data : null
  const heldCount = heldQ.data?.length ?? 0

  const pickError =
    pickTab === 'service'
      ? servicesQ.isError
        ? errMsg(servicesQ.error)
        : null
      : pickTab === 'product'
        ? productsQ.isError
          ? errMsg(productsQ.error)
          : null
        : pendingQ.isError
          ? errMsg(pendingQ.error)
          : null
  const pickLoading =
    pickTab === 'service' ? servicesQ.isPending : pickTab === 'product' ? productsQ.isPending : pendingQ.isPending
  const pickRetry = () => {
    if (pickTab === 'service') void servicesQ.refetch()
    else if (pickTab === 'product') void productsQ.refetch()
    else void pendingQ.refetch()
  }

  const mobileTabs: Array<{ key: MobileTab; label: string; n?: number }> = [
    { key: 'pick', label: '开单' },
    { key: 'cart', label: '购物车', n: lines.length },
    { key: 'queue', label: '挂单流水', n: heldCount },
  ]

  return (
    <div className="px-4 pb-6 pt-[22px]" data-testid="cashier-page">
      {/* 标题行（页边距 16，对齐试样拼装规则） */}
      <header className="mb-4">
        <h1 className="text-title-lg font-bold leading-7">收银台</h1>
        <div className="mt-1 text-caption-xs text-[rgba(74,59,46,.42)]">
          {fullDateLabel(now)}
          {/* M1-补2 R1：今日已收=统一聚合出口（同源三处同数）；clerk 隐藏整个金额块 */}
          {tender ? (
            <>
              {' · 今日已收 '}
              <b className="font-number tabular-nums text-ink" data-testid="cashier-today-received">
                ¥{fenToYuanGrouped(tender.receivedTotalFen ?? 0)}
              </b>
            </>
          ) : null}
          {' · 挂单 '}
          <b className="font-number tabular-nums text-ink">{heldCount}</b>
        </div>
        {/* 分列小字：现金类三分列（计入已收）+ 参考列（次卡/储值，永不计入——裁定①） */}
        {tender?.tender ? (
          <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]" data-testid="cashier-today-tender-split">
            现金 <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">¥{fenToYuan(tender.tender.cashFen)}</b>
            {' · 微信 '}
            <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">¥{fenToYuan(tender.tender.wechatFen)}</b>
            {' · 支付宝 '}
            <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">¥{fenToYuan(tender.tender.alipayFen)}</b>
            <span className="mx-1.5 text-[rgba(74,59,46,.2)]">｜</span>
            参考（不计入已收）：次卡 <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">¥{fenToYuan(tender.tender.passFen)}</b>
            {' · 储值 '}
            <b className="font-number tabular-nums text-[rgba(74,59,46,.62)]">¥{fenToYuan(tender.tender.storedValueFen)}</b>
          </div>
        ) : null}
      </header>

      {/* R4 离线状态条（双信号常显 + 本地暂存单数） */}
      <OfflineBar
        offline={isOffline}
        pendingCount={pendingOffline.length}
        failedCount={failedOffline}
        flushing={flushing}
      />

      {/* 390 降级：单栏 tab（零件原样重排，lg 起三栏） */}
      <div className="mb-3 flex gap-1.5 lg:hidden" role="tablist">
        {mobileTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mobileTab === t.key}
            data-testid={`cashier-mtab-${t.key}`}
            onClick={() => setMobileTab(t.key)}
            className={`rounded-full px-3.5 py-[7px] text-caption ${
              mobileTab === t.key ? 'bg-[#4A3B2E] font-semibold text-[#F6F1E3]' : 'text-[rgba(74,59,46,.6)]'
            }`}
          >
            {t.label}
            {t.n ? <span className="ml-1 font-number text-caption-xs tabular-nums opacity-70">{t.n}</span> : null}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[1fr_380px_260px] lg:items-start lg:gap-4">
        {/* 左栏：开单区（P1 会员检索 + tabs/P2 选品） */}
        <section className={`flex-col gap-3 ${mobileTab === 'pick' ? 'flex' : 'hidden'} lg:flex`}>
          <div className="rounded-[20px] bg-[#FFFDF6] p-3.5 shadow-[0_0_0_1px_rgba(74,59,46,.09)]">
            <MemberSearch
              member={member}
              onSelect={(m) => {
                setMember(m)
                // 换绑会员时清掉扣次标记（次卡跟人走）
                setLines((prev) => prev.map((l) => (l.paidByPass ? { ...l, paidByPass: false } : l)))
              }}
              onRemove={() => {
                setMember(null)
                setLines((prev) => prev.map((l) => (l.paidByPass ? { ...l, paidByPass: false } : l)))
              }}
            />
          </div>
          <div className="rounded-[20px] bg-[#FFFDF6] p-3.5 shadow-[0_0_0_1px_rgba(74,59,46,.09)]">
            <PickPanel
              tab={pickTab}
              onTab={setPickTab}
              services={services}
              products={products}
              pending={pendingQ.data}
              loading={pickLoading}
              error={pickError}
              onRetry={pickRetry}
              pulledIds={new Set(lines.filter((l) => l.kind === 'appointment').map((l) => l.refId))}
              onAddService={onAddService}
              onAddProduct={onAddProduct}
              onPullAppt={pullAppt}
            />
          </div>
        </section>

        {/* 中栏：购物车（380px） */}
        <section className={`${mobileTab === 'cart' ? 'block' : 'hidden'} lg:block`}>
          <div className="flex min-h-[320px] flex-col rounded-[20px] bg-[#FFFDF6] p-4 shadow-[0_0_0_1px_rgba(74,59,46,.09)] lg:h-full">
            <CartPanel
              lines={lines}
              memberBound={member !== null}
              canUsePass={canUsePass}
              passRemainTimes={passRemain}
              amounts={amounts}
              discountType={discountType}
              discountValue={discountValue}
              billNo={billNo}
              creatorLabel={billNo ? creatorLabel || '—' : (role.nickname ?? '—')}
              canEditPrice={role.canManage}
              holding={holdM.isPending}
              onQty={(refId, d) =>
                setLines((prev) =>
                  prev.map((l) =>
                    l.refId === refId ? { ...l, qty: Math.min(99, Math.max(1, l.qty + d)) } : l,
                  ),
                )
              }
              onRemove={(refId) => setLines((prev) => prev.filter((l) => l.refId !== refId))}
              onOpenPrice={setPriceLine}
              onOpenDiscount={() => setDiscountOpen(true)}
              onClearDiscount={() => {
                setDiscountType('none')
                setDiscountValue(0)
              }}
              onTogglePassLine={(refId) =>
                setLines((prev) =>
                  prev.map((l) => (l.refId === refId ? { ...l, paidByPass: !l.paidByPass } : l)),
                )
              }
              onHold={() => holdM.mutate()}
              onCheckout={() => {
                if (discountOverLimit(amounts)) {
                  toast.error('整单优惠超过服务/商品行合计，请调整后再结账')
                  return
                }
                setPayOpen(true)
              }}
            />
          </div>
        </section>

        {/* 右栏：挂单队列 + 今日流水（260px；M1-补2 G：clerk 隐藏今日流水——矩阵总规则②） */}
        <section className={`flex-col gap-3 ${mobileTab === 'queue' ? 'flex' : 'hidden'} lg:flex`}>
          <HoldPanel
            held={heldQ.data}
            todayBills={todayQ.data}
            hideToday={!role.canSeeTurnover}
            loading={heldQ.isPending || (role.canSeeTurnover && todayQ.isPending)}
            error={heldQ.isError || (role.canSeeTurnover && todayQ.isError)}
            onRetry={() => {
              void heldQ.refetch()
              if (role.canSeeTurnover) void todayQ.refetch()
            }}
            freshHeldNo={freshHeldNo}
            onResume={onResume}
            onVoid={(b) =>
              setVoidTarget({ billNo: b.billNo, buyerName: b.buyerName, payableFen: b.payableFen, status: b.status })
            }
          />
        </section>
      </div>

      {/* 弹层组（M1-补2：改价/整单优惠 owner|manager；撤单三级全开——补丁①1 仅限未支付单） */}
      <PriceDialog
        line={priceLine}
        canEdit={role.canManage}
        onApply={(refId, adjusted) =>
          setLines((prev) => prev.map((l) => (l.refId === refId ? { ...l, adjustedPriceFen: adjusted } : l)))
        }
        onClose={() => setPriceLine(null)}
      />
      <DiscountDialog
        open={discountOpen}
        discountType={discountType}
        discountValue={discountValue}
        nonApptSubtotalFen={amounts.nonApptSubtotalFen}
        canEdit={role.canManage}
        onApply={(t, v) => {
          setDiscountType(t)
          setDiscountValue(v)
        }}
        onClose={() => setDiscountOpen(false)}
      />
      <VoidDialog
        bill={voidTarget}
        pending={voidM.isPending}
        onConfirm={(reason) => {
          if (!voidTarget) return
          voidM.mutate({ billNo: voidTarget.billNo, reason })
          // 撤的是当前取回的单 → 同步清车
          if (billNo && voidTarget.billNo === billNo) clearCart()
        }}
        onClose={() => setVoidTarget(null)}
      />

      {/* 屏二：支付面板（主屏内展开层，不跳路由；390 全屏）
          R4：离线时确认=本地暂存（requestSettle 内判定），面板文案同步 */}
      <PaySheet
        open={payOpen}
        billNo={billNo}
        amounts={amounts}
        lines={lines}
        member={member}
        pass={memberPass}
        offline={isOffline}
        settling={settleM.isPending}
        settledInfo={settledInfo}
        onTogglePassAll={(on) =>
          setLines((prev) =>
            prev.map((l) =>
              l.kind === 'service' && l.serviceType === 'grooming' ? { ...l, paidByPass: on } : l,
            ),
          )
        }
        onConfirm={requestSettle}
        onClose={() => {
          setPayOpen(false)
          setSettledInfo(null)
        }}
      />
    </div>
  )
}
