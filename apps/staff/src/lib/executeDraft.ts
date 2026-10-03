/**
 * 中途退出记忆续做（B5-3）· 执行页表单草稿纯模块（员工端骨架整建批 片 3）
 *
 * - key=`philia-staff-exec-draft:{appointmentId}`，值={stepId, fields, savedAt}；
 * - TTL 24h：读取时过期即自清（删键返回 null）；坏 JSON 同样自清；
 * - storage 可注入（node 冒烟可测），缺省 localStorage；localStorage 不可用
 *   （隐私模式等）时降级为无操作，页面主流程不受影响；
 * - 提交成功后由调用方 clearDraft；暂存仅本机（页面注记明面，不跨设备同步）。
 */

export interface ExecDraft {
  /** 草稿所属步骤（如六步 confirm 报告卡） */
  stepId: string;
  /** 表单字段快照（扁平键 → 文本值） */
  fields: Record<string, string>;
  /** 暂存时刻（epoch ms） */
  savedAt: number;
}

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** 草稿存活期：24h */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function draftKey(appointmentId: string): string {
  return `philia-staff-exec-draft:${appointmentId}`;
}

/** 缺省存储：localStorage（不可用时返回 null，调用方整体降级为不暂存） */
function defaultStorage(): DraftStorage | null {
  try {
    const s = window.localStorage;
    // 探测写权限（隐私模式 setItem 可能抛）
    const probe = `${draftKey('__probe__')}`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

function isDraft(v: unknown): v is ExecDraft {
  if (typeof v !== 'object' || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.stepId === 'string' &&
    typeof d.savedAt === 'number' &&
    typeof d.fields === 'object' &&
    d.fields !== null &&
    !Array.isArray(d.fields) &&
    Object.values(d.fields as Record<string, unknown>).every((x) => typeof x === 'string')
  );
}

/** 读草稿：不存在/过期/坏值一律 null（过期与坏值顺手自清） */
export function readDraft(
  appointmentId: string,
  storage: DraftStorage | null = defaultStorage(),
  now: number = Date.now(),
): ExecDraft | null {
  if (!storage) return null;
  const key = draftKey(appointmentId);
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    storage.removeItem(key); // 坏 JSON 自清
    return null;
  }
  if (!isDraft(parsed)) {
    storage.removeItem(key); // 形状不符自清
    return null;
  }
  if (now - parsed.savedAt > DRAFT_TTL_MS) {
    storage.removeItem(key); // 过期自清
    return null;
  }
  return parsed;
}

/** 写草稿（fields 空对象不落地——没有可续做的内容） */
export function saveDraft(
  appointmentId: string,
  draft: { stepId: string; fields: Record<string, string> },
  storage: DraftStorage | null = defaultStorage(),
  now: number = Date.now(),
): void {
  if (!storage) return;
  if (Object.keys(draft.fields).length === 0) return;
  const rec: ExecDraft = { stepId: draft.stepId, fields: draft.fields, savedAt: now };
  try {
    storage.setItem(draftKey(appointmentId), JSON.stringify(rec));
  } catch {
    // 存储写失败（配额满等）：静默降级，不阻断填写
  }
}

/** 清草稿（提交成功 / 用户一键丢弃；幂等） */
export function clearDraft(
  appointmentId: string,
  storage: DraftStorage | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(draftKey(appointmentId));
  } catch {
    // 忽略
  }
}
