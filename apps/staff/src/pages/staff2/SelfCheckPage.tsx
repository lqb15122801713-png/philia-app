/**
 * 每日自检 /self-check（员工端骨架整建批 片 3 · 员工端，coder H）
 *
 * 结构：SkBackBar（fallback=/me）→ 表项（selfCheck.items 端口读）逐项
 * 「完成/未完成」打点 + 选传照片（capture=environment 现场拍）+ 备注 → 提交
 * （selfCheck.submit；全部打点才可交）。今日已交（selfCheck.today 非空）=
 * 只读回显 + 得分/审核状态透出，不可再改。
 * 数据口=collabPort（server 侧 selfCheck namespace 由 coder G 并行施工，签名冻结）。
 * 文案键 copy/selfcheck.ts（SELFCHECK_COPY 族，withCopyOverrides 代理）。
 */

import { getApiBase, Skeleton, uploadImage, usePhiliaClient, useToast } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { SkBackBar, SkEmpty, SkNote } from '@/components/skeleton';
import { scc } from '@/copy/selfcheck';
import { collabOf, type SelfCheckRun } from '@/lib/collabPort';

const ITEMS_KEY = ['selfCheck', 'items'] as const;
const TODAY_KEY = ['selfCheck', 'today'] as const;

interface ItemDraft {
  pass: boolean | null;
  photoUrl: string | null;
  note: string;
}

/** 审核状态透出（缺省 pending） */
function auditLabel(run: SelfCheckRun): string {
  if (run.status === 'approved') return scc('sck.auditApproved');
  if (run.status === 'rejected') return scc('sck.auditRejected');
  return scc('sck.auditPending');
}

export default function SelfCheckPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast();
  const port = useMemo(() => collabOf(trpc), [trpc]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoFor, setPhotoFor] = useState<string | null>(null);

  const itemsQ = useQuery({
    queryKey: ITEMS_KEY,
    queryFn: () => port.selfCheck.items.query(),
  });
  const todayQ = useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => port.selfCheck.today.query(),
  });

  const items = useMemo(() => itemsQ.data?.items ?? [], [itemsQ.data]);
  const todayRun = todayQ.data?.run ?? null;

  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>({});
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const draftOf = (key: string): ItemDraft => drafts[key] ?? { pass: null, photoUrl: null, note: '' };
  const patch = (key: string, p: Partial<ItemDraft>) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...draftOf(key), ...p } }));

  const unmarked = items.filter((it) => draftOf(it.key).pass === null).length;

  const onPhotoFile = async (files: FileList) => {
    const key = photoFor;
    const f = files[0];
    if (!key || !f) return;
    setUploading(true);
    try {
      const up = await uploadImage(getApiBase(), f, 'selfcheck/daily');
      patch(key, { photoUrl: up.url });
    } catch (e) {
      showToast(e instanceof Error ? e.message : scc('sck.loadFail'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (unmarked > 0) {
      showToast(scc('sck.unmarked', { n: unmarked }));
      return;
    }
    setBusy(true);
    try {
      await port.selfCheck.submit.mutate({
        items: items.map((it) => {
          const d = draftOf(it.key);
          return {
            key: it.key,
            pass: d.pass === true,
            ...(d.photoUrl ? { photoUrl: d.photoUrl } : {}),
            ...(d.note.trim() ? { note: d.note.trim() } : {}),
          };
        }),
      });
      showToast(scc('sck.submitted'));
      void queryClient.invalidateQueries({ queryKey: TODAY_KEY });
    } catch (e) {
      showToast(e instanceof Error ? e.message : scc('sck.loadFail'));
    } finally {
      setBusy(false);
    }
  };

  const loading = itemsQ.isPending || todayQ.isPending;
  const loadError = itemsQ.isError || todayQ.isError;

  return (
    <div className="sk pb-6" data-testid="selfcheck-page">
      <SkBackBar title={scc('sck.title')} note={scc('sck.no')} fallback="/me" />

      <div className="px-[22px] pt-3">
        {loading ? (
          <div className="space-y-2.5" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="u1-card h-14 !rounded-panel" />
            ))}
          </div>
        ) : loadError ? (
          <div className="u1-card p-4 text-center">
            <p className="text-body-sm text-ink-secondary">{scc('sck.loadFail')}</p>
            <button
              type="button"
              onClick={() => {
                void itemsQ.refetch();
                void todayQ.refetch();
              }}
              className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
            >
              {scc('sck.retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <SkEmpty title={scc('sck.empty')} body={scc('sck.emptyBody')} />
        ) : todayRun ? (
          /* ---- 今日已交：只读回显 + 得分/审核状态 ---- */
          <>
            <div className="u1-card p-4 text-center" data-testid="sck-done">
              <p className="text-body-sm font-bold text-ink">{scc('sck.doneTitle')}</p>
              <p className="sk-mono mt-1 text-[28px] font-bold leading-9 text-ink" data-testid="sck-score">
                {scc('sck.score', { score: todayRun.score })}
              </p>
              <span className="mt-1 inline-block rounded-chip bg-brand-primary-light px-1.5 py-px text-caption-xs font-bold text-ink" data-testid="sck-audit">
                {auditLabel(todayRun)}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {items.map((it) => {
                const r = todayRun.items.find((x) => x.key === it.key);
                return (
                  <div key={it.key} className="u1-card flex items-center gap-2 px-4 py-3" data-testid={`sck-ro-${it.key}`}>
                    <span className="min-w-0 flex-1 text-body-sm text-ink">{it.label}</span>
                    {r?.note ? <span className="text-caption-xs text-[rgba(59,46,36,.42)]">{r.note}</span> : null}
                    <span
                      className={`shrink-0 rounded-chip px-1.5 py-px text-caption-xs font-bold ${
                        r?.pass ? 'bg-success-light text-success-deep' : 'bg-danger-light text-danger-deep'
                      }`}
                    >
                      {r?.pass ? scc('sck.pass') : scc('sck.fail')}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* ---- 打点表单 ---- */
          <>
            <SkNote>{scc('sck.aside')}</SkNote>
            <div className="mt-2 space-y-2">
              {items.map((it) => {
                const d = draftOf(it.key);
                return (
                  <div key={it.key} className="u1-card px-4 py-3" data-testid={`sck-item-${it.key}`}>
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-body-sm font-semibold text-ink">{it.label}</span>
                      <button
                        type="button"
                        aria-pressed={d.pass === true}
                        data-testid={`sck-pass-${it.key}`}
                        onClick={() => patch(it.key, { pass: true })}
                        className={`h-9 rounded-chip px-3 text-caption font-bold transition-transform duration-120 ease-philia-spring active:scale-92 ${
                          d.pass === true ? 'bg-success-light text-success-deep' : 'bg-sunken text-[rgba(59,46,36,.62)]'
                        }`}
                      >
                        {scc('sck.pass')}
                      </button>
                      <button
                        type="button"
                        aria-pressed={d.pass === false}
                        data-testid={`sck-fail-${it.key}`}
                        onClick={() => patch(it.key, { pass: false })}
                        className={`h-9 rounded-chip px-3 text-caption font-bold transition-transform duration-120 ease-philia-spring active:scale-92 ${
                          d.pass === false ? 'bg-danger-light text-danger-deep' : 'bg-sunken text-[rgba(59,46,36,.62)]'
                        }`}
                      >
                        {scc('sck.fail')}
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => {
                          setPhotoFor(it.key);
                          fileRef.current?.click();
                        }}
                        data-testid={`sck-photo-${it.key}`}
                        className="flex h-9 items-center rounded-chip bg-card px-3 text-caption-xs text-[rgba(59,46,36,.42)] [border:1px_dashed_rgba(59,46,36,.25)] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
                      >
                        {d.photoUrl ? scc('sck.photoOn') : scc('sck.photoCta')}
                      </button>
                      <input
                        value={d.note}
                        onChange={(e) => patch(it.key, { note: e.target.value })}
                        maxLength={100}
                        placeholder={scc('sck.notePh')}
                        data-testid={`sck-note-${it.key}`}
                        className="u1-ring h-9 min-w-0 flex-1 rounded-input bg-card px-3 text-caption text-ink placeholder:text-ink-placeholder"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              disabled={busy || uploading || unmarked > 0}
              onClick={() => void submit()}
              data-testid="sck-submit"
              className="mt-3 h-12 min-h-[44px] w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
            >
              {busy ? scc('sck.submitting') : unmarked > 0 ? scc('sck.unmarked', { n: unmarked }) : scc('sck.submit')}
            </button>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void onPhotoFile(e.target.files);
          e.target.value = '';
        }}
      />

      {toastEl}
    </div>
  );
}
