/**
 * 预约列表行（U3 任务 D · 规格书 §3 · 母本 279–284 行）：u3-tbl 的 tr.rowlink ——
 * 时间（Montserrat 数字字族）｜宠物+客户（副行 昵称·尾号）｜服务｜员工+来源小签
 * （assignSourceLabel 口径 appt-utils.ts）｜金额（priceFen→¥，tabular）｜状态胶囊｜›。
 *
 * S4 起列表纯读：行内确认/婉拒已迁入详情页。selected/confirming/onConfirm/onReject
 * 仅以 @deprecated 保留在签名里，供 MonitorHubPage（非本批授权文件）编译兼容，
 * 渲染一律忽略；点行进 /appointments/:id。
 */

import {
  assignSourceLabel,
  customerLabel,
  fmtTime,
  type ListForStoreItem,
} from './appt-utils';
import type { StepProgress } from './useStepProgress';

/** 状态胶囊口径（规格书 §3）：cls = u3-st 修饰类（live/wait/done/amber）；
    服务中携带六步进度「服务中 N/6」（试样 §3 口径；进度未回=裸「服务中」不伪造） */
function statusCapsule(
  item: ListForStoreItem,
  progress?: StepProgress | null,
): { cls: 'live' | 'wait' | 'done' | 'amber'; text: string } {
  switch (item.status) {
    case 'pending':
      return { cls: 'wait', text: '待确认' };
    case 'confirmed':
      return { cls: 'wait', text: '待到店' };
    case 'in_service':
      return {
        cls: 'live',
        text: progress ? `服务中 ${progress.done}/${progress.total}` : '服务中',
      };
    case 'in_boarding':
      return { cls: 'live', text: '寄养中' };
    case 'completed':
      // 未收款附「· 待收款」
      return { cls: 'done', text: item.paidAt ? '已完成' : '已完成 · 待收款' };
    case 'cancel_requested':
      return { cls: 'amber', text: '取消申请待审' };
    default:
      return { cls: 'done', text: '已取消' };
  }
}

/** 金额分 → ¥元：整数去小数（母本 ¥128 口径），非整数保留两位；数字字族由 u1-num 保证 */
const fmtPrice = (fen: number): string => {
  const yuan = fen / 100;
  return Number.isInteger(yuan) ? `¥${yuan}` : `¥${yuan.toFixed(2)}`;
};

export function AppointmentRow({
  item,
  onOpen,
  progress,
}: {
  item: ListForStoreItem;
  onOpen: () => void;
  /** 服务中行的六步进度（试样「服务中 N/6」）；未回/非服务中传空 */
  progress?: StepProgress | null;
  /** @deprecated S4 起列表纯读；仅为 MonitorHubPage 编译兼容保留，渲染忽略 */
  selected?: boolean;
  /** @deprecated 同上 */
  confirming?: boolean;
  /** @deprecated 同上 */
  onConfirm?: (id: string) => void;
  /** @deprecated 同上 */
  onReject?: (id: string) => void;
}) {
  const cap = statusCapsule(item, progress);
  const srcLabel = assignSourceLabel(item.assignSource);

  return (
    <tr
      className="rowlink"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
      }}
    >
      {/* 时间（Montserrat tabular） */}
      <td className="u1-num font-bold">{fmtTime(item.scheduledStart)}</td>

      {/* 宠物 + 客户（副行：昵称 · 尾号，customerPhoneTail 现成字段） */}
      <td>
        <span className="font-semibold">{item.petName ?? '宠物'}</span>
        <span className="mt-0.5 block text-[11px] text-[rgba(74,59,46,.42)]">
          {customerLabel(item.customerName, item.customerPhoneTail)}
        </span>
      </td>

      {/* 服务 */}
      <td>{item.serviceName ?? '服务'}</td>

      {/* 员工 + 来源小签（自动派单 / 商家改派；null 不显示） */}
      <td>
        {item.staffName ?? '未指派'}
        {srcLabel ? (
          <span className="ml-1 text-[11px] text-[rgba(74,59,46,.42)]">{srcLabel}</span>
        ) : null}
      </td>

      {/* 金额（Montserrat tabular） */}
      <td className="u1-num font-semibold">{fmtPrice(item.priceFen)}</td>

      {/* 状态胶囊 */}
      <td>
        <span className={`u3-st ${cap.cls}`}>{cap.text}</span>
      </td>

      {/* › */}
      <td className="text-[rgba(74,59,46,.42)]">›</td>
    </tr>
  );
}
