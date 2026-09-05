/**
 * QrScanner —— 契约 1（docs/STAFF-CONTRACTS.md）
 *
 * 全屏扫码核销模态：
 * - 黑色取景框 + 中央扫描框 + 四角品牌色描边 + 提示「对准客户预约码」
 * - getUserMedia({ video: { facingMode: 'environment' } }) 取后置摄像头
 * - 解码双路径（§4.2 选型）：
 *   1) 'BarcodeDetector' in window → 原生 detect 帧循环（Chrome / Android）
 *   2) 否则 jsQR + canvas 2d 帧循环（≥4fps：video → drawImage → getImageData → jsQR）
 *      —— iOS Safari / 微信 WebView 走此路径（P6 待 iOS 真机验证）
 * - 解码成功 → 立即停流 → useCheckin({ qr: 原文 })；处理中防重入；
 *   失败 toast 后自动恢复扫码，成功回调 onCheckedIn
 * - 底部「手动输入核销码」次级入口切换 ManualCodeInput（6 位大写）
 * - 关闭 / 卸载均 stop 全部 tracks；摄像头权限被拒 → 友好错误态 + 引导手动输入 +「重试摄像头」
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { toast } from 'sonner';
import { X, SwitchCamera, Keyboard } from 'lucide-react';
import { useCheckin, type CheckinResult } from './useCheckin';
import ManualCodeInput from './ManualCodeInput';

export interface QrScannerProps {
  open: boolean;
  onClose(): void;
  onCheckedIn(result: CheckinResult): void;
}

/** BarcodeDetector 最小类型声明（TS dom lib 未内置） */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
interface BarcodeDetectorCtor {
  new (opts?: { formats?: string[] }): BarcodeDetectorLike;
}

const JSQR_INTERVAL_MS = 200; // 5fps ≥ 4fps 要求
const BRAND = '#D98E5F';

type CamStatus = 'starting' | 'scanning' | 'processing' | 'error';

export default function QrScanner({ open, onClose, onCheckedIn }: QrScannerProps) {
  const { checkin } = useCheckin();
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [status, setStatus] = useState<CamStatus>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  /** 处理中防重入（帧循环可能在 await 期间继续触发） */
  const busyRef = useRef(false);
  /** 组件卸载 / 模态关闭后置位，终止异步回调里的后续动作 */
  const deadRef = useRef(false);

  const stopStream = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current !== undefined) clearInterval(timerRef.current);
    timerRef.current = undefined;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  /** 解码命中：停流 → 核销 → 成功回调 / 失败恢复扫码 */
  const onDecoded = useCallback(
    async (raw: string) => {
      if (busyRef.current || deadRef.current) return;
      busyRef.current = true;
      stopStream();
      setStatus('processing');
      try {
        const result = await checkin({ qr: raw });
        if (deadRef.current) return;
        toast.success('核销成功');
        onCheckedIn(result);
      } catch (err) {
        if (deadRef.current) return;
        toast.error(err instanceof Error ? err.message : '核销失败，请重试');
        // 失败（如码过期）后恢复扫码，便于客户刷新二维码后重扫
        setStatus('starting');
        startRef.current?.();
      } finally {
        busyRef.current = false;
      }
    },
    [checkin, onCheckedIn, stopStream],
  );

  const startRef = useRef<(() => void) | null>(null);

  const start = useCallback(async () => {
    if (deadRef.current) return;
    stopStream();
    setErrorMsg('');
    setStatus('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setErrorMsg('当前环境不支持摄像头（需 HTTPS 或 App 内打开），请改用下方手动输入核销码。');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
    } catch (err) {
      if (deadRef.current) return;
      const name = err instanceof DOMException ? err.name : '';
      setStatus('error');
      setErrorMsg(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? '摄像头权限被拒绝。请在浏览器设置中允许访问摄像头后重试，或使用下方手动输入核销码。'
          : '无法打开摄像头，请检查设备后重试，或使用下方手动输入核销码。',
      );
      return;
    }
    if (deadRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true'); // iOS Safari 必需
    try {
      await video.play();
    } catch {
      /* 部分浏览器自动播放策略下忽略，帧循环会等 readyState */
    }
    if (deadRef.current) return;
    setStatus('scanning');

    /* ---- 解码路径 1：原生 BarcodeDetector ---- */
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (Detector) {
      const detector = new Detector({ formats: ['qr_code'] });
      const loop = async () => {
        if (deadRef.current || busyRef.current) return;
        const v = videoRef.current;
        if (v && v.readyState >= 2) {
          try {
            const codes = await detector.detect(v);
            const hit = codes.find((c) => c.rawValue);
            if (hit) {
              void onDecoded(hit.rawValue);
              return; // 停流后不再排下一帧
            }
          } catch {
            /* 单帧 detect 失败忽略，继续下一帧 */
          }
        }
        rafRef.current = requestAnimationFrame(() => void loop());
      };
      rafRef.current = requestAnimationFrame(() => void loop());
      return;
    }

    /* ---- 解码路径 2：jsQR + canvas 2d（iOS Safari / 微信 WebView 降级，§4.2） ---- */
    const canvas = canvasRef.current ?? document.createElement('canvas');
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setStatus('error');
      setErrorMsg('当前浏览器不支持扫码解码，请使用手动输入核销码。');
      return;
    }
    timerRef.current = setInterval(() => {
      if (deadRef.current || busyRef.current) return;
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      const w = v.videoWidth;
      const h = v.videoHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.drawImage(v, 0, 0, w, h);
      try {
        const img = ctx.getImageData(0, 0, w, h);
        const code = jsQR(img.data, w, h);
        if (code?.data) void onDecoded(code.data);
      } catch {
        /* 单帧解码失败忽略 */
      }
    }, JSQR_INTERVAL_MS);
  }, [deadRef, onDecoded, stopStream]);
  startRef.current = start;

  const handleClose = useCallback(() => {
    deadRef.current = true;
    stopStream();
    onClose();
  }, [onClose, stopStream]);

  /* 开 / 关模态：启动与彻底停流（含卸载清理） */
  useEffect(() => {
    if (!open) return;
    deadRef.current = false;
    busyRef.current = false;
    setMode('scan');
    setStatus('starting');
    void startRef.current?.();
    return () => {
      deadRef.current = true;
      stopStream();
    };
  }, [open, stopStream]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="扫码核销">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <span className="text-base font-medium text-white">扫码核销</span>
        <button
          type="button"
          onClick={handleClose}
          aria-label="关闭"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 active:bg-white/10"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {mode === 'manual' ? (
        <div className="flex flex-1 flex-col justify-center">
          <ManualCodeInput onCheckedIn={onCheckedIn} />
          <button
            type="button"
            onClick={() => {
              setMode('scan');
              setStatus('starting');
              void startRef.current?.();
            }}
            className="mx-6 flex h-14 min-h-[56px] items-center justify-center gap-2 rounded-xl border border-white/30 text-base text-white active:bg-white/10"
          >
            <SwitchCamera className="h-5 w-5" />
            返回扫码
          </button>
        </div>
      ) : (
        <>
          {/* 取景区 */}
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full object-cover" />

            {status === 'error' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
                <p className="text-base leading-relaxed text-white/90">{errorMsg}</p>
                <button
                  type="button"
                  onClick={() => void startRef.current?.()}
                  className="flex h-14 min-h-[56px] w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-[#D98E5F] text-base font-medium text-white active:bg-[#C7692F]"
                >
                  <SwitchCamera className="h-5 w-5" />
                  重试摄像头
                </button>
                <p className="text-sm text-white/60">摄像头不可用？点底部「手动输入核销码」报 6 位码照样核销。</p>
              </div>
            ) : (
              <>
                {/* 中央扫描框 + 四角品牌色描边 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative h-60 w-60">
                    <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-lg border-l-4 border-t-4" style={{ borderColor: BRAND }} />
                    <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-lg border-r-4 border-t-4" style={{ borderColor: BRAND }} />
                    <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-lg border-b-4 border-l-4" style={{ borderColor: BRAND }} />
                    <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-lg border-b-4 border-r-4" style={{ borderColor: BRAND }} />
                  </div>
                </div>
                <p className="absolute inset-x-0 bottom-16 text-center text-base text-white/90">
                  {status === 'processing' ? '核销中…' : '对准客户预约码'}
                </p>
              </>
            )}
          </div>

          {/* 底部次级入口 */}
          <div className="px-6 pb-[max(env(safe-area-inset-bottom),20px)] pt-2">
            <button
              type="button"
              onClick={() => {
                stopStream();
                setMode('manual');
              }}
              className="flex h-14 min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border border-white/30 text-base text-white active:bg-white/10"
            >
              <Keyboard className="h-5 w-5" />
              手动输入核销码
            </button>
          </div>
        </>
      )}
    </div>
  );
}
