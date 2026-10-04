/**
 * 权限矩阵 /matrix（商家端控制台骨架批 · 片 5 段 3 · W-14 真页，替换段 0 占位）
 *
 * 区块序（UX-02 语言包 §四 W-14）：
 *   wtop（MainScaffold + 锁死区红胶囊 WPill red）
 *   → M5 矩阵全幅（WMatrix：角色行 店主/店长/前台/美容师 × 权限列 收银/退款/日结/
 *     反结账/库存/会员/员工/规则配置/文案端口/槽位/报表/权限矩阵，四态格 ✓/—/只读/锁死）
 *   → 口径注（编辑归控制台本页只读 / 锁死区任何端不可改 / 数据真源）。
 *
 * 数据=静态结构（本页只读，不做编辑器）。真源：
 * - lib/roles.ts 头注冻结口径（三角色硬闸门/总规则②③/改价折扣日结反结账导出导入口径）；
 * - docs/ops/20_权限矩阵V1.2修订页（退款行）：店长≤阈值且非涉储值，超阈值/涉储值仅店主；
 * - docs/ops/26_权限矩阵V1.3修订页（运营）：驳回权行/盘点/会员翻查/补偿权等。
 * 映射口径：前台=收银执行层（V1.3「店员」列）；美容师=服务执行层（无商家端工作面，
 * 核销/收款皆无入口）。改矩阵先改真源三件，本页常量随行注释同步。
 */

import MainScaffold from '../components/MainScaffold';
import { WPill, WMatrix, type WMatrixCell } from '../components/skeleton';
import { mtx } from '../copy/matrix';

/* ------------------------------------------------------------------ */
/* 矩阵静态结构（真源见文件头三件；列序冻结，改动须附真源修订依据）          */
/* ------------------------------------------------------------------ */

const COLUMNS = [
  mtx('mtx.colCashier'),
  mtx('mtx.colRefund'),
  mtx('mtx.colClose'),
  mtx('mtx.colReverse'),
  mtx('mtx.colStock'),
  mtx('mtx.colMember'),
  mtx('mtx.colStaff'),
  mtx('mtx.colRules'),
  mtx('mtx.colCopy'),
  mtx('mtx.colSlots'),
  mtx('mtx.colReport'),
  mtx('mtx.colMatrix'),
];

/** 四态：ok=✓ / no=—（无入口）/ readonly=只读 / locked=锁死（锁死区任何端不可改） */
const O: WMatrixCell = 'ok';
const X: WMatrixCell = 'no';
const R: WMatrixCell = 'readonly';
const L: WMatrixCell = 'locked';

const ROWS: Array<{ key: string; label: string; cells: WMatrixCell[] }> = [
  {
    key: 'owner',
    label: mtx('mtx.roleOwner'),
    // 店主=全域（反结账/导出/储值导入仅店主；矩阵本体只读——编辑归控制台）
    cells: [O, O, O, O, O, O, O, O, O, O, O, R],
  },
  {
    key: 'manager',
    label: mtx('mtx.roleManager'),
    // 店长=本店+审批；退款≤阈值且非涉储值（V1.2）；反结账锁死仅店主；
    // 员工账号/三端口/导出无权限；矩阵只读
    cells: [O, O, O, L, O, O, X, X, X, X, O, R],
  },
  {
    key: 'frontdesk',
    label: mtx('mtx.roleFront'),
    // 前台=收银执行层（V1.3 店员列）：收款/扣次/挂撤单 ✓；会员=收银识别时
    // 可见档位/余额/次卡（只读，不可翻台账）；不看营业额（总规则②）
    cells: [O, X, X, L, X, R, X, X, X, X, X, X],
  },
  {
    key: 'groomer',
    label: mtx('mtx.roleGroomer'),
    // 美容师=服务执行层：无商家端工作面（员工端任务台）；核销/收款皆无入口
    cells: [X, X, X, L, X, X, X, X, X, X, X, X],
  },
];

const NOTES = [
  mtx('mtx.noteRefund'),
  mtx('mtx.noteStock'),
  mtx('mtx.noteMember'),
  mtx('mtx.noteReport'),
  mtx('mtx.noteMatrix'),
  mtx('mtx.noteLocked'),
  mtx('mtx.noteSource'),
];

export default function MatrixPage() {
  return (
    <MainScaffold
      title={mtx('mtx.pageTitle')}
      sub={mtx('mtx.pageSub')}
      actions={
        <span className="wsk">
          <WPill tone="red" testId="matrix-locked-pill">{mtx('mtx.lockedPill')}</WPill>
        </span>
      }
      testid="matrix-page"
    >
      <div className="wsk">
        <WMatrix roles={COLUMNS} rows={ROWS} testId="matrix-grid" />
        <div className="mt-3 space-y-1 px-1">
          {NOTES.map((n) => (
            <p key={n} className="wsk-note">{n}</p>
          ))}
        </div>
      </div>
    </MainScaffold>
  );
}
