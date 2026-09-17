/**
 * 会员 · 次卡 /pass（U3 批次 · 任务 J · 规格书 §9 · 母本试样 558-606 行）
 * （/passes 重定向兼容在路由层；v1.1-b2 B2-7 · P0 资损配套）
 *
 * 数据源：
 * - pass.listForStore：本店全部次卡 + 持卡人昵称/手机号 + usable 快照；
 * - pass.listCustomers：可充次客户下拉（本店有预约或已持本店卡，服务端同口径校验）；
 * - pass.listLogs：扣次（-1）/ 回补（+1）/ 充次（+N）流水，倒序，上限 100。
 *
 * 结构：MainScaffold（title 会员 · 次卡 / sub 含冻结决策 15 原文 / 柠檬钮「＋ 售卡」）
 * → 两栏（1.6fr:1fr）：左=在效次卡表（u3-panel + u3-tbl，按剩余次数排序），
 * 右=扣次流水（u3-todo 工艺：−1 薄荷点 / 正数木点 #D4B896）。
 *
 * 操作（真实链路保留）：
 * - 「售卡 / 充次」→ TopUpDialog 选客户 + 次数 → pass.topUp（无卡建卡/有卡加次，
 *   事务内写 +N 流水）；
 * - 行内「记录」→ LogsModal 看该卡流水。
 * 归属红线由服务端强制（pass.* 均 merchantProcedure 且限定本店 storeId，越店 FORBIDDEN）。
 * 禁编造年费档位/价格；储值不做。次卡无卡种字段——卡种列仅展示 member_pass 行真值（累计充次）。
 */

import { usePhiliaClient } from '@philia/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import MainScaffold, { LemonButton } from '../components/MainScaffold';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { Btn, Field, inputCls, Modal, numStyle, toast, ToasterMount } from '../components/staff-admin/ui';

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

/** 薄荷（扣次 −1）/ 浅木（回补 +1、充次 +N）——试样 todo-row 色点口径 */
const DOT_MINT = '#7FD8BE';
const DOT_WOOD = '#D4B896';

const pad2 = (n: number): string => String(n).padStart(2, '0');
/** 有效期至：YYYY-MM-DD（Montserrat tabular；null=长期有效） */
function isoDate(d: Date | null | undefined): string {
  if (!d) return '长期有效';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 卡状态胶囊：在效 live / 将尽 amber（剩余 ≤2） / 已用完·已过期·已停用 done */
function passStatus(p: PassRow): { cls: string; label: string } {
  if (p.status !== 'active') return { cls: 'u3-st done', label: '已停用' };
  if (p.expiresAt && p.expiresAt.getTime() <= Date.now()) return { cls: 'u3-st done', label: '已过期' };
  if (p.remainTimes <= 0) return { cls: 'u3-st done', label: '已用完' };
  if (p.remainTimes <= 2) return { cls: 'u3-st amber', label: '将尽' };
  return { cls: 'u3-st live', label: '在效' };
}

/** 流水事由（B3-3 口径：+1 含取消回补与商家拒单自动回补，流水字段不区分来源，并列标注） */
function logReason(l: LogRow): string {
  if (l.delta === -1) return '预约扣次 1 次';
  if (l.delta === 1) return '取消/拒单回补 1 次';
  return `商家充次 ${l.delta} 次`;
}

/** 充次对话框：选客户 + 次数（售卡=无卡客户自动建卡，同一条 topUp 链路） */
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
      title="售卡 / 充次"
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
        <Field label="客户" hint="仅列出本店客户（有本店预约记录或已持本店次卡）；无卡客户将自动建卡（售卡）">
          <select className={inputCls} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">请选择客户</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname ?? '未命名'}{c.phone ? `（${c.phone}）` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="次数" hint="1-999；次卡仅适用于洗护服务">
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

/** 流水对话框：某张卡的扣次/回补/充次记录（现有链路保留） */
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
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-input bg-canvas" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="py-6 text-center text-caption text-ink-placeholder">暂无流水</p>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-2.5 rounded-input bg-canvas px-3 py-2.5">
              <i
                className="h-2 w-2 flex-none rounded-full"
                style={{ background: l.delta === -1 ? DOT_MINT : DOT_WOOD }}
              />
              <div className="flex-1">
                <span className="text-caption font-semibold text-ink">{logReason(l)}</span>
                {l.appointmentCode ? (
                  <span className="ml-2 text-caption text-ink-secondary">预约单 {l.appointmentCode}</span>
                ) : null}
                <span className="ml-2 block text-caption text-ink-placeholder sm:inline" style={numStyle}>
                  {fmtDateTime(l.createdAt)}
                </span>
              </div>
              <span className="font-number text-caption font-extrabold tabular-nums text-ink">
                {l.delta > 0 ? `+${l.delta}` : l.delta}
              </span>
            </div>
          ))}
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
  const logsQ = useQuery({
    queryKey: ['pass', 'listLogs', 'store'],
    queryFn: () => trpc.pass.listLogs.query({}),
  });
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [presetUserId, setPresetUserId] = useState<string | null>(null);
  const [logsFor, setLogsFor] = useState<PassRow | null>(null);

  const passes = (passesQ.data ?? []) as PassRow[];
  /** 左栏按剩余次数排序（母本「按剩余次数」口径；剩余相同按创建倒序稳定） */
  const sorted = [...passes].sort((a, b) => b.remainTimes - a.remainTimes);
  const logs = (logsQ.data ?? []) as LogRow[];
  const activeCount = passes.filter((p) => p.usable).length;

  const openTopUp = (userId: string | null) => {
    setPresetUserId(userId);
    setTopUpOpen(true);
  };

  return (
    <MainScaffold
      testid="pass-page"
      title="会员 · 次卡"
      sub={`在效次卡 ${activeCount} 张 · 年费会员细则待定（冻结决策 15）`}
      actions={
        <LemonButton testid="pass-sell" onClick={() => openTopUp(null)}>
          ＋ 售卡
        </LemonButton>
      }
    >
      <ToasterMount />
      <div className="grid grid-cols-1 gap-[14px] xl:grid-cols-[1.6fr_1fr]">
        {/* 左：在效次卡表 */}
        <div className="u3-panel">
          <div className="u3-panel-head">
            <h3>在效次卡</h3>
            <span className="aside">按剩余次数</span>
          </div>
          {passesQ.isPending ? (
            <div className="space-y-2 px-[17px] pb-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
              ))}
            </div>
          ) : passesQ.isError ? (
            <p className="px-[17px] pb-5 pt-2 text-xs text-[rgba(74,59,46,.62)]">
              次卡列表加载失败：{errMsg(passesQ.error)}
            </p>
          ) : passes.length === 0 ? (
            <p className="px-[17px] pb-8 pt-3 text-center text-xs text-[rgba(74,59,46,.62)]">
              还没有客户买次卡——洗护 10 次卡是老客最爱
            </p>
          ) : (
            <table className="u3-tbl">
              <thead>
                <tr>
                  <th>客户</th>
                  <th>卡种</th>
                  <th>剩余</th>
                  <th>有效期至</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const st = passStatus(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <span className="font-bold text-ink">{p.customerNickname ?? '未命名'}</span>
                        {p.customerPhone ? (
                          <div className="mt-0.5 font-number text-[11px] tabular-nums text-[rgba(74,59,46,.42)]">
                            尾号 {p.customerPhone.slice(-4)}
                          </div>
                        ) : null}
                      </td>
                      <td className="text-[rgba(74,59,46,.62)]">
                        次卡
                        <span className="ml-1 font-number tabular-nums">共 {p.totalTimes} 次</span>
                      </td>
                      <td>
                        <span className="font-number text-sm font-extrabold tabular-nums text-ink">
                          {p.remainTimes}
                        </span>
                        <span className="ml-0.5 text-[11px] text-[rgba(74,59,46,.42)]">次</span>
                      </td>
                      <td className="font-number tabular-nums text-[rgba(74,59,46,.62)]">
                        {isoDate(p.expiresAt)}
                      </td>
                      <td>
                        <span className={st.cls}>{st.label}</span>
                      </td>
                      <td>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            data-testid={`pass-topup-${p.id}`}
                            onClick={() => openTopUp(p.userId)}
                            className="text-[11px] font-bold text-ink transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                          >
                            充次
                          </button>
                          <button
                            type="button"
                            data-testid={`pass-logs-${p.id}`}
                            onClick={() => setLogsFor(p)}
                            className="text-[11px] font-semibold text-[rgba(74,59,46,.62)] transition-transform duration-120 ease-philia-spring active:scale-[0.98]"
                          >
                            记录
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 右：扣次流水（todo-row 工艺） */}
        <div className="u3-panel">
          <div className="u3-panel-head">
            <h3>扣次流水</h3>
            <span className="aside">近 100 条 · 倒序</span>
          </div>
          {logsQ.isPending ? (
            <div className="space-y-2 px-[17px] pb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-[6px] bg-[rgba(74,59,46,.06)]" />
              ))}
            </div>
          ) : logsQ.isError ? (
            <p className="px-[17px] pb-5 pt-2 text-xs text-[rgba(74,59,46,.62)]">
              流水加载失败：{errMsg(logsQ.error)}
            </p>
          ) : logs.length === 0 ? (
            <p className="px-[17px] pb-8 pt-3 text-center text-xs text-[rgba(74,59,46,.62)]">
              暂无扣次流水——预约扣次、取消/拒单回补、售卡充次都会记在这里
            </p>
          ) : (
            <div>
              {logs.map((l) => (
                <div key={l.id} className="u3-todo">
                  <i
                    className="dot"
                    style={{ background: l.delta === -1 ? DOT_MINT : DOT_WOOD }}
                  />
                  <div className="tx">
                    {l.customerNickname ?? '客户'} · {logReason(l)}
                    <small>
                      {fmtDateTime(l.createdAt)}
                      {l.appointmentCode ? ` · 预约单 ${l.appointmentCode}` : ''}
                    </small>
                  </div>
                  <span className="n">{l.delta > 0 ? `+${l.delta}` : `−${Math.abs(l.delta)}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <TopUpDialog open={topUpOpen} onClose={() => setTopUpOpen(false)} presetUserId={presetUserId} />
      <LogsModal pass={logsFor} onClose={() => setLogsFor(null)} />
    </MainScaffold>
  );
}
