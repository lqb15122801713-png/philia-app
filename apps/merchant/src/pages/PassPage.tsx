/**
 * 次卡管理（/passes · v1.1-b2 B2-7 · P0 资损配套）
 *
 * 数据源：
 * - pass.listForStore：本店全部次卡 + 持卡人昵称/手机号 + usable 快照；
 * - pass.listCustomers：可充次客户下拉（本店有预约或已持本店卡，服务端同口径校验）；
 * - pass.listLogs：扣次（-1）/ 回补（+1）/ 充次（+N）流水，倒序。
 *
 * 操作：
 * - 「充次」→ 对话框选客户 + 次数 → pass.topUp（无卡建卡/有卡加次，事务内写 +N 流水）；
 * - 行内「记录」→ 对话框看该卡流水。
 * 归属红线由服务端强制（pass.* 均 merchantProcedure 且限定本店 storeId）。
 *
 * 布局（契约）：平板 lg+ 表格；手机降级紧凑卡片列表（与 /staff 同模式）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { History, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { errMsg, fmtDate, fmtDateTime } from '../components/staff-admin/format';
import { Badge, Btn, Empty, Field, inputCls, Loading, Modal, numStyle, toast, ToasterMount } from '../components/staff-admin/ui';

type PassRow = {
  id: string;
  userId: string;
  totalTimes: number;
  remainTimes: number;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  customerNickname: string | null;
  customerPhone: string | null;
  usable: boolean;
};

type LogRow = {
  id: string;
  passId: string;
  appointmentId: string | null;
  delta: number;
  createdAt: Date;
  customerNickname: string | null;
  appointmentCode: string | null;
};

/** 流水动作文案：-1 扣次 / +1 取消回补 / 其余正数为充次 */
function logLabel(l: LogRow): { text: string; tone: 'danger' | 'success' | 'brand' } {
  if (l.delta === -1) return { text: '预约扣次 -1', tone: 'danger' };
  if (l.delta === 1) return { text: '取消回补 +1', tone: 'success' };
  return { text: `商家充次 +${l.delta}`, tone: 'brand' };
}

function PassStatusBadge({ pass }: { pass: PassRow }) {
  if (pass.status !== 'active') return <Badge tone="muted">已停用</Badge>;
  if (pass.expiresAt && pass.expiresAt.getTime() <= Date.now()) return <Badge tone="danger">已过期</Badge>;
  if (pass.remainTimes <= 0) return <Badge tone="muted">已用完</Badge>;
  return <Badge tone="success">可用</Badge>;
}

/** 充次对话框：选客户 + 次数 */
function TopUpDialog({
  open,
  onClose,
  presetUserId,
}: {
  open: boolean;
  onClose: () => void;
  presetUserId?: string | null;
}) {
  const { trpc, queryClient } = usePhiliaClient();
  const customersQ = useQuery({
    queryKey: ['pass', 'listCustomers'],
    queryFn: () => trpc.pass.listCustomers.query(),
    enabled: open,
  });
  const [userId, setUserId] = useState<string>(presetUserId ?? '');
  const [times, setTimes] = useState('10');

  // 每次打开对话框时同步预设客户（行内「充次」带入该持卡人）
  const [lastPreset, setLastPreset] = useState<string | null | undefined>(undefined);
  if (open && presetUserId !== lastPreset) {
    setLastPreset(presetUserId);
    if (presetUserId) setUserId(presetUserId);
  }
  if (!open && lastPreset !== undefined) {
    setLastPreset(undefined);
    setUserId('');
    setTimes('10');
  }

  const topUpM = useMutation({
    mutationFn: () => trpc.pass.topUp.mutate({ userId, times: Number(times) }),
    onSuccess: (r) => {
      toast(`充次成功：剩余 ${r.pass.remainTimes} 次（共 ${r.pass.totalTimes} 次）`);
      void queryClient.invalidateQueries({ queryKey: ['pass'] });
      onClose();
    },
    onError: (e) => toast(errMsg(e), 'error'),
  });

  const customers = customersQ.data?.customers ?? [];
  const timesNum = Number(times);
  const valid = userId !== '' && Number.isInteger(timesNum) && timesNum >= 1 && timesNum <= 999;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="次卡充次"
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>取消</Btn>
          <Btn variant="primary" disabled={!valid || topUpM.isPending} onClick={() => topUpM.mutate()}>
            {topUpM.isPending ? '提交中…' : '确认充次'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="客户" hint="仅列出本店客户（有本店预约记录或已持本店次卡）">
          <select className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">请选择客户</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname ?? '未命名'}{c.phone ? `（${c.phone}）` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="充次次数" hint="1-999；无卡客户将自动建卡">
          <input
            className={inputCls}
            type="number"
            min={1}
            max={999}
            value={times}
            onChange={(e) => setTimes(e.target.value)}
            style={numStyle}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** 流水对话框：某张卡的扣次/回补/充次记录 */
function LogsModal({ pass, onClose }: { pass: PassRow | null; onClose: () => void }) {
  const { trpc } = usePhiliaClient();
  const logsQ = useQuery({
    queryKey: ['pass', 'listLogs', pass?.id],
    queryFn: () => trpc.pass.listLogs.query({ passId: pass!.id }),
    enabled: pass !== null,
  });
  const logs = (logsQ.data ?? []) as LogRow[];
  return (
    <Modal open={pass !== null} onClose={onClose} title={`次卡流水 · ${pass?.customerNickname ?? ''}`}>
      {logsQ.isPending ? (
        <Loading />
      ) : logs.length === 0 ? (
        <Empty title="暂无流水" />
      ) : (
        <div className="space-y-2">
          {logs.map((l) => {
            const { text, tone } = logLabel(l);
            return (
              <div key={l.id} className="flex items-center justify-between rounded-input bg-canvas px-3 py-2.5">
                <div>
                  <Badge tone={tone}>{text}</Badge>
                  {l.appointmentCode ? (
                    <span className="ml-2 text-caption text-ink-secondary">预约单 {l.appointmentCode}</span>
                  ) : null}
                  <span className="ml-2 block text-caption text-ink-placeholder sm:inline" style={numStyle}>
                    {fmtDateTime(l.createdAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export default function PassPage() {
  const { trpc } = usePhiliaClient();
  const passesQ = useQuery({
    queryKey: ['pass', 'listForStore'],
    queryFn: () => trpc.pass.listForStore.query(),
  });
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [presetUserId, setPresetUserId] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<PassRow | null>(null);

  const passes = (passesQ.data ?? []) as PassRow[];

  const openTopUp = (userId: string | null) => {
    setPresetUserId(userId);
    setTopUpOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <ToasterMount />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-title-lg font-semibold text-ink">次卡管理</h1>
          <p className="mt-0.5 text-caption text-ink-secondary">
            共 {passes.length} 张卡 · 预约扣次自动记账，取消自动回补 · 次卡仅适用于洗护服务
          </p>
        </div>
        <Btn variant="primary" onClick={() => openTopUp(null)}>
          <PlusCircle size={16} strokeWidth={1.5} />
          充次
        </Btn>
      </div>

      {passesQ.isPending ? (
        <Loading />
      ) : passesQ.isError ? (
        <Empty title="次卡列表加载失败" hint="请检查网络后下拉刷新或重新进入" />
      ) : passes.length === 0 ? (
        <Empty title="还没有次卡" hint="点右上角「充次」为本店客户建卡并充入次数" />
      ) : (
        <>
          {/* 平板/桌面：表格 */}
          <div className="hidden overflow-hidden rounded-card bg-card shadow-card lg:block">
            <table className="w-full text-left text-body">
              <thead>
                <tr className="border-b border-line-divider text-caption text-ink-secondary">
                  <th className="px-4 py-3 font-medium">客户</th>
                  <th className="px-4 py-3 font-medium">剩余次数</th>
                  <th className="px-4 py-3 font-medium">累计充次</th>
                  <th className="px-4 py-3 font-medium">有效期</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((p) => (
                  <tr key={p.id} className="border-b border-line-divider last:border-0 hover:bg-canvas">
                    <td className="px-4 py-3">
                      <span className="font-medium text-ink">{p.customerNickname ?? '未命名'}</span>
                      {p.customerPhone ? (
                        <span className="ml-2 text-caption text-ink-secondary" style={numStyle}>{p.customerPhone}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink" style={numStyle}>{p.remainTimes}</td>
                    <td className="px-4 py-3 text-ink-secondary" style={numStyle}>{p.totalTimes}</td>
                    <td className="px-4 py-3 text-ink-secondary">{p.expiresAt ? fmtDate(p.expiresAt) : '长期有效'}</td>
                    <td className="px-4 py-3"><PassStatusBadge pass={p} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Btn variant="subtle" size="sm" onClick={() => openTopUp(p.userId)}>
                          <PlusCircle size={14} strokeWidth={1.5} />
                          充次
                        </Btn>
                        <Btn variant="ghost" size="sm" onClick={() => setLogsFor(p)}>
                          <History size={14} strokeWidth={1.5} />
                          记录
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 手机：紧凑卡片列表 */}
          <div className="space-y-3 lg:hidden">
            {passes.map((p) => (
              <div key={p.id} className="rounded-card bg-card p-4 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-title font-semibold text-ink">{p.customerNickname ?? '未命名'}</span>
                  <PassStatusBadge pass={p} />
                </div>
                <div className="mt-2 flex gap-4 text-caption text-ink-secondary" style={numStyle}>
                  <span>剩余 {p.remainTimes} 次</span>
                  <span>累计充次 {p.totalTimes}</span>
                  <span>{p.expiresAt ? `${fmtDate(p.expiresAt)} 到期` : '长期有效'}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Btn variant="subtle" size="sm" onClick={() => openTopUp(p.userId)}>
                    <PlusCircle size={14} strokeWidth={1.5} />
                    充次
                  </Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setLogsFor(p)}>
                    <History size={14} strokeWidth={1.5} />
                    记录
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <TopUpDialog open={topUpOpen} onClose={() => setTopUpOpen(false)} presetUserId={presetUserId} />
      <LogsModal pass={logsFor} onClose={() => setLogsFor(null)} />
    </div>
  );
}
