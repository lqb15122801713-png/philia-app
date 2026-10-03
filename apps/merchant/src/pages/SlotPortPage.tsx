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

import { getApiBase, resolveSlotUrl, Skeleton, uploadImage, usePhiliaClient, type PhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { Badge, Btn, numStyle, toast, ToasterMount } from '../components/staff-admin/ui';
import { cp } from '../copy/copyPort';
import { useMerchantRole } from '../lib/roles';

/* ------------------------------------------------------------------ */
/* 类型锚点（server AppRouter 推导，构建期擦除）                          */
/* ------------------------------------------------------------------ */

type Trpc = PhiliaClient['trpc'];
type ListOut = Awaited<ReturnType<Trpc['slotPort']['list']['query']>>;
type SlotRow = ListOut['slots'][number];
type SlotVersion = NonNullable<SlotRow['live']>;

/** 占位块渐变（与客户端 home-v2 品牌淡金渐变同帧；url=null=占位，不画假图） */
const PLACEHOLDER_GRADIENT = 'linear-gradient(165deg, #EFDCAB 0%, #EBD398 52%, #F2E7CB 100%)';

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
}: {
  slot: SlotRow;
  uploading: boolean;
  acting: boolean;
  fileRefs: { current: Map<string, HTMLInputElement> };
  onFile: (slotKey: string, alt: string, files: FileList | null) => void;
  onPublish: (versionId: string) => void;
  onRevert: (slotKey: string) => void;
}) {
  const alt = slot.live?.contentJson.alt ?? slot.pending[0]?.contentJson.alt ?? slot.slotKey;
  /* 可回退=有上线版 且 非 pending 版本数 ≥2（当前 live + 至少一版 archived） */
  const canRevert = slot.live !== null && slot.totalVersions - slot.pending.length >= 2;
  const disabled = uploading || acting;

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

      <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-[13px]">
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
              <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.42)]">
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
            onFile(slot.slotKey, alt, e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* 待审区（pending 非空才显） */}
      {slot.pending.length > 0 ? (
        <>
          <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] pb-1 pt-3 text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
            {cp('slotport.pendingTitle')}
          </div>
          {slot.pending.map((v: SlotVersion) => (
            <div
              key={v.id}
              data-testid={`slotport-pending-${v.id}`}
              className="flex items-center gap-3 border-t border-[rgba(59,46,36,.06)] px-[17px] py-[13px]"
            >
              <SlotPreview url={v.contentJson.url} alt={v.contentJson.alt} className="h-12 w-12 shrink-0 rounded-tag" />
              <div className="min-w-0 flex-1">
                <div className="text-caption text-ink" style={numStyle}>
                  v{v.version}
                </div>
                <div className="mt-[2px] text-caption-xs text-[rgba(59,46,36,.42)]" style={numStyle}>
                  {fmtDateTime(v.createdAt)}
                  {v.creatorNickname ? ` · ${cp('copyport.historyBy', { name: v.creatorNickname })}` : ''}
                </div>
              </div>
              <Badge tone="brand">{cp('slotport.pendingBadge')}</Badge>
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 页面主体（owner）                                                     */
/* ------------------------------------------------------------------ */

function OwnerSlotPort() {
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

  /* 上传替换：/api/upload 落盘签名 URL → slotPort.upload 登记 pending（D-6 默认待审） */
  const onFile = (slotKey: string, alt: string, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    void (async () => {
      setUploadingBySlot((m) => ({ ...m, [slotKey]: true }));
      try {
        /* relDir 白名单仅 [A-Za-z0-9_-]：slotKey 点号转下划线（home.banner → slots/home_banner） */
        const { url } = await uploadImage(getApiBase(), file, `slots/${slotKey.replaceAll('.', '_')}`);
        await trpc.slotPort.upload.mutate({ slotKey, content: { url, alt } });
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

  /* ---------------- 加载 / 错误 / 空三态 ---------------- */
  if (listQuery.isPending) {
    return (
      <MainScaffold title={cp('slotport.pageTitle')} sub={cp('slotport.pageSub')} testid="slotport-page">
        <div className="u3-panel" aria-label="加载中">
          <div className="u3-panel-head">
            <Skeleton className="h-4 w-24 rounded-chip" />
          </div>
          {['w-[46%]', 'w-[58%]', 'w-[70%]'].map((w, i) => (
            <div key={i} className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-4">
              <Skeleton className={`h-3 rounded-chip ${w}`} />
              <Skeleton className="mt-2 h-20 w-32 rounded-input" />
            </div>
          ))}
        </div>
      </MainScaffold>
    );
  }

  if (listQuery.isError) {
    return (
      <MainScaffold title={cp('slotport.pageTitle')} sub={cp('slotport.pageSub')} testid="slotport-page">
        <div className="rounded-panel bg-[#FFFDF6] py-12 text-center shadow-hairline ring-1 ring-line-ring">
          <div className="text-body-sm text-[rgba(59,46,36,.62)]">{errMsg(listQuery.error)}</div>
          <Btn variant="ghost" size="sm" className="mt-3" onClick={() => void listQuery.refetch()}>
            {cp('slotport.loadFail')}
          </Btn>
        </div>
      </MainScaffold>
    );
  }

  return (
    <MainScaffold title={cp('slotport.pageTitle')} sub={cp('slotport.pageSub')} testid="slotport-page">
      <ToasterMount />
      {slots.length === 0 ? (
        <div className="rounded-panel bg-[#FFFDF6] py-12 text-center shadow-hairline ring-1 ring-line-ring">
          <div className="text-body-sm text-[rgba(59,46,36,.62)]">{cp('slotport.empty')}</div>
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
          />
        ))
      )}
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
