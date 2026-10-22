/**
 * 总部台 /hq（PD-71 总部台立壳 · 同仓独立壳：另路由 + 墨轨另导航名「总部台」）
 *
 * ≠控制台（/console＝调参/画布/口令闸）；≠商家端门店档案内嵌块。
 * 本片范围（令包钉死，开挂不扩）：
 * - 连锁门店经营列表（listMine 店域集合，默认仅 status=active；「含已关闭」默认不勾，
 *   勾上可见 closed + 「已关闭」徽标）；
 * - hq 行（storeType=hq）可见、无关钮（PD-70 裁②：总部门店记录不可关闭）；
 * - 关店/再开写口 → store.closeStore / store.reopenStore（PD-70 软关语义的最小落口；
 *   未完成履约强警示等完整语义权威=PD-70）；
 * - 克隆写口 → 既有 store.cloneStore 语义（结构克隆、不带员工；仅 active 门店可作源）。
 * 权限闸：owner 可写；manager 页内引导页、clerk 由 ClerkRouteGuard 白名单拦；
 * 服务端 merchantOwnerProcedure 硬闸为准（双闸口径）。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg } from '../components/staff-admin/format';
import { Badge, Btn, Field, inputCls, Modal, toast, ToasterMount } from '../components/staff-admin/ui';
import { useMerchantRole } from '../lib/roles';

type HqStoreRow = {
  id: string;
  name: string;
  storeType: string;
  hqId: string | null;
  status: string;
  groupName: string | null;
};

export default function HqConsolePage() {
  const { trpc, queryClient } = usePhiliaClient();
  const { isOwner } = useMerchantRole();

  /* 店列表默认仅 active；「含已关闭」默认不勾（PD-70 裁③同口径；服务端 listMine.includeClosed） */
  const [includeClosed, setIncludeClosed] = useState(false);
  const mineQ = useQuery({
    queryKey: ['store', 'listMine', includeClosed],
    queryFn: () => trpc.store.listMine.query({ includeClosed }),
    enabled: isOwner,
  });
  const stores = (mineQ.data?.stores ?? []) as HqStoreRow[];
  const visible = stores;

  const [busy, setBusy] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['store', 'listMine'] });

  /* ---- 关店（二次确认 + 勾选「已知晓仍关闭」） ---- */
  const [closeTarget, setCloseTarget] = useState<HqStoreRow | null>(null);
  const [closeAck, setCloseAck] = useState(false);
  const doClose = async () => {
    if (!closeTarget) return;
    setBusy(true);
    try {
      await trpc.store.closeStore.mutate({ storeId: closeTarget.id, acknowledgeOpenFulfillment: closeAck });
      toast(`已关闭「${closeTarget.name}」：历史预约/账/会员/员工全部保留`);
      setCloseTarget(null);
      setCloseAck(false);
      refresh();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ---- 再开 ---- */
  const [reopenTarget, setReopenTarget] = useState<HqStoreRow | null>(null);
  const doReopen = async () => {
    if (!reopenTarget) return;
    setBusy(true);
    try {
      await trpc.store.reopenStore.mutate({ storeId: reopenTarget.id });
      toast(`「${reopenTarget.name}」已重新开业`);
      setReopenTarget(null);
      refresh();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  /* ---- 克隆（既有 cloneStore 语义：结构克隆、不带员工） ---- */
  const [cloneSource, setCloneSource] = useState<HqStoreRow | null>(null);
  const [cloneName, setCloneName] = useState('');
  const doClone = async () => {
    if (!cloneSource || cloneName.trim() === '') return;
    setBusy(true);
    try {
      await trpc.store.cloneStore.mutate({ name: cloneName.trim(), sourceStoreId: cloneSource.id });
      toast(`已克隆出新店「${cloneName.trim()}」：须另行入职员工/排班后方可履约`);
      setCloneSource(null);
      setCloneName('');
      refresh();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!isOwner) {
    return (
      <RoleGuidePage
        title="总部台仅店主可用"
        hint="连锁门店的关闭/再开/克隆属店主动作（服务端 403 硬闸）；请使用店主账号。"
      />
    );
  }

  return (
    <MainScaffold
      title="总部台"
      sub="连锁门店经营壳——关闭/再开/克隆写操作的主写口；≠控制台（调参/画布/口令闸）"
      testid="hq-page"
      actions={
        <label className="flex items-center gap-2 text-caption text-ink-secondary">
          <input
            type="checkbox"
            data-testid="hq-include-closed"
            checked={includeClosed}
            onChange={(e) => setIncludeClosed(e.target.checked)}
          />
          含已关闭
        </label>
      }
    >
      <ToasterMount />
      <section className="rounded-panel bg-card shadow-hairline ring-1 ring-line-ring" data-testid="hq-store-list">
        {mineQ.isPending ? (
          <div className="space-y-3 p-5" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 rounded-control" />
            ))}
          </div>
        ) : mineQ.isError ? (
          <p className="py-12 text-center text-caption text-danger-deep" data-testid="hq-list-error">
            门店列表加载失败：{errMsg(mineQ.error)}
          </p>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-caption text-ink-placeholder" data-testid="hq-list-empty">
            {stores.length === 0 ? '名下暂无门店' : '当前无营业中门店；勾选「含已关闭」可查看已关闭门店'}
          </p>
        ) : (
          <ul className="divide-y divide-line-divider">
            {visible.map((s) => {
              const isHq = s.storeType === 'hq';
              const isClosed = s.status === 'closed';
              return (
                <li
                  key={s.id}
                  data-testid={`hq-store-row-${s.id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body font-semibold text-ink">{s.name}</span>
                      {isHq ? <Badge tone="brand">总部</Badge> : null}
                      {isClosed ? <Badge tone="muted">已关闭</Badge> : null}
                    </div>
                    <div className="mt-0.5 text-caption-xs text-ink-placeholder">
                      {s.groupName ? `分组 ${s.groupName}` : '未分组'}
                    </div>
                  </div>
                  {/* hq 行无关钮（禁关）；closed 店不作克隆源（PD-70 旁注） */}
                  {isHq ? (
                    <span className="text-caption-xs text-ink-placeholder">总部记录不可关闭</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      {isClosed ? (
                        <Btn
                          variant="ghost"
                          size="sm"
                          data-testid={`hq-reopen-open-${s.id}`}
                          onClick={() => setReopenTarget(s)}
                        >
                          重新开业
                        </Btn>
                      ) : (
                        <>
                          <Btn
                            variant="ghost"
                            size="sm"
                            data-testid={`hq-clone-open-${s.id}`}
                            onClick={() => {
                              setCloneName('');
                              setCloneSource(s);
                            }}
                          >
                            克隆新店
                          </Btn>
                          <Btn
                            variant="danger"
                            size="sm"
                            data-testid={`hq-close-open-${s.id}`}
                            onClick={() => {
                              setCloseAck(false);
                              setCloseTarget(s);
                            }}
                          >
                            关闭门店
                          </Btn>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 关店确认弹层（软关警示：历史全留；勾选后可关） */}
      <Modal
        open={closeTarget !== null}
        onClose={() => {
          if (!busy) setCloseTarget(null);
        }}
        title={`关闭门店「${closeTarget?.name ?? ''}」`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCloseTarget(null)} disabled={busy}>
              取消
            </Btn>
            <Btn
              variant="danger"
              data-testid="hq-close-submit"
              disabled={busy || !closeAck}
              onClick={() => void doClose()}
            >
              确认关闭
            </Btn>
          </>
        }
      >
        <div className="space-y-3" data-testid="hq-close-modal">
          <p className="rounded-input bg-danger-light px-3 py-2 text-caption text-danger-deep">
            关闭后该店不再出现在客端附近店/可约列表与默认经营视图；历史预约、账目、会员、员工记录全部保留，不做物理删除。
          </p>
          <label className="flex items-center gap-2 text-caption text-ink">
            <input
              type="checkbox"
              data-testid="hq-close-ack"
              checked={closeAck}
              onChange={(e) => setCloseAck(e.target.checked)}
              disabled={busy}
            />
            已知晓影响，仍要关闭
          </label>
        </div>
      </Modal>

      {/* 再开确认弹层 */}
      <Modal
        open={reopenTarget !== null}
        onClose={() => {
          if (!busy) setReopenTarget(null);
        }}
        title={`重新开业「${reopenTarget?.name ?? ''}」`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setReopenTarget(null)} disabled={busy}>
              取消
            </Btn>
            <Btn data-testid="hq-reopen-submit" disabled={busy} onClick={() => void doReopen()}>
              确认再开
            </Btn>
          </>
        }
      >
        <p className="text-caption text-ink-secondary" data-testid="hq-reopen-modal">
          再开后该店恢复进默认门店列表与客端附近/可约视图（仍受营业时间等既有闸约束）。
        </p>
      </Modal>

      {/* 克隆确认弹层（新店名+警示：结构克隆、不带员工） */}
      <Modal
        open={cloneSource !== null}
        onClose={() => {
          if (!busy) setCloneSource(null);
        }}
        title={`克隆新店（源：${cloneSource?.name ?? ''}）`}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setCloneSource(null)} disabled={busy}>
              取消
            </Btn>
            <Btn
              variant="danger"
              data-testid="hq-clone-submit"
              disabled={busy || cloneName.trim() === ''}
              onClick={() => void doClone()}
            >
              确认克隆
            </Btn>
          </>
        }
      >
        <div className="space-y-3" data-testid="hq-clone-modal">
          <p className="rounded-input bg-danger-light px-3 py-2 text-caption text-danger-deep">
            结构克隆＝档案/服务项/端口配置（商品库存归零）；不带员工与历史数据——新店须另行入职员工并排班后方可履约。
          </p>
          <Field label="新店名称">
            <input
              className={inputCls}
              data-testid="hq-clone-name"
              maxLength={64}
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              disabled={busy}
            />
          </Field>
        </div>
      </Modal>
    </MainScaffold>
  );
}
