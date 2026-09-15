/**
 * B4-2 寄养单屏 · 折叠备注区（默认收起，主流程零打字）：
 * 单行「备注 · 添加备注 ▸」，展开为 textarea；寄养固定到店付（裁定 A），
 * 本区不含收款选择器（与洗护 ExtrasBlock 区分）。
 */

import { useState } from 'react';

export default function NoteFoldBlock({
  note,
  onNoteChange,
}: {
  note: string;
  onNoteChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const summary = note.trim() ? note.trim().slice(0, 12) + (note.trim().length > 12 ? '…' : '') : '添加备注';

  return (
    <div data-testid="bs-extras">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="bs-note-toggle"
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <span className="text-body text-ink-secondary">备注</span>
        <span className="ml-3 truncate text-body font-medium">
          {summary} <span className="text-ink-placeholder">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open ? (
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="饮食习惯、每日喂药、性格注意事项…"
          data-testid="bs-note-input"
          className="mb-3 w-full rounded-[14px] border border-line bg-canvas px-3.5 py-3 text-body placeholder:text-ink-placeholder focus:border-ink focus:outline-none"
        />
      ) : null}
    </div>
  );
}
