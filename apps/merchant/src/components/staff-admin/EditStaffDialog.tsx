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
import { sf } from '../../copy/staff';

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
        <Field label="岗位角色" hint={sf('staff.editRoleHint')}>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value === 'frontdesk' ? 'frontdesk' : 'groomer')}
            className="w-full rounded-control bg-card px-3 py-2 text-body text-ink shadow-hairline ring-1 ring-line-ring focus:outline-none focus:ring-[rgba(59,46,36,.25)]"
            aria-label="岗位角色"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center justify-between rounded-control bg-card px-3 py-2.5 shadow-hairline ring-1 ring-line-ring">
          <div>
            <div className="text-body text-ink">在职状态</div>
            <div className="mt-0.5 text-caption text-ink-placeholder">
              {sf('staff.editSuspendNote')}
            </div>
          </div>
          <Switch checked={active} onChange={setActive} disabled={pending} label="在职状态" />
        </div>

        <p className="text-caption text-ink-placeholder">
          {sf('staff.editSkillNote')}
        </p>

        {error ? <p className="text-body text-danger-deep">{error}</p> : null}
      </div>
    </Modal>
  );
}
