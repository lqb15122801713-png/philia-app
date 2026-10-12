/**
 * 开发者管理端 /console（商家端控制台骨架批 · 片 5 段 3 · W-16 聚合新建，替换段 0 占位）
 *
 * 区块序（UX-02 语言包 §四 W-16，M8 三件）：
 *   wtop（MainScaffold）→ 左 WcPorts 端口目录（A 内容运营：文案 A4/槽位 A5；
 *   C 会员机制：会员档/储值/安心包 C3（大批片 2 点亮，只读 v1）；D 员工规则：提成/XP；
 *   E 门店·数据：档案 E1（大批片 2 点亮=ProfilePortBody）/报表口径——
 *   未收编口置灰只读占位 R10 不画假件；激活=金左条，点击切右栏域）
 *   → 右栏端口编辑：按域直嵌既有三页内核（共构不分叉，组件复用不复制码）——
 *     A4 文案 → CopyConfigBody（CopyConfigPage 内核）；
 *     A5 槽位 → SlotPortBody（SlotPortPage 内核）+ WcPub 发布流胶囊（slot publish
 *       流透出：草稿→预览→发布推三端 + 回滚虚线注）+ WcLog 留痕行（槽位版本计数透出）；
 *     C/D → DomainPanel（RulesConfigPage 内核）对应域（会员档/提成/XP），域内
 *       「修改留痕」面板=config.versions 现状透出（不再另挂 WcLog，防双份）；
 *     置灰口 → 只读占位卡（储值与报表口径待立项）。
 *   → WDanger 危险区（暖底赭红题带：L2-④ 二次 PIN=既有 highRisk 口令闸透出 /
 *     冻结项只读 / 动规则不动账）→ 共构不分叉注（旧三路由保留可直达）。
 *
 * 端口批收尾片 1（前端两件）：
 * - 件 4a kill switch 显著态：MainScaffold 之下、端口目录之上 KillSwitchStrip——
 *   config.killStatus enabled=true → WAlert 大红横幅（{by}·{updatedAt}）+「恢复」钮；
 *   enabled=false → 小字注+「一键关停」危险小钮；两钮 window.confirm 二次确认 →
 *   config.setKillSwitch → invalidate killStatus；
 * - 件 5 D3 参数字典端口：PORT_GROUPS D 章新增 dict 项（seal D3 无撞号），直嵌
 *   ConfigDictBody（config.dictionary 全量+服务端 q 搜索+按域分组表格）。
 *
 * 端口批收尾片 2（D 章顺编两件，seal 无撞号）：
 * - D4 数据订正端口（数据 3 之②）：直嵌 CorrectionBody（三类页签+发起表单+
 *   订正单队列复核；server correction.* owner 发起/manager 复核硬闸）；
 * - D5 回收站端口（数据 3 之③）：直嵌 RecycleBinBody（recycleBin.list 三域行+
 *   恢复统一口；账务/支付/账单类永不进=无硬删口）。
 *
 * owner-only：manager 见引导卡（同三端口页闸径），clerk 由 ClerkRouteGuard 拦，
 * server merchantOwnerProcedure 硬闸门兜底。
 */

import { usePhiliaClient, type PhiliaClient, type CanvasPageKey } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { WAlert, WDanger, WcLog, WcPorts, WcPub, type WcPubStage } from '../components/skeleton';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { Btn, numStyle, toast, ToasterMount } from '../components/staff-admin/ui';
import { cadm } from '../copy/consoleAdmin';
import { CONSOLE_PORT_META, type ConsolePortKey } from './consolePortsMeta';
import { ConsoleSearch } from './ConsoleSearch';
import { useMerchantRole } from '../lib/roles';
import { CopyConfigBody } from './CopyConfigPage';
import { CanvasPortBody } from './CanvasPortBody';
import { PayChannelPortBody } from './PayChannelPortBody';
import { CarePackPortBody } from './CarePackPortBody';
import { ConfigDictBody } from './ConfigDictBody';
import { CorrectionBody } from './CorrectionBody';
import { ProfilePortBody } from './ProfilePortBody';
import { RecycleBinBody } from './RecycleBinBody';
import { DomainPanel as RulesDomainPanel, type RulesDomain } from './RulesConfigPage';
import { SlotPortBody } from './SlotPortPage';

/* ------------------------------------------------------------------ */
/* 端口目录结构（A–E 域章；置灰口=开口项只读占位）                          */
/* ------------------------------------------------------------------ */

/* 片 2：PortKey=consolePortsMeta 单源件别名（15 口映射表双件共用） */
type PortKey = ConsolePortKey;

const PORT_GROUPS: Array<{
  key: string;
  label: string;
  items: Array<{ key: PortKey; label: string; seal: string; note?: string; to?: string }>;
}> = [
  {
    key: 'A',
    label: cadm('cadm.groupA'),
    items: [
      { key: 'copy', label: cadm('cadm.portCopy'), seal: 'A4' },
      { key: 'slots', label: cadm('cadm.portSlots'), seal: 'A5' },
    ],
  },
  {
    key: 'C',
    label: cadm('cadm.groupC'),
    items: [
      { key: 'member_plans', label: cadm('cadm.portMember'), seal: 'C1' },
      { key: 'stored', label: cadm('cadm.portStored'), seal: 'C2', note: cadm('cadm.portPendingNote') },
      /* 大批片 2：安心包立项名 C2 与既有 C2 储值撞号，落 C3（已报备） */
      { key: 'carepack', label: cadm('cadm.portCarePack'), seal: 'C3', note: cadm('cadm.portCarePackNote') },
      /* 大批片 5：会员营销 C4 点亮=直达卡（WcPorts to 链接工艺，不嵌内核——真页 /marketing） */
      { key: 'marketing', label: cadm('cadm.portMarketing'), seal: 'C4', to: '/marketing' },
    ],
  },
  {
    key: 'D',
    label: cadm('cadm.groupD'),
    items: [
      { key: 'commission', label: cadm('cadm.portCommission'), seal: 'D1' },
      { key: 'xp', label: cadm('cadm.portXp'), seal: 'D2' },
      /* 端口批收尾片 1 · 件 5：D3 参数字典点亮（ConfigDictBody 直嵌；seal D3 无撞号：D1/D2 既有） */
      { key: 'dict', label: cadm('cadm.portDict'), seal: 'D3' },
      /* 端口批收尾片 2：D4 数据订正（CorrectionBody）/ D5 回收站（RecycleBinBody；seal 顺编无撞号） */
      { key: 'correction', label: cadm('cadm.portCorrection'), seal: 'D4' },
      { key: 'recycle', label: cadm('cadm.portRecycle'), seal: 'D5' },
    ],
  },
  {
    key: 'E',
    label: cadm('cadm.groupE'),
    items: [
      /* 大批片 2：E1 点亮（ProfilePortBody 档案表单+连锁归属），撤置灰注 */
      { key: 'profile', label: cadm('cadm.portProfile'), seal: 'E1' },
      { key: 'reportSpec', label: cadm('cadm.portReportSpec'), seal: 'E2', note: cadm('cadm.portPendingNote') },
      /* 产品-1010 片 1：E3 支付通道端口点亮（PayChannelPortBody 直嵌；高危件=口令复核+掩码留痕；seal 顺编无撞号） */
      { key: 'payChannel', label: cadm('cadm.portPayChannel'), seal: 'E3', note: cadm('cadm.portPayChannelNote') },
    ],
  },
  {
    key: 'F',
    label: cadm('cadm.groupF'),
    items: [
      /* 端口批收尾片 3 · B 股：F1 画布端口点亮（CanvasPortBody 直嵌；seal F1 新章无撞号） */
      { key: 'canvas', label: cadm('cadm.portCanvas'), seal: 'F1' },
    ],
  },
];

/** 本页收编的 RulesDomain 子集（duration/refund 两域仍走 /settings/rules 全量页） */
type ConsoleRulesDomain = Extract<RulesDomain, 'member_plans' | 'commission' | 'xp'>;
const RULES_PORTS: ReadonlyArray<PortKey> = ['member_plans', 'commission', 'xp'];
const isRulesPort = (p: PortKey): p is ConsoleRulesDomain => RULES_PORTS.includes(p);

/** 置灰口空态卡文案（key=PortKey；大批片 2：profile=E1 点亮移除，carepack=C3 点亮不占位） */
const EMPTY_STATE: Partial<Record<PortKey, { title: string; body: string }>> = {
  stored: { title: cadm('cadm.storedEmptyTitle'), body: cadm('cadm.storedEmptyBody') },
  reportSpec: { title: cadm('cadm.reportSpecEmptyTitle'), body: cadm('cadm.reportSpecEmptyBody') },
};

/* ------------------------------------------------------------------ */
/* 控制台改版批 片 1（产品-1012 · 刀 1）：办事导向首页——卡面+留痕行数据件     */
/* 视觉零改动纪律：全用既有 wsk-card/wsk-hd/Btn 件与既有色板字号，只动 IA    */
/* 卡面元数据=./consolePortsMeta 单源件（片 2 全局搜索复用同表，防双表漂移）   */
/* ------------------------------------------------------------------ */

/** 留痕行数据源（全部既有读口，零新建）：config.versions 五域+slotPort.list+canvas.getLayout(home)+correction.list */
function useHomeLastChanges(enabled: boolean) {
  const { trpc } = usePhiliaClient();
  const verQ = useQuery({
    queryKey: ['consoleHome', 'versions'],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const out: Record<string, { version: number; changerNickname: string | null; createdAt: unknown } | null> = {};
      await Promise.all((['copy', 'member_plans', 'commission', 'xp', 'pay'] as const).map(async (d) => {
        try {
          const r = await trpc.config.versions.query({ domain: d, limit: 1 });
          out[d] = (r.versions[0] as { version: number; changerNickname: string | null; createdAt: unknown } | undefined) ?? null;
        } catch {
          out[d] = null;
        }
      }));
      return out;
    },
  });
  const slotsQ = useQuery({
    queryKey: ['slotPort', 'list'],
    queryFn: () => trpc.slotPort.list.query(),
    enabled,
    staleTime: 60_000,
  });
  const canvasQ = useQuery({
    queryKey: ['canvas', 'getLayout', 'home'],
    queryFn: () => trpc.canvas.getLayout.query({ pageKey: 'home' }),
    enabled,
    staleTime: 60_000,
  });
  const corrQ = useQuery({
    queryKey: ['correction', 'list', 'home'],
    queryFn: () => trpc.correction.list.query({}),
    enabled,
    staleTime: 60_000,
  });

  return useMemo(() => {
    const out: Record<string, string | null> = {};
    const verOf = (d: string) => {
      const v = verQ.data?.[d];
      return v ? `v${v.version} · ${v.changerNickname ?? '—'} · ${fmtDateTime(v.createdAt as Date)}` : null;
    };
    for (const d of ['copy', 'member_plans', 'commission', 'xp', 'pay'] as const) out[d] = verOf(d);
    /* 槽位：最新动作=待审首行时刻或最近上线版本计数透出 */
    const slots = slotsQ.data?.slots ?? [];
    let slotLatest: Date | null = null;
    let slotVersions = 0;
    for (const s of slots) {
      slotVersions += s.totalVersions;
      const t = s.pending[0]?.createdAt;
      if (t && (!slotLatest || (t as Date).getTime() > slotLatest.getTime())) slotLatest = t as Date;
    }
    out.slots = slotLatest ? `${fmtDateTime(slotLatest)}` : slots.length > 0 ? `共 ${slotVersions} 版` : null;
    /* 画布：home 屏版本时间轴首行 */
    const cv0 = canvasQ.data?.versions?.[0] as { version: number; creatorNickname?: string | null; actedAt?: Date; createdAt?: Date } | undefined;
    out.canvas = cv0 ? `v${cv0.version} · ${cv0.creatorNickname ?? '—'} · ${fmtDateTime(cv0.actedAt ?? cv0.createdAt)}` : null;
    /* 数据订正：订正单首行（list 返回 { items }） */
    const c0 = (corrQ.data as { items?: Array<{ correction: { createdAt: Date }; proposerNickname: string | null }> } | undefined)?.items?.[0];
    out.correction = c0 ? `${c0.proposerNickname ?? '—'} · ${fmtDateTime(c0.correction.createdAt)}` : null;
    return out;
  }, [verQ.data, slotsQ.data, canvasQ.data, corrQ.data]);
}

/* ------------------------------------------------------------------ */
/* A5 槽位域：WcPub 发布流 + WcLog 版本留痕（slotPort.list 同源键透出）      */
/* ------------------------------------------------------------------ */

type Trpc = PhiliaClient['trpc'];
type SlotListOut = Awaited<ReturnType<Trpc['slotPort']['list']['query']>>;

function SlotPublishStrip() {
  const { trpc } = usePhiliaClient();
  // 同 SlotPortBody 同键（['slotPort','list']）→ 共享缓存零加倍请求
  const listQuery = useQuery({
    queryKey: ['slotPort', 'list'],
    queryFn: () => trpc.slotPort.list.query(),
  });
  const slots: SlotListOut['slots'] = listQuery.data?.slots ?? [];

  const pendingCount = slots.reduce((s, x) => s + x.pending.length, 0);
  const liveCount = slots.filter((x) => x.live !== null).length;
  const stage: WcPubStage = !listQuery.data
    ? 'draft'
    : pendingCount > 0
      ? 'preview'
      : liveCount > 0
        ? 'published'
        : 'draft';

  return (
    <section className="wsk-card" data-testid="console-pub-strip">
      <WcPub
        stage={stage}
        onRollback={() => undefined}
        rollbackDisabled
        testId="console-pub"
      />
      <p className="wsk-note mt-2.5">{cadm('cadm.pubNote')}</p>
      <div className="wsk-hd mt-3.5">
        <span className="t">{cadm('cadm.logTitle')}</span>
        <span className="a">{cadm('cadm.logAside')}</span>
      </div>
      <WcLog
        testId="console-slot-log"
        entries={slots.map((s) => ({
          key: s.slotKey,
          text: s.live
            ? `${s.slotKey} · 上线 v${s.live.version}（共 ${s.totalVersions} 版）`
            : `${s.slotKey} · 尚无上线版（共 ${s.totalVersions} 版）`,
          meta:
            s.pending.length > 0
              ? `待审 ${s.pending.length} · ${fmtDateTime(s.pending[0]!.createdAt)}`
              : undefined,
        }))}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* kill switch 显著态（端口批收尾片 1 · 件 4a：页顶横幅/小字行+双确认切换）   */
/* ------------------------------------------------------------------ */

function KillSwitchStrip() {
  const { trpc, queryClient } = usePhiliaClient();
  const killQuery = useQuery({
    queryKey: ['config', 'killStatus'],
    queryFn: () => trpc.config.killStatus.query(),
  });
  const [busy, setBusy] = useState(false);

  const toggle = async (next: boolean) => {
    /* 二次确认（window.confirm 口径件；口令 Modal 保留给规则保存 D 套） */
    if (!window.confirm(next ? cadm('cadm.killArmConfirm') : cadm('cadm.killRestoreConfirm'))) return;
    setBusy(true);
    try {
      await trpc.config.setKillSwitch.mutate({ enabled: next });
      toast(cadm('cadm.killDone'));
      await queryClient.invalidateQueries({ queryKey: ['config', 'killStatus'] });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (killQuery.isPending || killQuery.isError) return null;

  if (killQuery.data.enabled) {
    return (
      <div className="mb-3.5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <WAlert
            testId="console-kill-alert"
            items={[
              {
                key: 'kill',
                text: cadm('cadm.killBannerOn', {
                  by: killQuery.data.by ?? '—',
                  updatedAt: fmtDateTime(killQuery.data.updatedAt),
                }),
              },
            ]}
          />
        </div>
        <Btn
          variant="danger"
          size="sm"
          data-testid="console-kill-restore"
          disabled={busy}
          onClick={() => void toggle(false)}
        >
          {cadm('cadm.killRestore')}
        </Btn>
      </div>
    );
  }

  return (
    <div className="mb-3.5 flex items-center gap-3 px-1">
      <span className="min-w-0 flex-1 text-caption-xs text-[rgba(59,46,36,.42)]">{cadm('cadm.killArmNote')}</span>
      <Btn
        variant="danger"
        size="sm"
        data-testid="console-kill-arm"
        disabled={busy}
        onClick={() => void toggle(true)}
      >
        {cadm('cadm.killArm')}
      </Btn>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

function OwnerConsole() {
  /* 产品-1010 片 1：?port= 预选口（画布权益墙「去会员档改数 ›」跳口落 C1；非法值=回默认）；
     产品-1012 片 1 刀 1：默认视图=办事导向首页（view='home'），?port= 直达口保留 */
  const [view, setView] = useState<PortKey | 'home'>(() => {
    const p = new URLSearchParams(window.location.search).get('port');
    const all: string[] = PORT_GROUPS.flatMap((g) => g.items.map((i) => i.key));
    return p && all.includes(p) ? (p as PortKey) : 'home';
  });
  const [advOpen, setAdvOpen] = useState(false);
  const lastChanges = useHomeLastChanges(view === 'home');
  const empty = view !== 'home' ? EMPTY_STATE[view] : undefined;
  const navigate = useNavigate();
  /* 片 2 刀 2：全局搜索命中深链焦点（键名/页签；key 重挂载=焦点件重读） */
  const [copyFocus, setCopyFocus] = useState<string | null>(null);
  const [canvasFocus, setCanvasFocus] = useState<CanvasPageKey | null>(null);

  return (
    <MainScaffold
      title={cadm('cadm.pageTitle')}
      sub={cadm('cadm.pageSub')}
      testid="console-page"
      actions={
        <ConsoleSearch
          onPickPort={(p) => setView(p)}
          onPickCopyKey={(k) => {
            setCopyFocus(k);
            setView('copy');
          }}
          onPickScreen={(pk) => {
            setCanvasFocus(pk as CanvasPageKey);
            setView('canvas');
          }}
          onPickSlots={() => setView('slots')}
          onNavigate={(to) => navigate(to)}
        />
      }
    >
      <div className="wsk">
        {/* kill switch 显著态（件 4a：开=WAlert 大红横幅+恢复钮；关=小字行+一键关停危险小钮） */}
        <KillSwitchStrip />

        {view === 'home' ? (
          <>
            {/* 刀 1：办事导向首页——办事卡面（每卡=一句人话「你能干什么」+最近改动留痕行） */}
            <section className="wsk-card" data-testid="console-home">
              <div className="wsk-hd">
                <span className="t">{cadm('cadm.homeTitle')}</span>
                <span className="a">{cadm('cadm.homeSub')}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                {CONSOLE_PORT_META.map((card) => {
                  const last = card.lastKey ? (lastChanges[card.lastKey] ?? null) : null;
                  const inner = (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span className="text-body font-semibold text-ink">{cadm(card.titleKey)}</span>
                        <span className="text-caption-xs text-[rgba(59,46,36,.42)]">
                          {cadm('cadm.homePortBadge')} · {card.port}
                        </span>
                      </div>
                      <p className="mt-1.5 text-caption-xs text-[rgba(59,46,36,.62)]">{cadm(card.hintKey)}</p>
                      <p className="mt-2 border-t border-[rgba(59,46,36,.06)] pt-1.5 text-caption-xs text-[rgba(59,46,36,.42)]" style={numStyle}>
                        {last ?? cadm('cadm.homeLastNone')}
                      </p>
                    </>
                  );
                  const cls = `rounded-panel bg-card px-4 py-3.5 text-left shadow-card transition-transform duration-120 ease-philia-spring active:scale-[0.98]${card.pending ? ' opacity-60' : ''}`;
                  return card.to ? (
                    <Link key={card.port} to={card.to} className={cls} data-testid={`console-card-${card.port}`}>{inner}</Link>
                  ) : (
                    <button key={card.port} type="button" className={cls} data-testid={`console-card-${card.port}`} onClick={() => setView(card.port)}>{inner}</button>
                  );
                })}
              </div>
            </section>

            {/* 参数表形态降级=高级层（折叠收排；全量端口目录点即达，不再是门面） */}
            <section className="wsk-card mt-3.5" data-testid="console-advanced">
              <div className="wsk-hd">
                <span className="t">{cadm('cadm.homeAdvanced')}</span>
                <span className="a">{cadm('cadm.homeAdvancedNote')}</span>
              </div>
              <Btn variant="subtle" size="sm" data-testid="console-advanced-toggle" onClick={() => setAdvOpen((v) => !v)}>
                {cadm('cadm.homeAdvanced')}
              </Btn>
              {advOpen ? (
                <div className="mt-3">
                  <WcPorts groups={PORT_GROUPS} active={undefined} onSelect={(k) => setView(k as PortKey)} testId="console-ports-advanced" />
                </div>
              ) : null}
            </section>
          </>
        ) : (
          <>
            {/* 返回行（回办事首页；侧栏单入口+页内回行双路径） */}
            <div className="mb-1 px-1">
              <Btn variant="ghost" size="sm" data-testid="console-back-home" onClick={() => setView('home')}>
                {cadm('cadm.homeBackHome')}
              </Btn>
            </div>
            <div className="flex flex-col items-start gap-3.5 lg:flex-row">
              <WcPorts
                groups={PORT_GROUPS}
                active={view}
                onSelect={(k) => setView(k as PortKey)}
                testId="console-ports"
              />

              <div className="min-w-0 flex-1 space-y-3.5">
                {/* 右栏端口编辑：共构不分叉——直嵌三页内核件，不复制码 */}
                {view === 'copy' ? <CopyConfigBody key={copyFocus ?? 'default'} initialSearch={copyFocus ?? undefined} /> : null}
                {view === 'slots' ? (
                  <>
                    <SlotPublishStrip />
                    <SlotPortBody />
                  </>
                ) : null}
                {isRulesPort(view) ? (
                  <>
                    {/* DomainPanel 内核不带 ToasterMount（宿主页挂；文案/槽位体内核自带） */}
                    <ToasterMount />
                    <RulesDomainPanel key={view} domain={view} />
                  </>
                ) : null}
                {/* 大批片 2：E1 门店档案端口（ProfilePortBody 内核）/ C3 安心包端口（CarePackPortBody 只读 v1） */}
                {view === 'profile' ? <ProfilePortBody /> : null}
                {view === 'carepack' ? <CarePackPortBody /> : null}
                {/* 端口批收尾片 1：D3 参数字典端口（ConfigDictBody 内核；空态卡不用） */}
                {view === 'dict' ? <ConfigDictBody /> : null}
                {/* 端口批收尾片 2：D4 数据订正 / D5 回收站（CorrectionBody / RecycleBinBody 内核） */}
                {view === 'correction' ? <CorrectionBody /> : null}
                {view === 'recycle' ? <RecycleBinBody /> : null}
                {/* 端口批收尾片 3：F1 画布端口（CanvasPortBody 内核；owner-only server 硬闸） */}
                {view === 'canvas' ? <CanvasPortBody key={canvasFocus ?? 'default'} initialPageKey={canvasFocus ?? undefined} /> : null}
                {/* 产品-1010 片 1：E3 支付通道端口（PayChannelPortBody 内核；高危件=口令复核+掩码留痕） */}
                {view === 'payChannel' ? <PayChannelPortBody /> : null}
                {empty ? (
                  <section className="wsk-card" data-testid={`console-empty-${view}`} aria-disabled="true">
                    <div className="wsk-hd">
                      <span className="t">{empty.title}</span>
                      <span className="a">{cadm('cadm.portPendingNote')}</span>
                    </div>
                    <p className="text-caption text-[rgba(59,46,36,.62)]">{empty.body}</p>
                  </section>
                ) : null}

                {/* 危险区（透出既有闸，不新建件） */}
                <WDanger testId="console-danger">
                  <ul className="space-y-1.5 text-caption text-[rgba(59,46,36,.78)]">
                    <li>{cadm('cadm.dangerPin')}</li>
                    <li>{cadm('cadm.dangerFrozen')}</li>
                    <li>{cadm('cadm.dangerNoBackdate')}</li>
                  </ul>
                </WDanger>
              </div>
            </div>
          </>
        )}

        <p className="wsk-note mt-3 px-1">{cadm('cadm.coexistNote')}</p>
      </div>
    </MainScaffold>
  );
}

export default function ConsolePage() {
  const role = useMerchantRole();
  if (!role.isOwner) {
    return <RoleGuidePage title={cadm('cadm.ownerOnlyTitle')} hint={cadm('cadm.ownerOnlyBody')} />;
  }
  return <OwnerConsole />;
}
