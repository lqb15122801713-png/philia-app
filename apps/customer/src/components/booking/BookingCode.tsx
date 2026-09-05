/**
 * 预约码（T2.2）：二维码 + 6 位人工核销码，预约成功页与预约详情页共用。
 *
 * 滚动时间窗（防截图冒用，开发方案 §3.3）：
 * - 二维码 payload { v:2, aid, tw, exp, sig }，tw = floor(unix秒 / 300)（5 分钟粒度），
 *   sig = HMAC(aid|tw|exp)；服务端验签只接受当前窗口与上一窗口——
 *   截图转发最快 5 分钟后必然失效。
 * - 本组件每 60s 检查一次当前窗口编号，发现跨窗（nowTw !== 上次取码的 payload.tw）
 *   即重新 appointment.getCode 刷新二维码；服务端同时也接受上一窗口，
 *   故最多 60s 的刷新延迟不会造成误拒。
 * - 二维码本地 QRCode.toDataURL 渲染，不依赖任何网络图片接口。
 * - 下方常显 6 位人工核销码：扫不上就报这个码（手动核销兜底，同一 checkin 逻辑）。
 */

import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import { usePhiliaClient } from '@philia/shared';
import { friendlyError } from './Toast';

/** 二维码滚动时间窗粒度（秒）：5 分钟，与 server CODE_WINDOW_SEC 同步 */
const CODE_WINDOW_SEC = 300;
/** 跨窗检查周期（ms） */
const CHECK_INTERVAL_MS = 60_000;

export default function BookingCode({
  appointmentId,
  size = 220,
}: {
  appointmentId: string;
  size?: number;
}) {
  const { trpc } = usePhiliaClient();
  const [raw, setRaw] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState<string | null>(null);
  const [tw, setTw] = useState<number | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCode = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await trpc.appointment.getCode.query({ appointmentId });
      setRaw(r.raw);
      setManualCode(r.code);
      setTw(r.payload.tw);
      setError(null);
    } catch (err) {
      setError(friendlyError(err, '预约码获取失败'));
    } finally {
      setRefreshing(false);
    }
  }, [trpc, appointmentId]);

  // 首次取码
  useEffect(() => {
    void fetchCode();
  }, [fetchCode]);

  // 每 60s 检查是否跨 5 分钟窗口，跨窗自动重新取码刷新二维码
  useEffect(() => {
    const iv = window.setInterval(() => {
      const nowTw = Math.floor(Date.now() / 1000 / CODE_WINDOW_SEC);
      if (tw !== null && nowTw !== tw) void fetchCode();
    }, CHECK_INTERVAL_MS);
    return () => window.clearInterval(iv);
  }, [tw, fetchCode]);

  // payload → 本地 QR 渲染（无网络依赖）
  useEffect(() => {
    if (!raw) return;
    let cancelled = false;
    QRCode.toDataURL(raw, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError('二维码生成失败，请使用人工核销码');
      });
    return () => {
      cancelled = true;
    };
  }, [raw, size]);

  if (error) {
    return (
      <div className="rounded-card bg-danger-light p-4 text-center">
        <p className="text-body text-danger-deep">{error}</p>
        <button
          type="button"
          onClick={() => void fetchCode()}
          className="mt-3 rounded-full bg-danger px-5 py-2 text-caption font-medium text-white"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="rounded-card bg-white p-3 shadow-card">
        {qrUrl ? (
          <img src={qrUrl} width={size} height={size} alt="预约二维码" className="block" />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center text-caption text-ink-placeholder"
          >
            二维码生成中…
          </div>
        )}
      </div>
      <p className="mt-2 text-caption text-ink-placeholder">
        到店出示此码{refreshing ? ' · 正在刷新…' : ' · 每 5 分钟自动刷新防截图'}
      </p>

      {manualCode ? (
        <div className="mt-4 flex flex-col items-center">
          <p className="font-number text-[28px] font-semibold tracking-[0.35em] text-ink">
            {manualCode}
          </p>
          <p className="mt-1 text-caption text-ink-secondary">扫不上就报这个码（人工核销）</p>
        </div>
      ) : null}
    </div>
  );
}
