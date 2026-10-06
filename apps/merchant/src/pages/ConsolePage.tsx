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
 * owner-only：manager 见引导卡（同三端口页闸径），clerk 由 ClerkRouteGuard 拦，
 * server merchantOwnerProcedure 硬闸门兜底。
 */

import { usePhiliaClient, type PhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { WDanger, WcLog, WcPorts, WcPub, type WcPubStage } from '../components/skeleton';
import { fmtDateTime } from '../components/staff-admin/format';
import { ToasterMount } from '../components/staff-admin/ui';
import { cadm } from '../copy/consoleAdmin';
import { useMerchantRole } from '../lib/roles';
import { CopyConfigBody } from './CopyConfigPage';
import { CarePackPortBody } from './CarePackPortBody';
import { ProfilePortBody } from './ProfilePortBody';
import { DomainPanel as RulesDomainPanel, type RulesDomain } from './RulesConfigPage';
import { SlotPortBody } from './SlotPortPage';

/* ------------------------------------------------------------------ */
/* 端口目录结构（A–E 域章；置灰口=开口项只读占位）                          */
/* ------------------------------------------------------------------ */

type PortKey =
  | 'copy'
  | 'slots'
  | 'member_plans'
  | 'stored'
  | 'carepack'
  | 'commission'
  | 'xp'
  | 'profile'
  | 'reportSpec';

const PORT_GROUPS: Array<{
  key: string;
  label: string;
  items: Array<{ key: PortKey; label: string; seal: string; note?: string }>;
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
    ],
  },
  {
    key: 'D',
    label: cadm('cadm.groupD'),
    items: [
      { key: 'commission', label: cadm('cadm.portCommission'), seal: 'D1' },
      { key: 'xp', label: cadm('cadm.portXp'), seal: 'D2' },
    ],
  },
  {
    key: 'E',
    label: cadm('cadm.groupE'),
    items: [
      /* 大批片 2：E1 点亮（ProfilePortBody 档案表单+连锁归属），撤置灰注 */
      { key: 'profile', label: cadm('cadm.portProfile'), seal: 'E1' },
      { key: 'reportSpec', label: cadm('cadm.portReportSpec'), seal: 'E2', note: cadm('cadm.portPendingNote') },
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
/* 页面                                                                */
/* ------------------------------------------------------------------ */

function OwnerConsole() {
  const [active, setActive] = useState<PortKey>('copy');
  const empty = EMPTY_STATE[active];

  return (
    <MainScaffold title={cadm('cadm.pageTitle')} sub={cadm('cadm.pageSub')} testid="console-page">
      <div className="wsk">
        <div className="flex flex-col items-start gap-3.5 lg:flex-row">
          <WcPorts
            groups={PORT_GROUPS}
            active={active}
            onSelect={(k) => setActive(k as PortKey)}
            testId="console-ports"
          />

          <div className="min-w-0 flex-1 space-y-3.5">
            {/* 右栏端口编辑：共构不分叉——直嵌三页内核件，不复制码 */}
            {active === 'copy' ? <CopyConfigBody /> : null}
            {active === 'slots' ? (
              <>
                <SlotPublishStrip />
                <SlotPortBody />
              </>
            ) : null}
            {isRulesPort(active) ? (
              <>
                {/* DomainPanel 内核不带 ToasterMount（宿主页挂；文案/槽位体内核自带） */}
                <ToasterMount />
                <RulesDomainPanel key={active} domain={active} />
              </>
            ) : null}
            {/* 大批片 2：E1 门店档案端口（ProfilePortBody 内核）/ C3 安心包端口（CarePackPortBody 只读 v1） */}
            {active === 'profile' ? <ProfilePortBody /> : null}
            {active === 'carepack' ? <CarePackPortBody /> : null}
            {empty ? (
              <section className="wsk-card" data-testid={`console-empty-${active}`} aria-disabled="true">
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
