/**
 * 员工心声 /voice（员工端骨架整建批 片 3 · 员工端，coder H）
 *
 * 结构：SkBackBar（fallback=/me）→ 提交单（description 必填 + 附图选传 ≤3 张
 * （capture=environment 现场拍）+ 联系方式选填）→ 24h 响应口径注记（读
 * service_rules.voice_sla_hours 端口值，缺省 24）→ 我的心声列表
 * （ticketListMineStaff：状态/回复透出，创建倒序）。
 * 数据口=collabPort（server 侧 serviceLoop 员工面由 coder G 并行施工，签名冻结）。
 * 文案键 copy/voice.ts（VOICE_COPY 族，withCopyOverrides 代理）。
 */

import { getApiBase, Skeleton, uploadImage, usePhiliaClient, useToast } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { SkBackBar, SkEmpty, SkNote } from '@/components/skeleton';
import { vcc } from '@/copy/voice';
import { collabOf, fmtMdHm, readVoiceSlaHours, type VoiceTicket } from '@/lib/collabPort';

const LIST_KEY = ['serviceLoop', 'ticketListMineStaff'] as const;
const SLA_KEY = ['staffConfig', 'voiceSlaHours'] as const;
const MAX_PHOTOS = 3;

/** 状态文案（support_tickets.status：submitted|replied|closed） */
function statusLabel(t: VoiceTicket): string {
  if (t.status === 'replied') return vcc('vce.statusReplied');
  if (t.status === 'closed') return vcc('vce.statusClosed');
  return vcc('vce.statusSubmitted');
}

export default function VoicePage() {
  const { trpc, queryClient } = usePhiliaClient();
  const { showToast, toastEl } = useToast();
  const port = useMemo(() => collabOf(trpc), [trpc]);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ---- 数据 ---- */
  const listQ = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => port.serviceLoopStaff.ticketListMineStaff.query(),
  });
  const slaQ = useQuery({
    queryKey: SLA_KEY,
    queryFn: () => readVoiceSlaHours(port),
    staleTime: 300_000,
  });
  const tickets = useMemo(() => listQ.data ?? [], [listQ.data]);
  const slaHours = slaQ.data ?? 24;

  /* ---- 提交单 ---- */
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [photos, setPhotos] = useState<Array<{ url: string; thumbUrl: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const onFiles = async (files: FileList) => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      showToast(vcc('vce.photoFull', { max: MAX_PHOTOS }));
      return;
    }
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, room)) {
        const up = await uploadImage(getApiBase(), f, 'voice/staff');
        setPhotos((prev) => [...prev, { url: up.url, thumbUrl: up.thumbUrl }]);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : vcc('vce.loadFail'));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!description.trim()) {
      showToast(vcc('vce.descRequired'));
      return;
    }
    setBusy(true);
    try {
      await port.serviceLoopStaff.ticketCreateStaff.mutate({
        description: description.trim(),
        ...(photos.length > 0 ? { photoUrls: photos.map((p) => p.url) } : {}),
        ...(phone.trim() ? { contactPhone: phone.trim() } : {}),
      });
      showToast(vcc('vce.submitted'));
      setDescription('');
      setPhone('');
      setPhotos([]);
      void queryClient.invalidateQueries({ queryKey: LIST_KEY });
    } catch (e) {
      showToast(e instanceof Error ? e.message : vcc('vce.loadFail'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sk pb-6" data-testid="voice-page">
      <SkBackBar title={vcc('vce.title')} note={vcc('vce.no')} fallback="/me" />

      {/* 提交单 */}
      <section className="mt-3" data-testid="voice-form">
        <h2 className="px-[22px] pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{vcc('vce.formTitle')}</h2>
        <div className="px-[22px]">
          <div className="u1-card p-4">
            <p className="text-caption-xs text-[rgba(59,46,36,.62)]">{vcc('vce.formAside')}</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={vcc('vce.descPh')}
              data-testid="voice-desc"
              className="u1-ring mt-2 w-full rounded-input bg-card px-3 py-2.5 text-body-sm text-ink placeholder:text-ink-placeholder"
            />
            {/* 附图（选传 ≤3，现场拍） */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {photos.map((p) => (
                <span key={p.url} className="relative inline-block h-12 w-16 shrink-0">
                  <img src={p.thumbUrl} alt="附图" className="h-full w-full rounded-chip object-cover" />
                  <button
                    type="button"
                    aria-label="删除这张附图"
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
                  data-testid="voice-photo-add"
                  className="flex h-12 items-center rounded-chip bg-card px-3 text-caption-xs text-[rgba(59,46,36,.42)] [border:1px_dashed_rgba(59,46,36,.25)] transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
                >
                  {vcc('vce.photoCta', { max: MAX_PHOTOS })}
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
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              placeholder={vcc('vce.phonePh')}
              data-testid="voice-phone"
              className="u1-ring mt-2 h-12 min-h-[44px] w-full rounded-input bg-card px-3 text-body-sm text-ink placeholder:text-ink-placeholder"
            />
            <button
              type="button"
              disabled={busy || uploading}
              onClick={() => void submit()}
              data-testid="voice-submit"
              className="mt-2.5 h-12 min-h-[44px] w-full rounded-control bg-brand-primary text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50"
            >
              {busy ? vcc('vce.submitting') : vcc('vce.submit')}
            </button>
          </div>
        </div>
        <SkNote>{vcc('vce.slaNote', { h: slaHours })}</SkNote>
      </section>

      {/* 我的心声列表 */}
      <section className="mt-4" data-testid="voice-list">
        <h2 className="px-[22px] pb-1.5 text-caption font-bold tracking-[.08em] text-[rgba(59,46,36,.42)]">{vcc('vce.myList')}</h2>
        <div className="px-[22px]">
          {listQ.isPending ? (
            <div className="space-y-2.5" aria-label="加载中">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="u1-card h-14 !rounded-panel" />
              ))}
            </div>
          ) : listQ.isError ? (
            <div className="u1-card p-4 text-center">
              <p className="text-body-sm text-ink-secondary">{vcc('vce.loadFail')}</p>
              <button
                type="button"
                onClick={() => void listQ.refetch()}
                className="mt-4 h-12 min-h-[44px] min-w-[160px] rounded-control bg-brand-primary px-8 text-body-sm font-semibold text-ink transition-transform duration-120 ease-philia-spring active:scale-92"
              >
                {vcc('vce.retry')}
              </button>
            </div>
          ) : tickets.length === 0 ? (
            <SkEmpty title={vcc('vce.empty')} />
          ) : (
            tickets.map((t) => (
              <div key={t.id} className="u1-card mb-2 px-4 py-3" data-testid={`voice-row-${t.id}`}>
                <div className="flex items-center gap-2">
                  <span className="sk-mono text-caption-xs text-[rgba(59,46,36,.42)]">{t.ticketNo}</span>
                  <span
                    className={`ml-auto rounded-chip px-1.5 py-px text-caption-xs font-bold ${
                      t.status === 'replied'
                        ? 'bg-success-light text-success-deep'
                        : t.status === 'closed'
                          ? 'bg-sunken text-[rgba(59,46,36,.42)]'
                          : 'bg-brand-primary-light text-ink'
                    }`}
                  >
                    {statusLabel(t)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink">{t.description}</p>
                {t.photoUrls.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {t.photoUrls.map((u) => (
                      <img key={u} src={u} alt="附图" loading="lazy" className="h-12 w-16 rounded-chip object-cover" />
                    ))}
                  </div>
                ) : null}
                {t.replyText ? (
                  <p className="mt-2 rounded-chip bg-canvas px-2.5 py-2 text-caption-xs text-[rgba(59,46,36,.62)]">
                    <b className="text-ink">{vcc('vce.replyLead')}：</b>
                    {t.replyText}
                  </p>
                ) : null}
                <div className="sk-mono mt-1.5 text-caption-xs text-[rgba(59,46,36,.42)]">{fmtMdHm(t.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      </section>

      {toastEl}
    </div>
  );
}
