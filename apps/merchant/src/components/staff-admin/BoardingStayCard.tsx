/**
 * 在店寄养表行 + 宠物头像（U3 任务 G · BoardingPage 在店表，规格书 §6）
 *
 * 沿革：T4.3 的卡片网格看板在 U3 退役，本文件默认导出改为 u3-tbl 表格行
 * <tr> 渲染器（BoardingStayRow）；PetAvatar 继续供 BoardingStayDetail 使用。
 *
 * 行字段（boarding.stayBoard 行）：
 *   宠物（名 + 客户昵称·尾号）｜房型｜入住→退房｜进度 D N/M 晚｜
 *   今日打卡（lastLogDate=今天 → live「已打卡 ✓」，否则 wait「未打卡」）｜
 *   状态（在店 live / 应退未退 red）｜›
 *
 * 晚数口径（与服务端 boardingNightDates 同：from 日到 to 日前一日，本地日界）
 * 由页面统一计算后经 props 传入（本文件保持纯组件导出，过 react-refresh 闸）。
 */

import type { StayBoardRow } from './types';

/** M/D（试样「9/16 → 9/19」格式） */
const fmtMD = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

/** 手机号尾号 4 位（W-4 口径；无号或不足 4 位 → null，不编造） */
const phoneTail = (phone: string | null): string | null => {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};

export function PetAvatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-secondary font-semibold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default function BoardingStayRow({
  row,
  roomName,
  todayIso,
  nightIndex,
  totalNights,
  overdueDays,
  selected,
  onSelect,
}: {
  row: StayBoardRow;
  /** 房型名（serviceId → 服务名映射；查不到 → —） */
  roomName: string | null;
  /** 今日 YYYY-MM-DD（页面统一算一次，行内不各算） */
  todayIso: string;
  /** 当前第几晚 D（页面按本地日界算好，已夹取 [1, M]） */
  nightIndex: number;
  /** 总晚数 M */
  totalNights: number;
  /** 超期天数（row.overdue=true 时才有展示意义，已夹到 ≥1） */
  overdueDays: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { appointment, pet, customer } = row;
  const overdue = row.overdue;
  const punched = row.lastLogDate === todayIso;
  const tail = phoneTail(customer.phone);

  return (
    <tr
      className="rowlink"
      onClick={onSelect}
      style={selected ? { background: 'rgba(253,200,48,.14)' } : undefined}
      data-testid={`boarding-stay-${row.stay.id}`}
    >
      <td>
        <div className="font-semibold text-ink">{pet.name}</div>
        <div className="mt-0.5 text-caption-xs text-[rgba(74,59,46,.42)]">
          {customer.nickname ?? '客户'}
          {tail ? ` · 尾号 ${tail}` : ''}
        </div>
      </td>
      <td>{roomName ?? '—'}</td>
      <td className="font-number tabular-nums">
        {fmtMD(appointment.scheduledStart)} → {fmtMD(appointment.scheduledEnd)}
      </td>
      <td className="font-number tabular-nums">
        {overdue ? (
          <span className="font-semibold text-danger">超期 {overdueDays} 天</span>
        ) : (
          `D${nightIndex}/${totalNights} 晚`
        )}
      </td>
      <td>
        {punched ? (
          <span className="u3-st live">已打卡 ✓</span>
        ) : (
          <span className="u3-st wait">未打卡</span>
        )}
      </td>
      <td>{overdue ? <span className="u3-st red">应退未退</span> : <span className="u3-st live">在店</span>}</td>
      <td className="text-ink-placeholder">›</td>
    </tr>
  );
}
