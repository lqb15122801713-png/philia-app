/**
 * B4-2 寄养单屏 · 折叠区（默认收起，主流程零打字）：
 * 单行「备注 · 添加备注 ▸」，展开为 textarea；寄养固定到店付（裁定 A），
 * 本区不含收款选择器（与洗护 ExtrasBlock 区分）。
 *
 * 体验大批片 2 扩展（同折叠区内追加）：
 * - 紧急联系人三字段（姓名 / 11 位手机号 / 关系，建议填——任一填写即须补全，
 *   手机号格式错误在确认闸点名）；
 * - 遛弯次数数字输入（选填，>0 才随单提交）；
 * - 协议勾选两行（寄养协议 + 医疗授权，点协议名开全文底部半屏；医疗授权
 *   未勾选=确认闸硬拦，与 server 400 同源）。
 */

import { useState } from 'react';
import { agc, type BoardingAgreementKey } from '@/copy/agreement';
import { bkc } from '@/copy/booking';

export interface BoardingExtras {
  ecName: string;
  ecPhone: string;
  ecRelation: string;
  onEcName: (v: string) => void;
  onEcPhone: (v: string) => void;
  onEcRelation: (v: string) => void;
  /** 手机号格式校验错误（确认闸点名后透出；null=无错） */
  ecError: string | null;
  walkTimes: string;
  onWalkTimes: (v: string) => void;
  medicalAgreed: boolean;
  consentAgreed: boolean;
  onToggleMedical: () => void;
  onToggleConsent: () => void;
  /** 点协议名开全文底部半屏（「已阅读并同意」由页面层落勾） */
  onOpenAgreement: (key: BoardingAgreementKey) => void;
}

function AgreementRow({
  agreed,
  onToggle,
  onOpen,
  agreementKey,
  testId,
}: {
  agreed: boolean;
  onToggle: () => void;
  onOpen: () => void;
  agreementKey: BoardingAgreementKey;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-2 py-2.5" data-testid={testId}>
      <button
        type="button"
        role="checkbox"
        aria-checked={agreed}
        onClick={onToggle}
        data-testid={`${testId}-check`}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-[1.5px] transition ${
          agreed ? 'border-ink bg-ink' : 'border-line-strong bg-card'
        }`}
      >
        {agreed ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#F6EFDD" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </button>
      <span className="text-caption text-ink-secondary">
        {agc('agreement.agreeLabel')}
        <button
          type="button"
          onClick={onOpen}
          data-testid={`${testId}-open`}
          className="ml-0.5 font-medium text-ink underline underline-offset-2"
        >
          {agc(`agreement.${agreementKey}`)}
        </button>
      </span>
    </div>
  );
}

export default function NoteFoldBlock({
  note,
  onNoteChange,
  extras,
}: {
  note: string;
  onNoteChange: (v: string) => void;
  extras: BoardingExtras;
}) {
  const [open, setOpen] = useState(false);
  const [ecOpen, setEcOpen] = useState(false);
  const summary = note.trim() ? note.trim().slice(0, 12) + (note.trim().length > 12 ? '…' : '') : '添加备注';

  const inputCls =
    'w-full rounded-control border border-line bg-canvas px-3.5 py-2.5 text-body placeholder:text-ink-placeholder focus:border-ink focus:outline-none';

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
          className="mb-3 w-full rounded-control border border-line bg-canvas px-3.5 py-3 text-body placeholder:text-ink-placeholder focus:border-ink focus:outline-none"
        />
      ) : null}

      <div className="border-t border-line-ring" />

      {/* 紧急联系人（默认收起；任一填写即须补全三字段） */}
      <button
        type="button"
        onClick={() => setEcOpen((v) => !v)}
        data-testid="bs-ec-toggle"
        className="flex w-full items-center justify-between py-3 text-left"
      >
        <span className="text-body text-ink-secondary">{bkc('booking.emergencyTitle')}</span>
        <span className="ml-3 truncate text-body font-medium">
          {extras.ecName.trim() || '未填写'}{' '}
          <span className="text-ink-placeholder">{ecOpen ? '▾' : '▸'}</span>
        </span>
      </button>
      {ecOpen ? (
        <div className="space-y-2 pb-3">
          <input
            value={extras.ecName}
            onChange={(e) => extras.onEcName(e.target.value)}
            maxLength={32}
            placeholder={bkc('booking.ecNamePh')}
            data-testid="bs-ec-name"
            className={inputCls}
          />
          <input
            value={extras.ecPhone}
            onChange={(e) => extras.onEcPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
            inputMode="numeric"
            placeholder={bkc('booking.ecPhonePh')}
            data-testid="bs-ec-phone"
            className={inputCls}
          />
          <input
            value={extras.ecRelation}
            onChange={(e) => extras.onEcRelation(e.target.value)}
            maxLength={16}
            placeholder={bkc('booking.ecRelationPh')}
            data-testid="bs-ec-relation"
            className={inputCls}
          />
          {extras.ecError ? (
            <p className="text-caption text-danger-deep" data-testid="bs-ec-error">
              {extras.ecError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-line-ring" />

      {/* 遛弯次数（选填，>0 才随单提交） */}
      <div className="flex items-center justify-between gap-3 py-3">
        <span className="text-body text-ink-secondary">{bkc('booking.walkTimesLabel')}</span>
        <input
          value={extras.walkTimes}
          onChange={(e) => extras.onWalkTimes(e.target.value.replace(/\D/g, '').slice(0, 2))}
          inputMode="numeric"
          placeholder={bkc('booking.walkTimesPh')}
          data-testid="bs-walk-times"
          className="w-20 rounded-control border border-line bg-canvas px-3 py-2 text-right font-number text-body placeholder:text-ink-placeholder focus:border-ink focus:outline-none"
        />
      </div>

      <div className="border-t border-line-ring" />

      {/* 协议勾选两行（医疗授权=确认闸硬拦；点协议名开全文半屏） */}
      <AgreementRow
        agreed={extras.consentAgreed}
        onToggle={extras.onToggleConsent}
        onOpen={() => extras.onOpenAgreement('boarding_consent')}
        agreementKey="boarding_consent"
        testId="bs-boarding-consent"
      />
      <AgreementRow
        agreed={extras.medicalAgreed}
        onToggle={extras.onToggleMedical}
        onOpen={() => extras.onOpenAgreement('medical_auth')}
        agreementKey="medical_auth"
        testId="bs-medical-auth"
      />
    </div>
  );
}
