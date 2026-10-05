/**
 * SSE Hub —— 内存频道路由表（开发方案 §7.1）
 *
 * v1 部署边界：单实例内存方案，channel → Set<connection> 无法跨进程共享；
 * 未来多副本扩容时仅替换本模块为 Redis pub/sub，event_outbox 发件箱与
 * 续传逻辑天然兼容，无需改动。
 */

import type { EventEnvelope } from './events';

/** 一条在线 SSE 连接 */
export interface HubConnection {
  /** 客户端标识（push_subscriptions.client_id） */
  clientId: string;
  /** 所属用户 ID */
  userId: string;
  /** 应用端类型：customer | merchant | staff */
  appType: string;
  /** 已收到的最后事件 ID（断线续传基线，随收到事件实时更新） */
  lastEventId?: string;
  /** 推送事件信封（实现方负责 SSE 格式化：id/event/data 字段） */
  send(envelope: EventEnvelope): void;
  /** 发送 SSE 注释行（心跳保活用，实现方负责写成 `: <comment>\n\n`） */
  sendComment?(comment: string): void;
}

/** 频道 → 在线连接集合 */
const channelConns = new Map<string, Set<HubConnection>>();
/** 连接 → 已订阅频道集合（反向索引，断开时快速摘除） */
const connChannels = new Map<HubConnection, Set<string>>();

/** 订阅：把连接挂入一组频道 */
export function subscribe(conn: HubConnection, channels: Iterable<string>): void {
  let mine = connChannels.get(conn);
  if (!mine) {
    mine = new Set();
    connChannels.set(conn, mine);
  }
  for (const channel of channels) {
    let set = channelConns.get(channel);
    if (!set) {
      set = new Set();
      channelConns.set(channel, set);
    }
    set.add(conn);
    mine.add(channel);
  }
}

/** 退订：不传 channels 表示摘除该连接的全部订阅（连接断开时调用） */
export function unsubscribe(conn: HubConnection, channels?: Iterable<string>): void {
  const targets = channels ? [...channels] : [...(connChannels.get(conn) ?? [])];
  for (const channel of targets) {
    const set = channelConns.get(channel);
    if (set) {
      set.delete(conn);
      if (set.size === 0) channelConns.delete(channel);
    }
    connChannels.get(conn)?.delete(channel);
  }
  if (!channels) connChannels.delete(conn);
}

/** 向频道内全部在线连接广播信封，返回实际送达的连接数 */
export function broadcast(channel: string, envelope: EventEnvelope): number {
  const set = channelConns.get(channel);
  if (!set || set.size === 0) return 0;
  let delivered = 0;
  for (const conn of set) {
    try {
      conn.send(envelope);
      conn.lastEventId = envelope.id;
      delivered++;
    } catch {
      // 连接写入失败（已断开尚未清理）：摘除，等待下次订阅
      unsubscribe(conn);
    }
  }
  return delivered;
}

/** 某频道是否有在线连接（outbox 清扫重投前置判断） */
export function hasOnlineSubscribers(channel: string): boolean {
  const set = channelConns.get(channel);
  return !!set && set.size > 0;
}

/** 当前有在线连接的频道集合 */
export function onlineChannels(): string[] {
  return [...channelConns.keys()];
}

/** 当前在线连接总数（观测/测试用） */
export function connectionCount(): number {
  return connChannels.size;
}

/** 测试/重启用：清空全部连接与频道 */
export function resetHub(): void {
  channelConns.clear();
  connChannels.clear();
}

/**
 * 心跳：每 25s 向全部在线连接发一行 SSE 注释（`: hb <ts>`），
 * 防代理/网关静默断连。返回停止函数；定时器 unref，不阻止进程退出。
 */
export function startHeartbeat(intervalMs = 25_000): () => void {
  const timer = setInterval(() => {
    const comment = `hb ${Date.now()}`;
    for (const conn of connChannels.keys()) {
      try {
        conn.sendComment?.(comment);
      } catch {
        unsubscribe(conn);
      }
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
