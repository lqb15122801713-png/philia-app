/**
 * 员工角色 / 在职状态编辑器（批次 S1 任务 D · StaffPage）
 *
 * 可改：岗位角色 role（前台 frontdesk / 美容师 groomer，下拉选择）+
 *      在职状态 status（Switch：在职 active / 停用 suspended）。
 * 不可改：技能标签 skills（本批只读，留 S4 派单批）——对话框内注明。
 * 保存 → store.updateStaff（merchant 本店；越店/非商家服务端 FORBIDDEN），
 * 成功 toast「已保存」+ onSaved（staffList invalidate）；失败 toast 服务端原文。
 */

import { usePhiliaClient } from '@philia/shared';
import { useEffect, useState } from 'react';
import { errMsg } from './format';
import { STAFF_ROLE_LABEL, type StaffRow } from './types';
import { Btn, Field, Modal, Switch, toast } from './ui';

const ROLE_OPTIONS = [
  { value: 'frontdesk', label: '前台（扫码核销 / 接待）' },
  { value: 'groomer', label: '美容师（服务执行）' },
] as const;

export default function EditStaffDialog({
  staff,
  open,
  onClose,
  onSaved,
}: {
  staff: StaffRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { trpc } = usePhiliaClient();
  const [role, setRole] = useState<'frontdesk' | 'groomer'>('groomer');
  const [active, setActive] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && staff) {
      setRole(staff.role === 'frontdesk' ? 'frontdesk' : 'groomer');
      setActive(staff.status === 'active');
      setPending(false);
      setError(null);
    }
  }, [open, staff]);

  const dirty = staff !== null && (role !== staff.role || active !== (staff.status === 'active'));

  const save = async () => {
    if (!staff) return;
    setPending(true);
    setError(null);
    try {
      await trpc.store.updateStaff.mutate({
        staffId: staff.id,
        role,
        status: active ? 'active' : 'suspended',
      });
      toast(`已保存：${staff.name} → ${STAFF_ROLE_LABEL[role]} · ${active ? '在职' : '已停用'}`);
      onSaved();
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`编辑员工 · ${staff?.name ?? ''}`}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose} disabled={pending}>
            取消
          </Btn>
          <Btn variant="primary" onClick={() => void save()} disabled={pending || !dirty}>
            {pending ? '保存中…' : '保存'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="岗位角色" hint="前台负责扫码核销与接待；美容师负责服务执行（无核销入口）">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value === 'frontdesk' ? 'frontdesk' : 'groomer')}
            className="w-full rounded-input border border-line bg-card px-3 py-2 text-body text-ink focus:border-brand-primary focus:outline-none"
            aria-label="岗位角色"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center justify-between rounded-input border border-line px-3 py-2.5">
          <div>
            <div className="text-body text-ink">在职状态</div>
            <div className="mt-0.5 text-caption text-ink-placeholder">
              停用后该员工立即无法操作员工端（历史业绩保留）
            </div>
          </div>
          <Switch checked={active} onChange={setActive} disabled={pending} label="在职状态" />
        </div>

        <p className="text-caption text-ink-placeholder">
          技能标签暂为只读（S4 派单批开放编辑）；排班请从列表「排班」入口编辑。
        </p>

        {error ? <p className="text-body text-danger-deep">{error}</p> : null}
      </div>
    </Modal>
  );
}
