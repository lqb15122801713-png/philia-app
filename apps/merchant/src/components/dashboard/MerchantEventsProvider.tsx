/**
 * 商家端 SSE 总线（契约 docs/MERCHANT-CONTRACTS.md §通用约定 · T4.1）
 *
 * 全端单连接，DashboardPage / TabBar 等经 context 订阅，避免多处各自建连：
 * - clientId 复用 localStorage `philia.sseClientId`（与客户/员工端同一键，
 *   服务端按 user_id + client_id 登记订阅）；
 * - 先 push.subscribe（appType='merchant'）登记，失败 5s 重试直到成功；
 * - 成功后连 GET /api/events?client_id=…（服务端按角色自动挂
 *   user:{id} + store:{storeId} 频道，见 server/src/routes/events.ts channelsForUser）；
 * - 事件集中按 envelope.id 去重（FIFO 500；续传补发/多端同事件会重复到达）后 fan-out；
 * - 断线重连 fan-out onReconnect（页面应在此全量对齐，漏帧之外的变更也能追上）。
 */

import {
  getApiBase,
  useEventSource,
  useMe,
  usePhiliaClient,
  type EventEnvelope,
} from '@philia/shared'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const CLIENT_ID_KEY = 'philia.sseClientId'

/** SSE clientId：localStorage 持久化（push.subscribe 与 /api/events 共用） */
function getClientId(): string {
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    // localStorage 不可用（隐私模式等）：退化为会话内随机 id
    return `merchant-${Math.random().toString(36).slice(2)}`
  }
}

export interface MerchantEventsValue {
  /** SSE 是否在线（false 时页面应启用轮询兜底） */
  connected: boolean
  /** 注册事件监听（已按 envelope.id 去重）；返回取消注册函数 */
  onEvent: (listener: (envelope: EventEnvelope) => void) => () => void
  /** 注册断线重连回调（页面应全量对齐）；返回取消注册函数 */
  onReconnect: (listener: () => void) => () => void
}

const MerchantEventsContext = createContext<MerchantEventsValue | null>(null)

/** 取商家端事件总线；未装 Provider 时抛错（检查 App.tsx 装配） */
export function useMerchantEvents(): MerchantEventsValue {
  const v = useContext(MerchantEventsContext)
  if (!v) {
    throw new Error('useMerchantEvents 必须在 <MerchantEventsProvider> 内使用（见 App.tsx）')
  }
  return v
}

export default function MerchantEventsProvider({ children }: { children: ReactNode }) {
  const { trpc } = usePhiliaClient()
  const { user } = useMe()
  const [clientId] = useState(getClientId)
  const [subscribed, setSubscribed] = useState(false)

  const eventListenersRef = useRef(new Set<(envelope: EventEnvelope) => void>())
  const reconnectListenersRef = useRef(new Set<() => void>())
  // 事件去重：envelope.id Set（FIFO 500）
  const seenRef = useRef<{ set: Set<string>; queue: string[] }>({ set: new Set(), queue: [] })

  // 先登记订阅（弱网失败 5s 重试，直到成功或离开页面）
  useEffect(() => {
    if (!user) return
    let cancelled = false
    let timer: number | undefined
    const attempt = () => {
      trpc.push.subscribe
        .mutate({ clientId, appType: 'merchant' })
        .then(() => {
          if (!cancelled) setSubscribed(true)
        })
        .catch(() => {
          if (!cancelled) timer = window.setTimeout(attempt, 5000)
        })
    }
    attempt()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [trpc, clientId, user])

  const url = subscribed
    ? `${getApiBase()}/api/events?client_id=${encodeURIComponent(clientId)}`
    : null

  const fanOutEvent = useCallback((envelope: EventEnvelope) => {
    const seen = seenRef.current
    if (seen.set.has(envelope.id)) return
    seen.set.add(envelope.id)
    seen.queue.push(envelope.id)
    if (seen.queue.length > 500) {
      const oldest = seen.queue.shift()
      if (oldest) seen.set.delete(oldest)
    }
    eventListenersRef.current.forEach((listener) => {
      try {
        listener(envelope)
      } catch {
        // 单个监听者异常不影响其他监听者
      }
    })
  }, [])

  const fanOutReconnect = useCallback(() => {
    reconnectListenersRef.current.forEach((listener) => {
      try {
        listener()
      } catch {
        // 同上：隔离单个监听者异常
      }
    })
  }, [])

  const { connected } = useEventSource({
    url,
    onEvent: fanOutEvent,
    onReconnect: fanOutReconnect,
  })

  const value = useMemo<MerchantEventsValue>(
    () => ({
      connected,
      onEvent: (listener) => {
        eventListenersRef.current.add(listener)
        return () => {
          eventListenersRef.current.delete(listener)
        }
      },
      onReconnect: (listener) => {
        reconnectListenersRef.current.add(listener)
        return () => {
          reconnectListenersRef.current.delete(listener)
        }
      },
    }),
    [connected],
  )

  return <MerchantEventsContext.Provider value={value}>{children}</MerchantEventsContext.Provider>
}
