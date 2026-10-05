/**
 * 任务协同域 · 端口接口与类型锚点（员工端骨架整建批 片 3 · 员工端，coder H）
 *
 * server 侧 taskExec / pdca / selfCheck / announce / serviceLoop 员工面与 config 公开
 * 读口由 coder G 并行施工（本批施工单冻结签名）；AppRouter 尚未含这些 namespace，
 * 故本文件按冻结契约定义结构接口，trpc 经一次结构断言接入（collabOf）——
 * 类型锚点集中在本文，集成期 server 落地后若签名漂移只改本文件对齐。
 * 调用纪律同 lib/schedulePort.ts：query 走 useQuery，mutation 后 invalidateQueries。
 *
 * 待 G 对齐点（集成期核对）：
 * 1. staffConfig.ruleValue.query({key}) → { value: unknown } —— service_rules 端口值
 *    公开读口（pdca_categories / voice_sla_hours），读失败一律回落码内缺省；
 * 2. serviceLoop.ticketListMineStaff 返回形=裸数组（同既有 ticketListMine 口径）；
 * 3. selfCheck.today 返回 run|null（run 带 score/status/submittedAt/items）。
 */

import type { usePhiliaClient } from '@philia/shared';

type Trpc = ReturnType<typeof usePhiliaClient>['trpc'];

/* ------------------------------------------------------------------ */
/* taskExec：循环任务落实例（片 3 B5-1）                                  */
/* ------------------------------------------------------------------ */

export interface TaskRun {
  id: string;
  templateId: string;
  title: string;
  detail: string | null;
  /** 当日截止时刻（当日起算分钟数，1080=18:00） */
  dueMin: number;
  remindMin: number | null;
  status: 'pending' | 'done';
  doneBy: string | null;
  doneAt: Date | string | null;
  staffId: string | null;
  assignScope: string;
  assignRole: string | null;
}

/* ------------------------------------------------------------------ */
/* pdca：问题上报/整改闭环（片 3；员工可见本店全部）                        */
/* ------------------------------------------------------------------ */

export type PdcaStatus = 'open' | 'fixing' | 'recheck' | 'closed';

export interface PdcaIssue {
  id: string;
  title: string;
  category: string;
  detail: string | null;
  photoUrls: string[];
  status: PdcaStatus;
  assignStaffId: string | null;
  raisedBy: string;
  fixNote: string | null;
  recheckNote: string | null;
  recheckResult: string | null;
  timelineJson: unknown;
  createdAt: Date | string;
}

/* ------------------------------------------------------------------ */
/* selfCheck：每日自检（片 3）                                            */
/* ------------------------------------------------------------------ */

export interface SelfCheckItem {
  key: string;
  label: string;
  score: number;
}

export interface SelfCheckRunItem {
  key: string;
  pass: boolean;
  photoUrl?: string | null;
  note?: string | null;
}

export interface SelfCheckRun {
  id: string;
  items: SelfCheckRunItem[];
  score: number;
  /** 审核状态（店长复核）：pending | approved | rejected（缺省按 pending 透出） */
  status?: string | null;
  submittedAt?: Date | string | null;
}

/* ------------------------------------------------------------------ */
/* announce：门店公告（片 3）                                             */
/* ------------------------------------------------------------------ */

export interface AnnounceRow {
  id: string;
  title: string;
  body: string;
  targetRole: string | null;
  pinned: boolean;
  publishedAt: Date | string;
  readAt: Date | string | null;
}

/* ------------------------------------------------------------------ */
/* serviceLoop 员工面：员工心声工单（support_tickets createdVia=staff）     */
/* ------------------------------------------------------------------ */

export interface VoiceTicket {
  id: string;
  ticketNo: string;
  type: string;
  description: string;
  photoUrls: string[];
  contactPhone: string | null;
  status: 'submitted' | 'replied' | 'closed';
  replyText: string | null;
  repliedAt: Date | string | null;
  createdAt: Date | string;
}

/* ------------------------------------------------------------------ */
/* 端口结构（冻结契约签名；collabOf 一次断言接入）                          */
/* ------------------------------------------------------------------ */

export interface CollabPort {
  taskExec: {
    listToday: { query(): Promise<{ runs: TaskRun[] }> };
    done: { mutate(input: { runId: string }): Promise<unknown> };
  };
  pdca: {
    list: { query(input?: { status?: PdcaStatus }): Promise<{ issues: PdcaIssue[] }> };
    categories: { query(): Promise<{ categories: string[] }> };
    raise: {
      mutate(input: { title: string; category: string; detail?: string; photoUrls?: string[] }): Promise<unknown>;
    };
    startFix: { mutate(input: { issueId: string }): Promise<unknown> };
    submitFix: { mutate(input: { issueId: string; fixNote: string }): Promise<unknown> };
  };
  selfCheck: {
    items: { query(): Promise<{ items: SelfCheckItem[] }> };
    today: { query(): Promise<{ run: SelfCheckRun | null }> };
    submit: {
      mutate(input: { items: Array<{ key: string; pass: boolean; photoUrl?: string; note?: string }> }): Promise<unknown>;
    };
  };
  announce: {
    list: { query(): Promise<{ view: string; announcements: AnnounceRow[] }> };
    markRead: { mutate(input: { announcementId: string }): Promise<unknown> };
  };
  serviceLoopStaff: {
    ticketCreateStaff: {
      mutate(input: { description: string; photoUrls?: string[]; contactPhone?: string }): Promise<unknown>;
    };
    ticketListMineStaff: { query(): Promise<VoiceTicket[]> };
    /** 心声响应时限端口值读口（serviceLoop.voiceSlaHours，server 已落） */
    voiceSlaHours: { query(): Promise<{ hours: number }> };
  };
}

/** trpc → 协同域端口（结构断言；server 侧 namespace 落地后等价直读） */
export function collabOf(trpc: Trpc): CollabPort {
  const raw = trpc as unknown as {
    taskExec: CollabPort['taskExec'];
    pdca: CollabPort['pdca'];
    selfCheck: CollabPort['selfCheck'];
    announce: CollabPort['announce'];
    serviceLoop: {
      ticketCreateStaff: unknown;
      ticketListMineStaff: unknown;
      voiceSlaHours: unknown;
    };
  };
  return {
    taskExec: raw.taskExec,
    pdca: raw.pdca,
    selfCheck: raw.selfCheck,
    announce: raw.announce,
    serviceLoopStaff: {
      ticketCreateStaff: raw.serviceLoop.ticketCreateStaff as CollabPort['serviceLoopStaff']['ticketCreateStaff'],
      ticketListMineStaff: raw.serviceLoop.ticketListMineStaff as CollabPort['serviceLoopStaff']['ticketListMineStaff'],
      voiceSlaHours: raw.serviceLoop.voiceSlaHours as CollabPort['serviceLoopStaff']['voiceSlaHours'],
    },
  };
}

/* ------------------------------------------------------------------ */
/* service_rules 端口值读取（读失败/坏值一律回落缺省，页面不因此报错）       */
/* ------------------------------------------------------------------ */

/** 心声响应时限（小时）：serviceLoop.voiceSlaHours（server 读 service_rules.voice_sla_hours）；读失败缺省 24 */
export async function readVoiceSlaHours(port: CollabPort): Promise<number> {
  try {
    const r = await port.serviceLoopStaff.voiceSlaHours.query();
    return Number.isFinite(r.hours) && r.hours > 0 ? r.hours : 24;
  } catch {
    return 24;
  }
}

/** PDCA 默认类目集（pdca.categories 读失败时回落；与迁移 0031 种子同族口径） */
export const PDCA_CATEGORY_FALLBACK = ['卫生', '设备', '服务', '安全', '其他'] as const;

/** PDCA 类目集：pdca.categories（server 读 service_rules.pdca_categories）；缺省回落上表 */
export async function readPdcaCategories(port: CollabPort): Promise<string[]> {
  try {
    const r = await port.pdca.categories.query();
    if (Array.isArray(r.categories)) {
      const list = r.categories.filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (list.length > 0) return list;
    }
    return [...PDCA_CATEGORY_FALLBACK];
  } catch {
    return [...PDCA_CATEGORY_FALLBACK];
  }
}

/* ------------------------------------------------------------------ */
/* 日期/时刻显示助手（trpc 超级JSON 回落 Date；string 兜防序列化漂移）      */
/* ------------------------------------------------------------------ */

export const toDate = (v: Date | string | null | undefined): Date | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** MM-DD HH:mm（列表行右值轨） */
export function fmtMdHm(v: Date | string | null | undefined): string {
  const d = toDate(v);
  if (!d) return '';
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 当日起算分钟数 → HH:mm（taskRun.dueMin 用） */
export function minToHm(m: number): string {
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
