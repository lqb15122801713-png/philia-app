/**
 * 槽位端口页（端口批片 C · CJ-1002-01 · A5 落地 · 控制台第八域「槽位」）
 *
 * 冻结口径：
 * - 仅 owner：墨轨入口按 isOwner 收起；本页自装页内闸门（非 owner → RoleGuidePage 引导页，
 *   非 403 白屏）；server 端 merchantOwnerProcedure 为硬闸门；
 * - 数据源：slotPort.list（全槽注册表：live 行 + pending 行 + 版本计数 + 操作人昵称）；
 * - 展示：每槽一卡=槽名（slotKey mono + alt 中文名）+ 当前内容预览（live url 有值 → img，
 *   resolveSlotUrl 归一化：/api 前缀拼 getApiBase()，其余原样；url=null → 渐变占位块+「占位中」
 *   签，R10 不画假件）+ 状态签（上线中 / 待审数）+ 版本计数（v{live.version} · 共 N 版）；
 * - 上传替换：hidden file input（accept 图片）→ shared uploadImage（relDir=slots/<slotKey>，
 *   落盘签名 URL）→ slotPort.upload 登记 pending 版（新素材默认待审不上线 D-6）→ toast
 *   「已上传，待审中」；上传中按钮 loading 态；
 * - 待审区（pending 非空才显）：逐条=缩略预览 + 上传时间 + 操作人 + 「点上线」钮
 *   （slotPort.publish：该版→live，旧 live→archived，同槽唯一 live 单事务）；
 * - 回退上一版（slotPort.revert：当前 live→archived、最近 archived→live）；无上线版或
 *   非 pending 版本不足两版时置灰；
 * - 成功后 invalidate ['slotPort'] 全族（list+liveMap，三端 SlotContentLoader 同源键）
 *   + toast；失败 toast 附服务端 message 明文；
 * - 生效口径：点上线/回退即生效=只管新渲染（客户端 120s 轮询兜底，invalidate 立即拉新）。
 */

import { getApiBase, gradients, resolveSlotUrl, Skeleton, uploadImage, usePhiliaClient, type PhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { Badge, Btn, numStyle, toast, ToasterMount } from '../components/staff-admin/ui';
import { cp } from '../copy/copyPort';
import { useMerchantRole } from '../lib/roles';
import { canvasPreviewUrl } from './canvasPreviewUrl';

/* ------------------------------------------------------------------ */
/* 类型锚点（server AppRouter 推导，构建期擦除）                          */
/* ------------------------------------------------------------------ */

type Trpc = PhiliaClient['trpc'];
type ListOut = Awaited<ReturnType<Trpc['slotPort']['list']['query']>>;
type SlotRow = ListOut['slots'][number];
type SlotVersion = NonNullable<SlotRow['live']>;

/** 占位块渐变=shared tokens 唯一来源（端口批片 C 顺带件①：收编字面量，不另写） */
const PLACEHOLDER_GRADIENT = gradients.philiaBanner;

/** D-42 文案与人群编辑字段形（空串=不带该字段；audience 缺省 all；priority 空=不带） */
type SlotCopyFields = { title_main: string; title_sub: string; cta_text: string; audience: 'all' | 'anon' | 'free' | 'anon_free'; priority: string };

/** 槽内容预览（url 有值→img；null→渐变占位块+「占位中」签） */
function SlotPreview({ url, alt, className }: { url: string | null; alt: string; className: string }) {
  const src = resolveSlotUrl(url);
  if (src) {
    return <img src={src} alt={alt} className={`${className} object-cover ring-1 ring-line-ring`} />;
  }
  return (
    <div
      className={`${className} flex items-center justify-center ring-1 ring-line-ring`}
      style={{ background: PLACEHOLDER_GRADIENT }}
    >
      <Badge tone="muted">{cp('slotport.placeholderBadge')}</Badge>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 槽位卡（每槽一卡：预览 + 状态签 + 上传替换/回退 + 待审区）               */
/* ------------------------------------------------------------------ */

function SlotCard({
  slot,
  uploading,
  acting,
  fileRefs,
  onFile,
  onPublish,
  onRevert,
  onUnpublish,
  onPreview,
}: {
  slot: SlotRow;
  uploading: boolean;
  acting: boolean;
  fileRefs: { current: Map<string, HTMLInputElement> };
  onFile: (slotKey: string, alt: string, files: FileList | null, copy: SlotCopyFields) => void;
  onPublish: (versionId: string) => void;
  onRevert: (slotKey: string) => void;
  /* PD-20 D-40：紧急下线（live→archived，槽可无 live；双确认在调用侧） */
  onUnpublish: (slotKey: string) => void;
  /* PD-20 D-41：预览此版（pending 版 iframe 真预览；仅 owner 页内可点） */
  onPreview: (slotKey: string, versionId: string) => void;
}) {
  const alt = slot.live?.contentJson.alt ?? slot.pending[0]?.contentJson.alt ?? slot.slotKey;
  /* 可回退=有上线版 且 非 pending 版本数 ≥2（当前 live + 至少一版 archived） */
  const canRevert = slot.live !== null && slot.totalVersions - slot.pending.length >= 2;
  const disabled = uploading || acting;
  /* D-42 三行文案+人群编辑（选填；随下次上传一并写入 pending 版 contentJson；
     三行制/红线词=server 硬闸，失败明文走 toast） */
  const [copyFields, setCopyFields] = useState<SlotCopyFields>({ title_main: '', title_sub: '', cta_text: '', audience: 'all', priority: '' });

  return (
    <div className="u3-panel mb-3.5" data-testid={`slotport-card-${slot.slotKey}`}>
      <div className="u3-panel-head">
        <h3>
          <span className="font-mono">{slot.slotKey}</span>
        </h3>
        <span className="aside" style={numStyle}>
          {slot.live
            ? cp('slotport.versionInfo', { version: slot.live.version, total: slot.totalVersions })
            : cp('slotport.noLive')}
        </span>
      </div>

      <div className="border-t border-[rgba(44,40,34,.06)] px-[17px] py-[13px]">
        <div className="flex items-start gap-3">
          <SlotPreview
            url={slot.live?.contentJson.url ?? null}
            alt={alt}
            className="h-20 w-32 shrink-0 rounded-input"
          />
          <div className="min-w-0 flex-1">
            <div className="text-caption text-ink">{alt}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {slot.live ? (
                <Badge tone="success">{cp('slotport.liveBadge')}</Badge>
              ) : (
                <Badge tone="muted">{cp('slotport.noLive')}</Badge>
              )}
              {slot.pending.length > 0 ? (
                <Badge tone="brand">{cp('slotport.pendingCount', { n: slot.pending.length })}</Badge>
              ) : null}
            </div>
            {slot.live && slot.live.contentJson.url === null ? (
              <div className="mt-1 text-caption-xs text-[rgba(44,40,34,.42)]">
                {cp('slotport.placeholderNote')}
              </div>
            ) : null}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Btn
                variant="ghost"
                size="sm"
                data-testid={`slotport-upload-${slot.slotKey}`}
                disabled={disabled}
                onClick={() => fileRefs.current.get(slot.slotKey)?.click()}
              >
                {uploading ? cp('slotport.uploading') : cp('slotport.uploadCta')}
              </Btn>
              <Btn
                variant="subtle"
                size="sm"
                data-testid={`slotport-revert-${slot.slotKey}`}
                disabled={disabled || !canRevert}
                onClick={() => onRevert(slot.slotKey)}
              >
                {cp('slotport.revertCta')}
              </Btn>
              {/* D-40 紧急下线（有 live 才出；页级 owner 闸+server merchantOwnerProcedure 硬闸双保险；
                  与页顶「一键关停」支付语义零耦合——本钮只管本槽展示物料） */}
              {slot.live ? (
                <Btn
                  variant="ghost"
                  size="sm"
                  data-testid={`slotport-unpublish-${slot.slotKey}`}
                  disabled={disabled}
                  onClick={() => onUnpublish(slot.slotKey)}
                >
                  {cp('slotport.unpublishCta')}
                </Btn>
              ) : null}
            </div>
            {/* D-42 文案与人群编辑区（选填；值随下次「上传替换」一并写入新 pending 版） */}
            <div className="mt-3 rounded-input bg-[rgba(44,40,34,.03)] p-3" data-testid={`slotport-copyfields-${slot.slotKey}`}>
              <p className="text-caption-xs font-semibold text-[rgba(44,40,34,.42)]">{cp('slotport.copyFieldsTitle')}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-3">
                <label className="block">
                  <span className="text-caption-xs text-[rgba(44,40,34,.62)]">{cp('slotport.fieldTitleMain')}</span>
                  <input
                    type="text"
                    value={copyFields.title_main}
                    data-testid={`slotport-field-title-main-${slot.slotKey}`}
                    onChange={(e) => setCopyFields((s) => ({ ...s, title_main: e.target.value }))}
                    className="mt-1 w-full rounded-input border border-line bg-card px-2.5 py-1.5 text-caption"
                  />
                </label>
                <label className="block">
                  <span className="text-caption-xs text-[rgba(44,40,34,.62)]">{cp('slotport.fieldTitleSub')}</span>
                  <input
                    type="text"
                    value={copyFields.title_sub}
                    data-testid={`slotport-field-title-sub-${slot.slotKey}`}
                    onChange={(e) => setCopyFields((s) => ({ ...s, title_sub: e.target.value }))}
                    className="mt-1 w-full rounded-input border border-line bg-card px-2.5 py-1.5 text-caption"
                  />
                </label>
                <label className="block">
                  <span className="text-caption-xs text-[rgba(44,40,34,.62)]">{cp('slotport.fieldCta')}</span>
                  <input
                    type="text"
                    value={copyFields.cta_text}
                    data-testid={`slotport-field-cta-${slot.slotKey}`}
                    onChange={(e) => setCopyFields((s) => ({ ...s, cta_text: e.target.value }))}
                    className="mt-1 w-full rounded-input border border-line bg-card px-2.5 py-1.5 text-caption"
                  />
                </label>
                <label className="block">
                  <span className="text-caption-xs text-[rgba(44,40,34,.62)]">{cp('slotport.fieldAudience')}</span>
                  <select
                    value={copyFields.audience}
                    data-testid={`slotport-field-audience-${slot.slotKey}`}
                    onChange={(e) => setCopyFields((s) => ({ ...s, audience: e.target.value as SlotCopyFields['audience'] }))}
                    className="mt-1 w-full rounded-input border border-line bg-card px-2.5 py-1.5 text-caption"
                  >
                    <option value="all">{cp('slotport.audienceAll')}</option>
                    <option value="anon">{cp('slotport.audienceAnon')}</option>
                    <option value="free">{cp('slotport.audienceFree')}</option>
                    <option value="anon_free">{cp('slotport.audienceAnonFree')}</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-caption-xs text-[rgba(44,40,34,.62)]">{cp('slotport.fieldPriority')}</span>
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={copyFields.priority}
                    data-testid={`slotport-field-priority-${slot.slotKey}`}
                    onChange={(e) => setCopyFields((s) => ({ ...s, priority: e.target.value }))}
                    className="mt-1 w-full rounded-input border border-line bg-card px-2.5 py-1.5 text-caption"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
        <input
          ref={(el) => {
            if (el) fileRefs.current.set(slot.slotKey, el);
            else fileRefs.current.delete(slot.slotKey);
          }}
          type="file"
          accept="image/*"
          hidden
          data-testid={`slotport-file-${slot.slotKey}`}
          onChange={(e) => {
            onFile(slot.slotKey, alt, e.target.files, copyFields);
            e.target.value = '';
          }}
        />
      </div>

      {/* 待审区（pending 非空才显） */}
      {slot.pending.length > 0 ? (
        <>
          <div className="border-t border-[rgba(44,40,34,.06)] px-[17px] pb-1 pt-3 text-caption-xs font-semibold text-[rgba(44,40,34,.42)]">
            {cp('slotport.pendingTitle')}
          </div>
          {slot.pending.map((v: SlotVersion) => (
            <div
              key={v.id}
              data-testid={`slotport-pending-${v.id}`}
              className="flex items-center gap-3 border-t border-[rgba(44,40,34,.06)] px-[17px] py-[13px]"
            >
              <SlotPreview url={v.contentJson.url} alt={v.contentJson.alt} className="h-12 w-12 shrink-0 rounded-tag" />
              <div className="min-w-0 flex-1">
                <div className="text-caption text-ink" style={numStyle}>
                  v{v.version}
                </div>
                <div className="mt-[2px] text-caption-xs text-[rgba(44,40,34,.42)]" style={numStyle}>
                  {fmtDateTime(v.createdAt)}
                  {v.creatorNickname ? ` · ${cp('copyport.historyBy', { name: v.creatorNickname })}` : ''}
                </div>
              </div>
              <Badge tone="brand">{cp('slotport.pendingBadge')}</Badge>
              {/* D-41 真预览：pending 版 iframe（仅本页 owner 可见可点；真用户/liveMap 不透 pending） */}
              <Btn
                variant="ghost"
                size="sm"
                data-testid={`slotport-preview-${v.id}`}
                disabled={disabled}
                onClick={() => onPreview(slot.slotKey, v.id)}
              >
                {cp('slotport.previewCta')}
              </Btn>
              <Btn
                variant="primary"
                size="sm"
                data-testid={`slotport-publish-${v.id}`}
                disabled={disabled}
                onClick={() => onPublish(v.id)}
              >
                {cp('slotport.publishCta')}
              </Btn>
            </div>
          ))}
        </>
      ) : null}

      {/* D-40 历史留痕区（archived 行透出：版本/操作人/时刻可查；物理删历史=禁令零触） */}
      {slot.archived.length > 0 ? (
        <div className="border-t border-[rgba(44,40,34,.06)] px-[17px] py-3" data-testid={`slotport-history-${slot.slotKey}`}>
          <div className="text-caption-xs font-semibold text-[rgba(44,40,34,.42)]">{cp('slotport.historyTitle')}</div>
          <ul className="mt-1.5 space-y-1">
            {slot.archived.map((v) => (
              <li key={v.id} className="text-caption-xs text-[rgba(44,40,34,.62)]" style={numStyle} data-testid={`slotport-history-row-${v.id}`}>
                {cp('slotport.historyLine', {
                  version: v.version,
                  time: fmtDateTime(v.actedAt ?? v.createdAt),
                  actor: v.actedByNickname ?? v.creatorNickname ?? cp('slotport.historyActorFallback'),
                })}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 页面主体（owner）                                                     */
/* ------------------------------------------------------------------ */

/* 片 5 段 3（W-16 共构不分叉）：页面内核导出（含三态与 ToasterMount，不含
   MainScaffold 页头），供 ConsolePage 右栏直嵌；本页默认出口行为不变 */
export function SlotPortBody() {
  const { trpc, queryClient } = usePhiliaClient();

  const listQuery = useQuery({
    queryKey: ['slotPort', 'list'],
    queryFn: () => trpc.slotPort.list.query(),
  });
  const slots = listQuery.data?.slots ?? [];

  /* 上传中（按槽）/ 上线·回退进行中（全页互斥，防并发误点） */
  const [uploadingBySlot, setUploadingBySlot] = useState<Record<string, boolean>>({});
  const [acting, setActing] = useState(false);
  const fileRefs = useRef(new Map<string, HTMLInputElement>());

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['slotPort'] });

  /* 上传替换：/api/upload 落盘签名 URL → slotPort.upload 登记 pending（D-6 默认待审）；
     D-42：文案与人群字段（空串=不带）随上传一并入 contentJson；三行制/红线词=server 硬闸，失败明文 toast */
  const onFile = (slotKey: string, alt: string, files: FileList | null, copy: SlotCopyFields) => {
    const file = files?.[0];
    if (!file) return;
    void (async () => {
      setUploadingBySlot((m) => ({ ...m, [slotKey]: true }));
      try {
        /* relDir 白名单仅 [A-Za-z0-9_-]：slotKey 点号转下划线（home.banner → slots/home_banner） */
        const { url } = await uploadImage(getApiBase(), file, `slots/${slotKey.replaceAll('.', '_')}`);
        const priorityNum = copy.priority.trim() === '' ? null : Number(copy.priority);
        await trpc.slotPort.upload.mutate({
          slotKey,
          content: {
            url,
            alt,
            ...(copy.title_main.trim() ? { title_main: copy.title_main.trim() } : {}),
            ...(copy.title_sub.trim() ? { title_sub: copy.title_sub.trim() } : {}),
            ...(copy.cta_text.trim() ? { cta_text: copy.cta_text.trim() } : {}),
            ...(copy.audience !== 'all' ? { audience: copy.audience } : {}),
            ...(priorityNum !== null && !Number.isNaN(priorityNum) ? { priority: priorityNum } : {}),
          },
        });
        toast(cp('slotport.uploadedToast'));
        await invalidate();
      } catch (e) {
        toast(`${cp('slotport.uploadFail')}：${errMsg(e)}`, 'error');
      } finally {
        setUploadingBySlot((m) => ({ ...m, [slotKey]: false }));
      }
    })();
  };

  /* 点上线：该 pending 版→live（旧 live→archived；已 live 幂等） */
  const onPublish = (versionId: string) => {
    void (async () => {
      setActing(true);
      try {
        await trpc.slotPort.publish.mutate({ versionId });
        toast(cp('slotport.publishedToast'));
        await invalidate();
      } catch (e) {
        toast(`${cp('slotport.publishFail')}：${errMsg(e)}`, 'error');
      } finally {
        setActing(false);
      }
    })();
  };

  /* 回退上一版：当前 live→archived、最近 archived→live */
  const onRevert = (slotKey: string) => {
    void (async () => {
      setActing(true);
      try {
        await trpc.slotPort.revert.mutate({ slotKey });
        toast(cp('slotport.revertedToast'));
        await invalidate();
      } catch (e) {
        toast(`${cp('slotport.revertFail')}：${errMsg(e)}`, 'error');
      } finally {
        setActing(false);
      }
    })();
  };

  /* D-40 紧急下线：双确认（KillSwitchStrip 工艺同族）→ slotPort.unpublish（live→archived）；
     与页顶「一键关停」支付通道零耦合——本动作只管本槽展示物料 */
  const onUnpublish = (slotKey: string) => {
    if (!window.confirm(cp('slotport.unpublishConfirm1', { slot: slotKey }))) return;
    if (!window.confirm(cp('slotport.unpublishConfirm2', { slot: slotKey }))) return;
    void (async () => {
      setActing(true);
      try {
        await trpc.slotPort.unpublish.mutate({ slotKey });
        toast(cp('slotport.unpublishedToast'));
        await invalidate();
      } catch (e) {
        toast(`${cp('slotport.unpublishFail')}：${errMsg(e)}`, 'error');
      } finally {
        setActing(false);
      }
    })();
  };

  /* D-41 真预览：pending 版 iframe（canvasPreviewUrl 工艺复用 + slotPreview=<versionId> 探针参；
     店锚=auth.me.store（前置写死：无锚不硬开，出补锚注记）；仅本页 owner 可入；
     queryKey 走商家端原生约定 ['auth','me','full']（['auth','me']=shared useMe 的 SessionUser 映射缓存，形状不同勿撞） */
  const meQ = useQuery({ queryKey: ['auth', 'me', 'full'], queryFn: () => trpc.auth.me.query(), staleTime: 300_000 });
  const previewStoreId = meQ.data?.store?.id ?? null;
  const [previewTarget, setPreviewTarget] = useState<{ slotKey: string; versionId: string } | null>(null);
  const onPreview = (slotKey: string, versionId: string) => setPreviewTarget({ slotKey, versionId });
  const previewSrc = previewTarget
    ? `${canvasPreviewUrl('home', previewStoreId, window.location, import.meta.env.DEV)}&slotPreview=${encodeURIComponent(previewTarget.versionId)}`
    : null;

  /* ---------------- 加载 / 错误 / 空三态 ---------------- */
  if (listQuery.isPending) {
    return (
      <div className="u3-panel" aria-label="加载中">
        <div className="u3-panel-head">
          <Skeleton className="h-4 w-24 rounded-chip" />
        </div>
        {['w-[46%]', 'w-[58%]', 'w-[70%]'].map((w, i) => (
          <div key={i} className="border-t border-[rgba(44,40,34,.06)] px-[17px] py-4">
            <Skeleton className={`h-3 rounded-chip ${w}`} />
            <Skeleton className="mt-2 h-20 w-32 rounded-input" />
          </div>
        ))}
      </div>
    );
  }

  if (listQuery.isError) {
    return (
      <div className="rounded-panel bg-card py-12 text-center shadow-hairline ring-1 ring-line-ring">
        <div className="text-body-sm text-[rgba(44,40,34,.62)]">{errMsg(listQuery.error)}</div>
        <Btn variant="ghost" size="sm" className="mt-3" onClick={() => void listQuery.refetch()}>
          {cp('slotport.loadFail')}
        </Btn>
      </div>
    );
  }

  return (
    <>
      <ToasterMount />
      {slots.length === 0 ? (
        <div className="rounded-panel bg-card py-12 text-center shadow-hairline ring-1 ring-line-ring">
          <div className="text-body-sm text-[rgba(44,40,34,.62)]">{cp('slotport.empty')}</div>
        </div>
      ) : (
        slots.map((slot) => (
          <SlotCard
            key={slot.slotKey}
            slot={slot}
            uploading={uploadingBySlot[slot.slotKey] ?? false}
            acting={acting}
            fileRefs={fileRefs}
            onFile={onFile}
            onPublish={onPublish}
            onRevert={onRevert}
            onUnpublish={onUnpublish}
            onPreview={onPreview}
          />
        ))
      )}

      {/* D-41 预览面板：iframe 真页（canvasPreview=1 探针 + slotPreview=<versionId> 旁路 + 店锚 canvasStore）；
          店锚未解析=补锚注记不硬开（SC-011 前置口径） */}
      {previewTarget ? (
        <div className="u3-panel mt-4" data-testid="slotport-preview-panel">
          <div className="u3-panel-head">
            <h3 className="font-mono">{previewTarget.slotKey}</h3>
            <span className="aside">{cp('slotport.previewPanelTitle')}</span>
          </div>
          <div className="border-t border-[rgba(44,40,34,.06)] px-[17px] py-[13px]">
            {previewSrc && previewStoreId ? (
              <iframe
                key={previewTarget.versionId}
                src={previewSrc}
                title={cp('slotport.previewCta')}
                data-testid="slotport-preview-iframe"
                className="u1-ring h-[720px] w-full max-w-[420px] rounded-panel bg-card"
              />
            ) : (
              <p className="text-caption text-[rgba(44,40,34,.62)]" data-testid="slotport-preview-no-store">
                {cp('slotport.previewNoStore')}
              </p>
            )}
            <div className="mt-3">
              <Btn variant="ghost" size="sm" data-testid="slotport-preview-close" onClick={() => setPreviewTarget(null)}>
                {cp('slotport.previewClose')}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** 页头装配（默认出口行为不变：MainScaffold + 内核体） */
function OwnerSlotPort() {
  return (
    <MainScaffold title={cp('slotport.pageTitle')} sub={cp('slotport.pageSub')} testid="slotport-page">
      <SlotPortBody />
    </MainScaffold>
  );
}

/* ------------------------------------------------------------------ */
/* 页内 owner 闸门（非 owner → 引导页，非 403 白屏；server 硬闸门兜底）      */
/* ------------------------------------------------------------------ */

export default function SlotPortPage() {
  const role = useMerchantRole();
  if (!role.isOwner) {
    return <RoleGuidePage title={cp('slotport.ownerOnly')} hint={cp('slotport.ownerOnlyBody')} />;
  }
  return <OwnerSlotPort />;
}
