/**
 * 排班管理 /settings/schedules（员工端骨架整建批 片 2 · 商家端）
 *
 * 数据源=schedule namespace（server 已落地，类型经 lib/schedulePort.ts 从
 * AppRouter 推导）：
 * - 周视图 weekView：员工×周一~日网格，格内班次块（时段 mono + 来源签 模板/手动 +
 *   published 态）；HTML5 拖拽调班=assign 新 + cancelAssignment 旧（note 自动=
 *   「拖拽调整留痕」）；拖到请假覆盖格由 server 硬拒（assign 明文「该员工当日已准
 *   假…」），拒写明文原样 toast；
 * - 模板区 templates/templateUpsert/templateDeactivate；生成 generate（skipReport
 *   逐条透出）+ 发布 publishWeek（新发布数透出，幂等）；
 * - 换班审批：server 端只有 swapResolve 写口、无 swapQueue/listSwaps 读口（grep
 *   实证），审批区暂渲染置灰注记，读口落地后接上（不造假按钮）；
 * - CSV 批量导入 importPreview 对账表 → importExecute（落行数+跳过数）；
 * - 技能标签 skillTags（service_rules.staff_skill_tags 端口标签集）× staffSkills
 *   点选切换 setSkills；
 * - WiFi 白名单区：server 无 wifiBssids 族端点（attendance_wifi_bssids 表已建、
 *   端点属考勤批），本区只读置灰注记位。
 *
 * 权限三层：墨轨入口 clerk 不可见（MerchantRail groupsFor 既有分流）+ App.tsx
 * ClerkRouteGuard 引导页 + 页内 useMerchantRole 非 owner/manager → RoleGuidePage。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, type DragEvent } from 'react';
import MainScaffold from '../components/MainScaffold';
import RoleGuidePage from '../components/RoleGuidePage';
import { errMsg } from '../components/staff-admin/format';
import { Badge, Btn, toast, ToasterMount } from '../components/staff-admin/ui';
import { sc } from '../copy/schedule';
import {
  addDays,
  dateStr,
  hmToMin,
  minToHm,
  mondayOf,
  weekDates,
  type ImportPreview,
  type ShiftAssignment,
} from '../lib/schedulePort';
import { useMerchantRole } from '../lib/roles';

/* ------------------------------------------------------------------ */
/* 常量与小组件                                                          */
/* ------------------------------------------------------------------ */

/** 周日 chips 值序：一~六=1..6，日=0（schema 口径 1=周一…0=周日） */
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0] as const;
const WEEKDAY_LABEL: Record<number, string> = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 0: '日' };

/** 周日 chip 组（模板表单用） */
function WeekdayChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="sched-template-days">
      {WEEKDAY_VALUES.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)))}
            className={`min-h-[36px] rounded-chip px-3 text-caption font-semibold transition-transform duration-120 ease-philia-spring active:scale-92 ${
              on ? 'bg-ink text-[#F2DFA6]' : 'bg-sunken text-ink-secondary'
            }`}
          >
            {WEEKDAY_LABEL[d]}
          </button>
        );
      })}
    </div>
  );
}

/** 班次块（可拖拽；时段 mono + 来源签 + published 态） */
function ShiftBlock({ a, onDragStart }: { a: ShiftAssignment; onDragStart: (e: DragEvent, id: string) => void }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, a.id)}
      data-testid={`sched-block-${a.id}`}
      title={sc('sched.block.dragHint')}
      className="mb-1 cursor-grab rounded-chip bg-card px-2 py-1.5 shadow-hairline ring-1 ring-line-ring active:cursor-grabbing"
    >
      <div className="u1-num text-caption font-bold text-ink">
        {minToHm(a.startMin)}–{minToHm(a.endMin)}
      </div>
      <div className="mt-0.5 flex items-center gap-1">
        <Badge tone="muted">{a.source === 'template' ? sc('sched.block.template') : sc('sched.block.manual')}</Badge>
        <Badge tone={a.published ? 'success' : 'brand'}>{a.published ? sc('sched.block.published') : sc('sched.block.draft')}</Badge>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

export default function ScheduleManagePage() {
  const { trpc, queryClient } = usePhiliaClient();
  const role = useMerchantRole();

  /* ---- 周选择（周一起算） ---- */
  const [weekStart, setWeekStart] = useState(() => dateStr(mondayOf(new Date())));
  const days = useMemo(() => weekDates(weekStart), [weekStart]);

  /* ---- 数据族（queryKey 统一 schedule 前缀，失效一把刷） ---- */
  const weekQuery = useQuery({
    queryKey: ['schedule', 'weekView', weekStart],
    queryFn: () => trpc.schedule.weekView.query({ weekStart }),
  });
  const templatesQuery = useQuery({
    queryKey: ['schedule', 'templates'],
    queryFn: () => trpc.schedule.templates.query(),
  });
  const tagsQuery = useQuery({
    queryKey: ['schedule', 'skillTags'],
    queryFn: () => trpc.schedule.skillTags.query(),
    staleTime: 300_000,
  });
  const skillsQuery = useQuery({
    queryKey: ['schedule', 'staffSkills'],
    queryFn: () => trpc.schedule.staffSkills.query(),
  });
  /* 换班审批队列（swapQueue 读口已落） */
  const swapQ = useQuery({
    queryKey: ['schedule', 'swapQueue'],
    queryFn: () => trpc.schedule.swapQueue.query(),
  });
  const [swapActing, setSwapActing] = useState(false);
  const resolveSwap = async (swapId: string, approve: boolean) => {
    let note: string | undefined;
    if (!approve) {
      note = window.prompt(sc('sched.swap.notePh')) ?? undefined;
      if (!note) return; // 驳回必须填备注（server 同闸），取消=不动作
    }
    setSwapActing(true);
    try {
      await trpc.schedule.swapResolve.mutate({ swapId, approve, ...(note ? { note } : {}) });
      toast(sc('sched.swap.resolved'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSwapActing(false);
    }
  };

  const invalidateAll = () => void queryClient.invalidateQueries({ queryKey: ['schedule'] });

  const staffRows = useMemo(() => weekQuery.data?.staff ?? [], [weekQuery.data]);
  const assignments = useMemo(() => weekQuery.data?.assignments ?? [], [weekQuery.data]);
  /** 周发布态：有 active 班且全部已发布=已发布（weekView 逐行 published 透出，无周级字段） */
  const weekPublished = useMemo(() => {
    const active = assignments.filter((a) => a.status !== 'cancelled');
    return active.length > 0 && active.every((a) => a.published);
  }, [assignments]);
  /** 格索引：staffId|date → active assignments（已取消不入格） */
  const cellMap = useMemo(() => {
    const m = new Map<string, ShiftAssignment[]>();
    for (const a of assignments) {
      if (a.status === 'cancelled') continue;
      const k = `${a.staffId}|${a.date}`;
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  }, [assignments]);

  /* ---- 拖拽调班：assign 新 + cancelAssignment 旧（note 自动留痕） ---- */
  const [moving, setMoving] = useState(false);
  const onDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = async (e: DragEvent, staffId: string, date: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const a = assignments.find((x) => x.id === id);
    if (!a || moving) return;
    if (a.staffId === staffId && a.date === date) return;
    setMoving(true);
    try {
      await trpc.schedule.assign.mutate({ staffId, date, startMin: a.startMin, endMin: a.endMin, note: sc('sched.drop.note') });
      await trpc.schedule.cancelAssignment.mutate({ assignmentId: a.id, note: sc('sched.drop.note') });
      toast(sc('sched.drop.done'));
      invalidateAll();
    } catch (err) {
      // server 硬拒（请假覆盖/同键撞/停职）明文原样透出
      toast(errMsg(err), 'error');
    } finally {
      setMoving(false);
    }
  };

  /* ---- 模板表单 ---- */
  const [tplName, setTplName] = useState('');
  const [tplStart, setTplStart] = useState('09:00');
  const [tplEnd, setTplEnd] = useState('18:00');
  const [tplDays, setTplDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [tplBusy, setTplBusy] = useState(false);

  const saveTemplate = async () => {
    if (!tplName.trim() || tplDays.length === 0 || hmToMin(tplStart) >= hmToMin(tplEnd)) {
      toast(sc('sched.tpl.invalid'), 'error');
      return;
    }
    setTplBusy(true);
    try {
      await trpc.schedule.templateUpsert.mutate({
        name: tplName.trim(),
        startMin: hmToMin(tplStart),
        endMin: hmToMin(tplEnd),
        weekdays: tplDays,
      });
      toast(sc('sched.tpl.saved'));
      setTplName('');
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setTplBusy(false);
    }
  };

  const deactivateTemplate = async (id: string) => {
    try {
      await trpc.schedule.templateDeactivate.mutate({ id });
      toast(sc('sched.tpl.deactivated'));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    }
  };

  /* ---- 生成 + 发布 ---- */
  const [genBusy, setGenBusy] = useState(false);
  const [pubBusy, setPubBusy] = useState(false);
  const runGenerate = async () => {
    setGenBusy(true);
    try {
      const r = await trpc.schedule.generate.mutate({ weekStart });
      const detail =
        r.skipReport.length > 0
          ? `：${r.skipReport.map((s) => `${s.staffName} ${s.date} ${s.reason}`).join('；')}`
          : '';
      toast(`${sc('sched.gen.done', { created: r.created, skipped: r.skippedExisting })}${detail}`);
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setGenBusy(false);
    }
  };
  const runPublish = async () => {
    setPubBusy(true);
    try {
      const r = await trpc.schedule.publishWeek.mutate({ weekStart });
      toast(sc('sched.gen.published', { n: r.published }));
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setPubBusy(false);
    }
  };

  /* ---- CSV 导入 ---- */
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const runPreview = async () => {
    if (!csvText.trim()) {
      toast(sc('sched.import.empty'), 'error');
      return;
    }
    setImportBusy(true);
    try {
      setPreview(await trpc.schedule.importPreview.mutate({ csvText }));
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setImportBusy(false);
    }
  };
  const runImport = async () => {
    setImportBusy(true);
    try {
      const r = await trpc.schedule.importExecute.mutate({ csvText });
      toast(sc('sched.import.executed', { inserted: r.inserted, skipped: r.skippedDuplicates + r.failRows }));
      setPreview(null);
      setCsvText('');
      invalidateAll();
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setImportBusy(false);
    }
  };

  /* ---- 技能标签（点选切换即存） ---- */
  const skillMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const row of skillsQuery.data?.staff ?? []) m.set(row.id, row.tags);
    return m;
  }, [skillsQuery.data]);
  const [skillBusy, setSkillBusy] = useState<string | null>(null);
  const toggleSkill = async (staffId: string, tag: string) => {
    const cur = skillMap.get(staffId) ?? [];
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
    setSkillBusy(`${staffId}|${tag}`);
    try {
      await trpc.schedule.setSkills.mutate({ staffId, tags: next });
      toast(sc('sched.skill.saved'));
      void queryClient.invalidateQueries({ queryKey: ['schedule', 'staffSkills'] });
    } catch (err) {
      toast(errMsg(err), 'error');
    } finally {
      setSkillBusy(null);
    }
  };

  if (!role.canManage) {
    return <RoleGuidePage title={sc('sched.guideTitle')} hint={sc('sched.guideHint')} />;
  }

  const tagList = tagsQuery.data?.tags ?? [];
  const templates = templatesQuery.data?.templates ?? [];
  const skillRows = skillsQuery.data?.staff ?? [];

  return (
    <MainScaffold title={sc('sched.pageTitle')} sub={sc('sched.pageSub')} testid="sched-page">
      <ToasterMount />

      {/* 生成 + 发布条（周选择驱动全页） */}
      <div className="u3-panel mb-4">
        <div className="flex flex-wrap items-center gap-2.5 px-[17px] py-3">
          <Btn variant="subtle" size="sm" onClick={() => setWeekStart(dateStr(addDays(new Date(`${weekStart}T00:00:00`), -7)))}>
            {sc('sched.week.prev')}
          </Btn>
          <Btn variant="subtle" size="sm" onClick={() => setWeekStart(dateStr(mondayOf(new Date())))} data-testid="sched-week-this">
            {sc('sched.week.this')}
          </Btn>
          <Btn variant="subtle" size="sm" onClick={() => setWeekStart(dateStr(addDays(new Date(`${weekStart}T00:00:00`), 7)))}>
            {sc('sched.week.next')}
          </Btn>
          <span className="u1-num text-caption text-ink-secondary">{weekStart} ~ {days[6]}</span>
          <Badge tone={weekPublished ? 'success' : 'brand'}>{weekPublished ? sc('sched.week.published') : sc('sched.week.draft')}</Badge>
          <span className="ml-auto flex items-center gap-2.5">
            <Btn variant="subtle" size="sm" disabled={genBusy} onClick={() => void runGenerate()} data-testid="sched-generate">
              {genBusy ? sc('sched.gen.generating') : sc('sched.gen.generateCta')}
            </Btn>
            <Btn variant="primary" size="sm" disabled={pubBusy} onClick={() => void runPublish()} data-testid="sched-publish">
              {pubBusy ? sc('sched.gen.publishing') : sc('sched.gen.publishCta')}
            </Btn>
          </span>
        </div>
        <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-2 text-caption-xs text-[rgba(59,46,36,.42)]">
          {sc('sched.gen.publishNote')}
        </p>
      </div>

      {/* 周视图网格（员工×周一~日；格可落、块可拖） */}
      <div className="u3-panel mb-4 overflow-x-auto">
        {weekQuery.isPending ? (
          <div className="p-[17px]" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="mb-2.5 h-16 !rounded-[16px]" />
            ))}
          </div>
        ) : weekQuery.isError ? (
          <div className="px-[17px] py-12 text-center">
            <p className="text-body-sm text-[rgba(59,46,36,.62)]">{sc('sched.common.loadFail')}</p>
            <div className="mt-4">
              <Btn variant="subtle" size="sm" onClick={() => void weekQuery.refetch()}>
                {sc('sched.common.retry')}
              </Btn>
            </div>
          </div>
        ) : staffRows.length === 0 ? (
          <div className="px-[17px] py-12 text-center text-body-sm text-[rgba(59,46,36,.62)]">{sc('sched.week.empty')}</div>
        ) : (
          <table className="w-full min-w-[860px] border-collapse text-caption" data-testid="sched-grid">
            <thead>
              <tr>
                <th className="border-b border-[rgba(59,46,36,.08)] px-2 py-2 text-left text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
                  {sc('sched.week.staffCol')}
                </th>
                {days.map((d, i) => (
                  <th key={d} className="border-b border-[rgba(59,46,36,.08)] px-2 py-2 text-center text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">
                    {WEEKDAY_LABEL[(i + 1) % 7]}
                    <span className="u1-num ml-1 font-normal">{d.slice(5)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffRows.map((s) => (
                <tr key={s.id}>
                  <td className="border-b border-[rgba(59,46,36,.06)] px-2 py-2 align-top font-semibold text-ink">{s.name}</td>
                  {days.map((d) => {
                    const blocks = cellMap.get(`${s.id}|${d}`) ?? [];
                    return (
                      <td
                        key={d}
                        data-testid={`sched-cell-${s.id}-${d}`}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => void onDrop(e, s.id, d)}
                        className="min-w-[110px] border-b border-l border-[rgba(59,46,36,.06)] px-1.5 py-1.5 align-top"
                      >
                        {blocks.map((a) => (
                          <ShiftBlock key={a.id} a={a} onDragStart={onDragStart} />
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 班次模板区 */}
      <div className="u3-panel mb-4">
        <div className="u3-panel-head">
          <h3>{sc('sched.tpl.title')}</h3>
          <span className="aside">{sc('sched.tpl.aside')}</span>
        </div>
        <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder={sc('sched.tpl.namePh')}
              data-testid="sched-template-name"
              className="u1-ring w-44 rounded-control bg-card px-3 py-2 text-caption text-ink placeholder:text-[rgba(59,46,36,.42)] focus:outline-none"
            />
            <input type="time" value={tplStart} onChange={(e) => setTplStart(e.target.value)} data-testid="sched-template-start"
              className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none" />
            <input type="time" value={tplEnd} onChange={(e) => setTplEnd(e.target.value)} data-testid="sched-template-end"
              className="u1-ring rounded-control bg-card px-3 py-2 text-caption text-ink focus:outline-none" />
            <WeekdayChips value={tplDays} onChange={setTplDays} />
            <Btn variant="primary" size="sm" disabled={tplBusy} onClick={() => void saveTemplate()} data-testid="sched-template-save">
              {sc('sched.tpl.saveCta')}
            </Btn>
          </div>
        </div>
        {templatesQuery.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            <Skeleton className="h-10 !rounded-[16px]" />
          </div>
        ) : templates.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-6 text-center text-caption text-[rgba(59,46,36,.42)]">
            {sc('sched.tpl.empty')}
          </p>
        ) : (
          templates.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`sched-template-row-${t.id}`}>
              <span className="text-body-sm font-bold text-ink">{t.name}</span>
              <span className="u1-num text-caption text-[rgba(59,46,36,.62)]">
                {minToHm(t.startMin)}–{minToHm(t.endMin)}
              </span>
              <span className="text-caption-xs text-[rgba(59,46,36,.42)]">
                {[...t.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_LABEL[d] ?? d).join('/')}
              </span>
              {!t.active ? <Badge tone="muted">{sc('sched.tpl.deactivated')}</Badge> : null}
              {t.active ? (
                <Btn variant="subtle" size="sm" className="ml-auto" onClick={() => void deactivateTemplate(t.id)} data-testid={`sched-template-deactivate-${t.id}`}>
                  {sc('sched.tpl.deactivate')}
                </Btn>
              ) : null}
            </div>
          ))
        )}
      </div>

      {/* 换班审批区（swapQueue 读口已落：pending 队列+批准换挂/驳回 note 强制） */}
      <div className="u3-panel mb-4" data-testid="sched-swap">
        <div className="u3-panel-head">
          <h3>{sc('sched.swap.title')}</h3>
          <span className="aside">{sc('sched.swap.aside')}</span>
        </div>
        {swapQ.data?.swaps.length ? (
          swapQ.data.swaps.map((s) => (
            <div
              key={s.id}
              data-testid={`sched-swap-row-${s.id}`}
              className="flex items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-body-sm font-semibold text-ink">
                  {s.fromStaffName ?? '?'} → {s.toStaffName ?? sc('sched.swap.openTarget')}
                </div>
                <div className="u1-num mt-0.5 text-caption-xs text-[rgba(59,46,36,.42)]">
                  {s.date} {minToHm(s.startMin ?? 0)}–{minToHm(s.endMin ?? 0)} · {s.reason}
                </div>
              </div>
              <Btn
                variant="primary"
                size="sm"
                disabled={swapActing}
                onClick={() => void resolveSwap(s.id, true)}
                data-testid={`sched-swap-approve-${s.id}`}
              >
                {sc('sched.swap.approve')}
              </Btn>
              <Btn
                variant="subtle"
                size="sm"
                disabled={swapActing}
                onClick={() => void resolveSwap(s.id, false)}
                data-testid={`sched-swap-reject-${s.id}`}
              >
                {sc('sched.swap.reject')}
              </Btn>
            </div>
          ))
        ) : (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-4 text-caption text-[rgba(59,46,36,.62)]">
            {sc('sched.swap.empty')}
          </p>
        )}
      </div>

      {/* CSV 批量导入 */}
      <div className="u3-panel mb-4">
        <div className="u3-panel-head">
          <h3>{sc('sched.import.title')}</h3>
          <span className="aside">{sc('sched.import.aside')}</span>
        </div>
        <div className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-3">
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={5}
            placeholder={sc('sched.import.placeholder')}
            data-testid="sched-import-input"
            className="u1-ring w-full rounded-input bg-card px-3 py-2.5 font-mono text-caption text-ink placeholder:text-[rgba(59,46,36,.42)] focus:outline-none"
          />
          <div className="mt-2 flex items-center gap-2">
            <Btn variant="subtle" size="sm" disabled={importBusy} onClick={() => void runPreview()} data-testid="sched-import-preview">
              {sc('sched.import.previewCta')}
            </Btn>
            {preview ? (
              <Btn variant="primary" size="sm" disabled={importBusy} onClick={() => void runImport()} data-testid="sched-import-execute">
                {sc('sched.import.executeCta')}
              </Btn>
            ) : null}
          </div>
          {preview ? (
            <div className="mt-3" data-testid="sched-import-table">
              <p className="mb-1.5 text-caption-xs text-[rgba(59,46,36,.62)]">
                {sc('sched.import.summary', { ok: preview.okRows, fail: preview.failRows })}
              </p>
              <table className="w-full border-collapse text-caption">
                <thead>
                  <tr>
                    {[sc('sched.import.colLine'), sc('sched.import.colStaff'), sc('sched.import.colDate'), sc('sched.import.colRange'), sc('sched.import.colResult')].map((h) => (
                      <th key={h} className="border-b border-[rgba(59,46,36,.08)] px-2 py-1.5 text-left text-caption-xs font-semibold text-[rgba(59,46,36,.42)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line}>
                      <td className="u1-num border-b border-[rgba(59,46,36,.06)] px-2 py-1.5">{r.line}</td>
                      <td className="border-b border-[rgba(59,46,36,.06)] px-2 py-1.5">{r.staffInput || '—'}</td>
                      <td className="u1-num border-b border-[rgba(59,46,36,.06)] px-2 py-1.5">{r.date ?? '—'}</td>
                      <td className="u1-num border-b border-[rgba(59,46,36,.06)] px-2 py-1.5">
                        {r.startMin !== undefined && r.endMin !== undefined ? `${minToHm(r.startMin)}–${minToHm(r.endMin)}` : '—'}
                      </td>
                      <td className="border-b border-[rgba(59,46,36,.06)] px-2 py-1.5">
                        {r.ok ? <Badge tone="success">{sc('sched.import.rowOk')}</Badge> : <Badge tone="danger">{r.failReason ?? '—'}</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {/* 技能标签 */}
      <div className="u3-panel mb-4">
        <div className="u3-panel-head">
          <h3>{sc('sched.skill.title')}</h3>
          <span className="aside">{sc('sched.skill.aside')}</span>
        </div>
        {skillsQuery.isPending ? (
          <div className="px-[17px] py-3" aria-label="加载中">
            <Skeleton className="h-10 !rounded-[16px]" />
          </div>
        ) : skillRows.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-6 text-center text-caption text-[rgba(59,46,36,.42)]">
            {sc('sched.skill.empty')}
          </p>
        ) : tagList.length === 0 ? (
          <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-6 text-center text-caption text-[rgba(59,46,36,.42)]">
            {sc('sched.skill.noTags')}
          </p>
        ) : (
          skillRows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center gap-2 border-t border-[rgba(59,46,36,.06)] px-[17px] py-2.5" data-testid={`sched-skill-row-${row.id}`}>
              <span className="w-20 shrink-0 text-body-sm font-bold text-ink">{row.name}</span>
              {tagList.map((tag) => {
                const on = (skillMap.get(row.id) ?? []).includes(tag);
                const busy = skillBusy === `${row.id}|${tag}`;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => void toggleSkill(row.id, tag)}
                    data-testid={`sched-skill-${row.id}-${tag}`}
                    className={`min-h-[36px] rounded-chip px-3 text-caption font-semibold transition-transform duration-120 ease-philia-spring active:scale-92 disabled:opacity-50 ${
                      on ? 'bg-ink text-[#F2DFA6]' : 'bg-sunken text-ink-secondary'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* WiFi 白名单区（server 无 wifiBssids 族端点——只读置灰注记位，不造假按钮） */}
      <div className="u3-panel opacity-60" data-testid="sched-wifi">
        <div className="u3-panel-head">
          <h3>{sc('sched.wifi.title')}</h3>
        </div>
        <p className="border-t border-[rgba(59,46,36,.06)] px-[17px] py-4 text-caption text-[rgba(59,46,36,.62)]">
          {sc('sched.wifi.pending')}
        </p>
      </div>
    </MainScaffold>
  );
}
