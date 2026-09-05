/**
 * ManualCodeInput —— 契约 1 手动核销入口
 *
 * 6 位人工核销码（去混淆字符集 2-9 A-H J-K M-N P-Z，无 0/O、1/I/L）：
 * - 输入自动大写、过滤非合法字符；支持整段粘贴（取前 6 位合法字符）
 * - 满 6 位才点亮提交按钮（≥56px，员工端硬性规格）
 * - 提交 → useCheckin({ code })；错误 toast 展示映射文案
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useCheckin, type CheckinResult } from './useCheckin';

/** 与服务端 MANUAL_CODE_RE 保持一致（去混淆字符集） */
const CODE_RE = /^[2-9A-HJKMNP-Z]{6}$/;
const LEGAL_CHARS_RE = /[2-9A-HJKMNP-Z]/g;

function sanitize(raw: string): string {
  return (raw.toUpperCase().match(LEGAL_CHARS_RE) ?? []).join('').slice(0, 6);
}

export interface ManualCodeInputProps {
  onCheckedIn(result: CheckinResult): void;
}

export default function ManualCodeInput({ onCheckedIn }: ManualCodeInputProps) {
  const { checkin, loading } = useCheckin();
  const [code, setCode] = useState('');
  const ready = CODE_RE.test(code);

  const submit = async () => {
    if (!ready || loading) return;
    try {
      const result = await checkin({ code });
      toast.success('核销成功');
      onCheckedIn(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '核销失败，请重试');
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 px-6 pb-6">
      <label htmlFor="manual-code" className="text-base text-white/80">
        输入 6 位人工核销码
      </label>
      <input
        id="manual-code"
        value={code}
        onChange={(e) => setCode(sanitize(e.target.value))}
        onPaste={(e) => {
          e.preventDefault();
          setCode(sanitize(e.clipboardData.getData('text')));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        inputMode="text"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        maxLength={6}
        placeholder="例如 3K7M9P"
        aria-label="人工核销码"
        className="h-14 w-full rounded-xl border border-white/30 bg-white/10 text-center font-mono text-2xl font-semibold tracking-[0.5em] text-white placeholder:text-white/30 focus:border-[#D98E5F] focus:outline-none"
      />
      <p className="text-sm text-white/60">
        核销码为 6 位字母数字，不含易混淆的 0/O、1/I/L；可在预约详情页查看，或按手机号核对。
      </p>
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!ready || loading}
        className="flex h-14 min-h-[56px] w-full items-center justify-center gap-2 rounded-xl bg-[#D98E5F] text-base font-medium text-white transition-opacity disabled:opacity-40 active:bg-[#C7692F]"
      >
        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
        {loading ? '核销中…' : '确认核销'}
      </button>
    </div>
  );
}
