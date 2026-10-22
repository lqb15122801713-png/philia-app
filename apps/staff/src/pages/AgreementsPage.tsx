/**
 * 协议与规范 /agreements（PD-80 · 员工端）
 *
 * 登录页协议小字的真落点（原《员工内测协议》《服务影像记录规范》为不可点纯文本）：
 * 两篇全文真页，?doc=staff|privacy 直开对应篇；未登录可访（登录前须可读）。
 * 内测期诚实文本：明面注记「内测期简版，正式条款以上线版本与门店公示为准」，不虚构条款。
 * 骨架帧：SkBackBar（fallback=/login）+ sk-panel 列表，点开就地展开全文。
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SkBackBar } from '@/components/skeleton';

interface AgreementDoc {
  key: 'staff' | 'privacy';
  title: string;
  version: string;
  body: string[];
}

const DOCS: readonly AgreementDoc[] = [
  {
    key: 'staff',
    title: '员工内测协议',
    version: '内测 v0.1 · 2026-10',
    body: [
      '1. 内测性质：本员工端为菲丽亚宠物内测系统，功能与文案可能随时调整；使用中遇到的问题请通过「问题上报」反馈。',
      '2. 账号责任：员工账号由门店分配，仅限本人使用；不得转借、共享账号，离店即退出登录。',
      '3. 操作真实：核销、打卡、寄养登记等操作直接产生经营记录，请按实际服务情况如实操作，禁止代打卡、虚报服务。',
      '4. 保密义务：在店知悉的客户信息、宠物信息、经营数据不得外传或用于本工作以外的用途。',
      '5. 内测期简版：本协议为内测期简版，正式条款以上线版本与门店公示为准。',
    ],
  },
  {
    key: 'privacy',
    title: '服务影像记录规范',
    version: '内测 v0.1 · 2026-10',
    body: [
      '1. 拍摄范围：服务过程照片仅拍摄宠物与服务操作本身，不拍摄客户面部、证件、支付信息等隐私内容。',
      '2. 六步留证：消毒 1–3 张 · 预检 2–6 张 · 洗护 3–9 张 · 精修 2–6 张 · 前后对比各 1 张；张数达标才能确认翻步。',
      '3. 可见范围：过程照片实时同步给该宠物家长查看；寄养打卡照片与备注同样对家长可见，请文明措辞。',
      '4. 保存与禁止：影像仅用于服务留证与家长同步，禁止下载外传、发布社交平台或用作其他用途。',
      '5. 内测期简版：本规范为内测期简版，正式条款以上线版本与门店公示为准。',
    ],
  },
];

export default function AgreementsPage() {
  const [params] = useSearchParams();
  const docParam = params.get('doc');
  const [openKey, setOpenKey] = useState<'staff' | 'privacy' | null>(
    docParam === 'staff' || docParam === 'privacy' ? docParam : null,
  );

  return (
    <div className="sk pb-6" data-testid="agreements-page">
      <SkBackBar title="协议与规范" fallback="/login" />
      <section className="mt-3 px-[22px]">
        {DOCS.map((d) => (
          <div key={d.key} className="u1-card mb-2 px-4 py-3" data-testid={`agreement-${d.key}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setOpenKey((k) => (k === d.key ? null : d.key))}
              data-testid={`agreement-open-${d.key}`}
            >
              <span className="text-body-sm font-semibold text-ink">《{d.title}》</span>
              <span className="text-caption text-ink-placeholder">{openKey === d.key ? '收起' : d.version}</span>
            </button>
            {openKey === d.key ? (
              <div className="mt-2 border-t border-line pt-2.5" data-testid={`agreement-body-${d.key}`}>
                {d.body.map((line) => (
                  <p key={line.slice(0, 8)} className="mt-1.5 text-caption leading-relaxed text-ink-secondary">
                    {line}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        <p className="mt-3 text-caption text-ink-placeholder">
          内测期简版协议，正式条款以上线版本与门店公示为准。
        </p>
      </section>
    </div>
  );
}
