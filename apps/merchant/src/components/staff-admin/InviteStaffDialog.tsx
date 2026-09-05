/**
 * 邀请员工弹层（T4.3 · StaffPage）
 *
 * 流程：输入员工花名 → store.inviteStaff → 明文邀请码大号展示 + 复制按钮。
 * 服务端幂等：同店同花名已有「未使用且未过期」的码时复用（reused=true），
 * 已有有效码直接展示，不重复建行。
 * 提示口径（契约/方案 §6）：邀请码 24 小时内有效、仅可使用一次；
 * 明文仅此一次展示，关闭弹层后无法再次查看。
 */

import { usePhiliaClient } from '@philia/shared';
import { Copy, Ticket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errMsg, fmtDateTime } from './format';
import { Badge, Btn, Field, inputCls, Modal, numStyle, toast } from './ui';
import type { InviteResult } from './types';

export default function InviteStaffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { trpc } = usePhiliaClient();
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  // 每次重新打开弹层时重置为输入态（邀请码明文在关闭后不再可查）
  useEffect(() => {
    if (open) {
      setName('');
      setPending(false);
      setResult(null);
    }
  }, [open]);

  const submit = async () => {
    const staffName = name.trim();
    if (!staffName) {
      toast('请输入员工花名', 'error');
      return;
    }
    setPending(true);
    try {
      const r = await trpc.store.inviteStaff.mutate({ staffName });
      setResult(r as InviteResult);
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setPending(false);
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('邀请码已复制');
    } catch {
      // 剪贴板 API 不可用（非安全上下文等）→ 退化方案
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast('邀请码已复制');
      } catch {
        toast('复制失败，请手动抄录', 'error');
      }
      document.body.removeChild(ta);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="邀请员工"
      footer={
        result ? (
          <Btn variant="primary" onClick={onClose}>
            我已保存邀请码
          </Btn>
        ) : (
          <>
            <Btn variant="ghost" onClick={onClose}>
              取消
            </Btn>
            <Btn variant="primary" onClick={() => void submit()} disabled={pending}>
              {pending ? '生成中…' : '生成邀请码'}
            </Btn>
          </>
        )
      }
    >
      {!result ? (
        <div className="space-y-4">
          <Field label="员工花名" hint="邀请成功后将以该花名登记员工档案">
            <input
              className={inputCls}
              value={name}
              maxLength={32}
              placeholder="如：小杏"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
            />
          </Field>
          <p className="text-caption text-ink-placeholder">
            员工在员工端登录后输入邀请码即可绑定本店。邀请码 24 小时内有效、仅可使用一次。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-card bg-sunken px-4 py-6 text-center">
            <div className="mb-2 flex items-center justify-center gap-2 text-caption text-ink-secondary">
              <Ticket size={16} strokeWidth={1.5} />
              员工「{name.trim()}」的邀请码
              {result.reused ? <Badge tone="brand">复用已有有效码</Badge> : null}
            </div>
            <div
              className="select-all font-mono text-3xl font-semibold tracking-[0.3em] text-ink"
              style={numStyle}
            >
              {result.code}
            </div>
            <div className="mt-3">
              <Btn variant="ghost" size="sm" onClick={() => void copyCode(result.code)}>
                <Copy size={14} strokeWidth={1.5} />
                复制邀请码
              </Btn>
            </div>
          </div>
          <div className="space-y-1 text-caption text-ink-secondary">
            <p>{result.notice}</p>
            <p>有效期至：{fmtDateTime(result.expiresAt)}（24 小时内有效、仅可使用一次）</p>
            <p className="text-danger-deep">明文仅此一次展示，关闭本弹层后无法再次查看，请立即复制并转交员工。</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
