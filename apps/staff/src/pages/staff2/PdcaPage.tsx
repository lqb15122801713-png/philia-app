/**
 * 问题上报 /pdca（员工端骨架整建批 片 3 · 员工端，coder H）
 *
 * 结构：SkBackBar（fallback=/me）→「上报问题」表单（title 必填 + category 下拉
 * 读端口集（service_rules.pdca_categories，缺省回落码内表）+ detail 选填 +
 * 拍照留证选传 ≤3 张（capture=environment 现场拍））→ 问题单列表（状态滤签
 * 全部/待整改/整改中/待复检/已关闭；员工可见本店全部；我是责任人的单可
 * 「开始整改」（open→fixing）/「提交整改」（fixing→recheck，fixNote 必填））。
 * 数据口=collabPort（server 侧 pdca namespace 由 coder G 并行施工，签名冻结）。
 * 文案键 copy/pdca.ts（PDCA_COPY 族，withCopyOverrides 代理）。
 */

import { getApiBase, Skeleton, uploadImage, usePhiliaClient, useToast } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { SkBackBar, SkChips, SkEmpty } from '@/components/skeleton';
import { pcc } from '@/copy/pdca';
import { collabOf, fmtMdHm, readPdcaCategories, type PdcaStatus } from '@/lib/collabPort';

const LIST_KEY = ['pdca', 'list'] as const;
const CATS_KEY = ['staffConfig', 'pdcaCategories'] as const;
const ME_KEY = ['auth', 'me', 'staffDetail'] as const;
const MAX_PHOTOS = 3;

type TabKey = 'all' | PdcaStatus;

const STATUS_LABEL: Record<PdcaStatus, string> = {
  open: pcc('pdc.tabOpen'),
  fixing: pcc('pdc.tabFixing'),
  recheck: pcc('pdc.tabRecheck'),
  closed: pcc('pdc.tabClosed'),
};

export default function PdcaPage() {
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast();
  const port = useMemo(() => collabOf(trpc), [trpc]);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---- 本人（责任人判定） ---- */
  const meQ = useQuery({
    queryKey: ME_KEY,
    queryFn: () => trpc.auth.me.query(),
    staleTime: 300_000,
  });
  const myStaffId = meQ.data?.staff?.id ?? null;

  /* ---- 列表（状态滤签） ---- */
  const [tab, setTab] = useState<TabKey>('all');
  const listQ = useQuery({
    queryKey: [...LIST_KEY, tab],
    queryFn: () => port.pdca.list.query(tab === 'all' ? {} : { status: tab }),
  });
  const issues = useMemo(() => listQ.data?.issues ?? [], [listQ.data]);

  /* ---- 类目集（端口值，缺省回落） ---- */
  const catsQ = useQuery({
    queryKey: CATS_KEY,
    queryFn: () => readPdcaCategories(port),
    staleTime: 300_000,
  });
  const categories = catsQ.data ?? [];

  /* ---- 上报表单 ---- */
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [detail, setDetail] = useState('');
  const [photos, setPhotos] = useState<Array<{ url: string; thumbUrl: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  /* ---- 整改（我是责任人） ---- */
  const [fixFor, setFixFor] = useState<string | null>(null);
  const [fixNote, setFixNote] = useState('');
  const [fixBusy, setFixBusy] = useState(false);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: LIST_KEY });

  const onFiles = async (files: FileList) => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      showToast(pcc('pdc.photoFull', { max: MAX_PHOTOS }));
      return;
    }
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, room)) {
        const up = await uploadImage(getApiBase(), f, 'pdca/raise');
        setPhotos((prev) => [...prev, { url: up.url, thumbUrl: up.thumbUrl }]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : pcc('pdc.loadFail'));
    } finally {
      setUploading(false);
    }
  };

  const raise = async () => {
    if (!title.trim()) {
      showToast(pcc('pdc.titleRequired'));
      return;
    }
    setBusy(true);
    try {
      await port.pdca.raise.mutate({
        title: title.trim(),
        category: category || categories[0] || '其他',
        ...(detail.trim() ? { detail: detail.trim() } : {}),
        ...(photos.length > 0 ? { photoUrls: photos.map((p) => p.url) } : {}),
      });
      showToast(pcc('pdc.submitted'));
      setTitle('');
      setCategory('');
      setDetail('');
      setPhotos([]);
      invalidate();
    } catch (e) {
      showToast(e instanceof Error ? e.message : pcc('pdc.loadFail'));
    } finally {
      setBusy(false);
    }
  };

  const startFix = async (id: string) => {
    setFixBusy(true);
    try {
      await port.pdca.startFix.mutate({ issueId: id });
      showToast(pcc('pdc.fixStarted'));
      invalidate();
    } catch (e) {
      showToast(e instanceof Error ? e.message : pcc('pdc.loadFail'));
    } finally {
      setFixBusy(false);
    }
  };

  const submitFix = async (id: string) => {
    if (!fixNote.trim()) {
      showToast(pcc('pdc.fixNoteRequired'));
      return;
    }
    setFixBusy(true);
    try {
      await port.pdca.submitFix.mutate({ issueId: id, fixNote: fixNote.trim() });
      showToast(pcc('pdc.fixSubmitted'));
      setFixFor(null);
      setFixNote('');
      invalidate();
    } catch (e) {
      showToast(e instanceof Error ? e.message : pcc('pdc.loadFail'));
    } finally {
      setFixBusy(false);
    }
  };

  return (
    <div className="sk pb-6" data-testid="pdca-page">
      <SkBackBar title={pcc('pdc.title')} note={pcc('pdc.no')} fallback="/me" />

      {/* 上报问题表单 */}
      <section className="mt-3" data-testid="pdca-raise">
        <h2 className="px-[22px] pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{pcc('pdc.raiseTitle')}</h2>
        <div className="px-[22px]">
          <div className="u1-card p-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder={pcc('pdc.titlePh')}
              data-testid="pdca-title"
              className="u1-ring h-12 min-h-[44px] w-full rounded-input bg-card px-3 text-body-sm text-ink placeholder:text-ink-placeholder"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label={pcc('pdc.categoryPh')}
              data-testid="pdca-category"
              className="u1-ring mt-2 h-12 min-h-[44px] w-full rounded-input bg-card px-3 text-body-sm text-ink"
            >
              <option value="">{pcc('pdc.categoryPh')}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder={pcc('pdc.detailPh')}
              data-testid="pdca-detail"
              className="u1-ring mt-2 w-full rounded-input bg-card px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-placeholder"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {photos.map((p) => (
                <span key={p.url} className="relative inline-block h-12 w-16 shrink-0">
                  <img src={p.thumbUrl} alt="留证照" className="h-full w-full rounded-chip object-cover" />
                  <button
                    type="button"
                    aria-label="删除这张留证照"
                    onClick={() => setPhotos((prev) => prev.filter((x) => x.url !== p.url))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] text-[#FAF8F2] transition-transform duration-120 ease-philia-spring active:scale-92"
                  >
                    ×
                  </button>
                </span>
              ))}
              {photos.length < MAX_PHOTOS ? (
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  data-testid="pdca-photo-add"
                  className="flex h-12 items-center rounded-chip bg-card px-3 text-caption-xs text-[rgba(59,46,36,.42)] [border:1px_dashed_rgba(59,46,36,.25)] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
                >
                  {pcc('pdc.photoCta', { max: MAX_PHOTOS })}
                </button>
              ) : null}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) void onFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            <button
              type="button"
              disabled={busy || uploading}
              onClick={() => void raise()}
              data-testid="pdca-submit"
              className="mt-2.5 h-12 min-h-[44px] w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
            >
              {busy ? pcc('pdc.submitting') : pcc('pdc.submit')}
            </button>
          </div>
        </div>
      </section>

      {/* 问题单列表（状态滤签） */}
      <section className="mt-4" data-testid="pdca-list">
        <h2 className="px-[22px] pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{pcc('pdc.listTitle')}</h2>
        <div className="px-[22px]">
          <SkChips
            testId="pdca-tab"
            value={tab}
            onChange={(k) => setTab(k as TabKey)}
            options={[
              { key: 'all', label: pcc('pdc.tabAll') },
              { key: 'open', label: pcc('pdc.tabOpen') },
              { key: 'fixing', label: pcc('pdc.tabFixing') },
              { key: 'recheck', label: pcc('pdc.tabRecheck') },
              { key: 'closed', label: pcc('pdc.tabClosed') },
            ]}
          />
          <div className="mt-2">
            {listQ.isPending ? (
              <div className="space-y-2.5" aria-label="加载中">
                {[0, 1].map((i) => (
                  <Skeleton key={i} className="u1-card h-14 !rounded-panel" />
                ))}
              </div>
            ) : listQ.isError ? (
              <div className="u1-card p-4 text-center">
                <p className="text-body-sm text-ink-secondary">{pcc('pdc.loadFail')}</p>
                <button
                  type="button"
                  onClick={() => void listQ.refetch()}
                  className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
                >
                  {pcc('pdc.retry')}
                </button>
              </div>
            ) : issues.length === 0 ? (
              <SkEmpty title={pcc('pdc.empty')} />
            ) : (
              issues.map((it) => {
                const mine = myStaffId !== null && it.assignStaffId === myStaffId;
                return (
                  <div key={it.id} className="u1-card mb-2 px-4 py-3" data-testid={`pdca-row-${it.id}`}>
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-body-sm font-semibold text-ink">{it.title}</span>
                      {mine ? (
                        <span className="shrink-0 rounded-chip bg-brand-primary-light px-1.5 py-px text-caption-xs font-bold text-ink">
                          {pcc('pdc.mine')}
                        </span>
                      ) : null}
                      <span
                        className={`shrink-0 rounded-chip px-1.5 py-px text-caption-xs font-bold ${
                          it.status === 'closed'
                            ? 'bg-sunken text-[rgba(59,46,36,.42)]'
                            : it.status === 'recheck'
                              ? 'bg-success-light text-success-deep'
                              : 'bg-danger-light text-danger-deep'
                        }`}
                      >
                        {STATUS_LABEL[it.status] ?? it.status}
                      </span>
                    </div>
                    <p className="mt-1 text-caption-xs text-[rgba(59,46,36,.62)]">
                      {it.category}
                      <span className="sk-mono ml-2">{fmtMdHm(it.createdAt)}</span>
                    </p>
                    {it.detail ? <p className="mt-1 whitespace-pre-wrap text-caption text-ink">{it.detail}</p> : null}
                    {it.photoUrls.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {it.photoUrls.map((u) => (
                          <img key={u} src={u} alt="留证照" loading="lazy" className="h-12 w-16 rounded-chip object-cover" />
                        ))}
                      </div>
                    ) : null}
                    {it.fixNote ? (
                      <p className="mt-1.5 rounded-chip bg-canvas px-2.5 py-2 text-caption-xs text-[rgba(59,46,36,.62)]">{it.fixNote}</p>
                    ) : null}
                    {/* 我是责任人：open 开始整改 / fixing 提交整改 */}
                    {mine && it.status === 'open' ? (
                      <button
                        type="button"
                        disabled={fixBusy}
                        onClick={() => void startFix(it.id)}
                        data-testid={`pdca-startfix-${it.id}`}
                        className="mt-2 h-10 min-h-[44px] w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
                      >
                        {pcc('pdc.startFix')}
                      </button>
                    ) : null}
                    {mine && it.status === 'fixing' ? (
                      <div className="mt-2">
                        {fixFor === it.id ? (
                          <>
                            <textarea
                              value={fixNote}
                              onChange={(e) => setFixNote(e.target.value)}
                              rows={2}
                              maxLength={300}
                              placeholder={pcc('pdc.fixNotePh')}
                              data-testid={`pdca-fixnote-${it.id}`}
                              className="u1-ring w-full rounded-input bg-card px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-placeholder"
                            />
                            <button
                              type="button"
                              disabled={fixBusy}
                              onClick={() => void submitFix(it.id)}
                              data-testid={`pdca-submitfix-${it.id}`}
                              className="mt-2 h-10 min-h-[44px] w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
                            >
                              {pcc('pdc.submitFix')}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setFixFor(it.id);
                              setFixNote('');
                            }}
                            data-testid={`pdca-openfix-${it.id}`}
                            className="h-10 min-h-[44px] w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
                          >
                            {pcc('pdc.submitFix')}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {toastEl}
    </div>
  );
}
