/**
 * 支付通道端口内核（产品-1010 线上支付批片 1 · A 股件 ②③ · ConsolePage E3 直嵌件）
 *
 * 高危件三件套（令书口径）：
 * - 口令复核：保存走 D 套弹层，键入「确认变更支付通道」——server 硬闸同句校验
 *   （payChannel.save；闸句硬编码不走 copy 端口键：防端口改文案造成闸句不一致）；
 * - 留痕：server 版本化写行+rule_config_versions（changesJson 全掩码）；本页透出最近变更人/时刻；
 * - 密钥永不明文回显：读出=掩码镜像（****+末 4 位）；编辑框留空=该位不变（部分更新），
 *   掩码值拒回存（server zod refine 同口径）。
 *
 * 切换闸（件 ③）：四通道单选（mock=默认/内测；wechat_jsapi/wechat_h5/alipay_wap=留口未接真钱——
 * 切真通道后新单下单会透出「通道未开通」明文拒单，任务书边界：本批不接真钱）；
 * kill switch 开=瞬时回落 mock 安全值（横幅显著提示）。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { errMsg, fmtDateTime } from '../components/staff-admin/format';
import { Badge, Btn, Field, Modal, inputCls, toast, ToasterMount } from '../components/staff-admin/ui';

type ChannelKey = 'mock' | 'wechat_jsapi' | 'wechat_h5' | 'alipay_wap';

/** 口令复核句：与 server 硬闸同句（server/src/routers/payChannel.ts PAY_CHANNEL_CONFIRM_PHRASE） */
const CONFIRM_PHRASE = '确认变更支付通道';

const CHANNELS: Array<{ key: ChannelKey; label: string; desc: string }> = [
  { key: 'mock', label: 'Mock 演示通道', desc: '内测/演示用，不接真钱；四态可演（成功/失败/超时/掉单）' },
  { key: 'wechat_jsapi', label: '微信 · JSAPI（公众号内）', desc: '留口未接真钱：凭据四件（AppID/商户号/证书序列号/APIv3 密钥）' },
  { key: 'wechat_h5', label: '微信 · H5（浏览器拉起）', desc: '留口未接真钱：与 JSAPI 共用凭据四件' },
  { key: 'alipay_wap', label: '支付宝 · 手机网站', desc: '留口未接真钱：凭据三件（AppID/应用私钥/支付宝公钥）' },
];

const CHANNEL_LABEL: Record<ChannelKey, string> = Object.fromEntries(CHANNELS.map((c) => [c.key, c.label])) as Record<
  ChannelKey,
  string
>;

/** 微信凭据四位 / 支付宝凭据三位（key=server 凭据字段名） */
const WECHAT_FIELDS = [
  { key: 'appid', label: '微信 AppID' },
  { key: 'mchid', label: '微信商户号（mchid）' },
  { key: 'serial', label: '商户 API 证书序列号' },
  { key: 'apiV3Key', label: 'APIv3 密钥' },
] as const;
const ALIPAY_FIELDS = [
  { key: 'appid', label: '支付宝 AppID' },
  { key: 'privateKey', label: '应用私钥（RSA2）' },
  { key: 'publicKey', label: '支付宝公钥' },
] as const;

export function PayChannelPortBody() {
  const { trpc, queryClient } = usePhiliaClient();
  const getQ = useQuery({ queryKey: ['payChannel', 'get'], queryFn: () => trpc.payChannel.get.query(), retry: 1 });

  const [selected, setSelected] = useState<ChannelKey | null>(null);
  const [wechatInput, setWechatInput] = useState<Record<string, string>>({});
  const [alipayInput, setAlipayInput] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [saving, setSaving] = useState(false);

  if (getQ.isPending) return <Skeleton className="h-40" />;
  if (getQ.isError || !getQ.data) {
    return <p className="text-caption text-danger-deep">读取失败：{errMsg(getQ.error)}（仅店主可见本端口）</p>;
  }
  const data = getQ.data;
  const current: ChannelKey = data.portProvider ?? 'mock'; // null=未配置走 env 兜底（内测=mock）
  const sel = selected ?? current;

  const selIsWechat = sel === 'wechat_jsapi' || sel === 'wechat_h5';
  const credMask = selIsWechat ? data.credentials.wechat : sel === 'alipay_wap' ? data.credentials.alipay : null;
  const credFields = selIsWechat ? WECHAT_FIELDS : sel === 'alipay_wap' ? ALIPAY_FIELDS : [];
  const credInput = selIsWechat ? wechatInput : alipayInput;
  const setCredInput = selIsWechat ? setWechatInput : setAlipayInput;
  const credPatchCount = Object.values(credInput).filter((v) => v.trim()).length;
  const dirty = sel !== current || credPatchCount > 0;

  async function doSave() {
    setSaving(true);
    try {
      const input: {
        provider: ChannelKey;
        confirmPhrase: string;
        wechat?: { appid?: string; mchid?: string; serial?: string; apiV3Key?: string };
        alipay?: { appid?: string; privateKey?: string; publicKey?: string };
      } = { provider: sel, confirmPhrase: confirmText.trim() };
      if (credPatchCount > 0) {
        const patch = Object.fromEntries(
          Object.entries(credInput)
            .filter(([, v]) => v.trim())
            .map(([k, v]) => [k, v.trim()]),
        );
        if (selIsWechat) input.wechat = patch;
        else if (sel === 'alipay_wap') input.alipay = patch;
      }
      await trpc.payChannel.save.mutate(input);
      toast('已保存并生效（留痕已记，密钥掩码存档）');
      setConfirmOpen(false);
      setConfirmText('');
      setWechatInput({});
      setAlipayInput({});
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ['payChannel'] });
    } catch (e) {
      toast(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="pay-channel-port">
      <ToasterMount />

      {/* kill switch 回落提示（显著态：开=全部瞬时回落 mock 安全值） */}
      {data.killSwitchOn ? (
        <p className="rounded-input bg-danger-light px-3 py-2 text-caption text-danger-deep" data-testid="pay-channel-kill-banner">
          一键开关（kill switch）开：线上支付瞬时回落 Mock 演示通道（安全值）；本页切换在开关关闭后生效。
        </p>
      ) : null}

      {/* 当前生效 */}
      <div className="rounded-control bg-canvas px-3 py-2 text-caption text-ink" data-testid="pay-channel-current">
        当前通道：<span className="font-semibold">{CHANNEL_LABEL[current]}</span>
        {data.portProvider === null ? <Badge tone="muted">env 兜底（未在端口配置）</Badge> : null}
        {current !== 'mock' ? <Badge tone="warn">留口未接真钱</Badge> : null}
        {data.updatedAt ? (
          <span className="ml-2 text-caption-xs text-[rgba(59,46,36,.62)]">
            最近变更：{fmtDateTime(data.updatedAt)} {data.updatedBy ? `· ${data.updatedBy}` : ''}
          </span>
        ) : null}
      </div>

      {/* 通道单选（切换闸） */}
      <Field label="切换通道（保存即生效；新单走新通道，在途单不受影响）" hint="真通道=留口未接真钱：切换后新单下单将透出「通道未开通」明文拒单">
        <div className="space-y-2" data-testid="pay-channel-options">
          {CHANNELS.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-start gap-2 rounded-control bg-card px-3 py-2 ring-1 ring-line-ring">
              <input
                type="radio"
                name="pay-channel"
                className="mt-1"
                checked={sel === c.key}
                onChange={() => setSelected(c.key)}
                data-testid={`pay-channel-opt-${c.key}`}
              />
              <span>
                <span className="text-body text-ink">{c.label}</span>
                <span className="block text-caption-xs text-[rgba(59,46,36,.62)]">{c.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>

      {/* 凭据区（真通道选中时；留空=该位不变） */}
      {credFields.length > 0 ? (
        <Field label="通道凭据（高危件：读出恒掩码，留空=该位不变）" hint="密钥永不明文回显；保存后留痕同样掩码">
          <div className="space-y-2" data-testid="pay-channel-credentials">
            {credFields.map((f) => (
              <div key={f.key}>
                <div className="mb-1 text-caption-xs font-semibold text-[rgba(59,46,36,.62)]">{f.label}</div>
                <input
                  type="password"
                  className={inputCls}
                  placeholder={(credMask as Record<string, string | null> | null)?.[f.key] ?? '未配置'}
                  value={credInput[f.key] ?? ''}
                  onChange={(e) => setCredInput({ ...credInput, [f.key]: e.target.value })}
                  data-testid={`pay-channel-cred-${f.key}`}
                />
              </div>
            ))}
          </div>
        </Field>
      ) : null}

      <div className="flex items-center gap-2">
        <Btn
          variant="danger"
          disabled={!dirty}
          data-testid="pay-channel-save-open"
          onClick={() => {
            setConfirmText('');
            setConfirmOpen(true);
          }}
        >
          保存通道配置
        </Btn>
        <span className="text-caption-xs text-[rgba(59,46,36,.62)]">涉钱高危件：保存须口令复核</span>
      </div>

      {/* D 套口令复核弹层（变更摘要+键入口令） */}
      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!saving) setConfirmOpen(false);
        }}
        title="确认变更支付通道"
        widthClass="max-w-xl"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setConfirmOpen(false)} disabled={saving}>
              再想想
            </Btn>
            <Btn
              variant="danger"
              data-testid="pay-channel-confirm-submit"
              onClick={() => void doSave()}
              disabled={saving || confirmText.trim() !== CONFIRM_PHRASE}
            >
              {saving ? '保存中…' : '确认保存并生效'}
            </Btn>
          </>
        }
      >
        <div className="space-y-3" data-testid="pay-channel-confirm-modal">
          <p className="rounded-input bg-danger-light px-3 py-2 text-caption text-danger-deep">
            支付通道=涉钱高危件：切错通道=新单无法收款；凭据写错=真通道联调失败。请核对变更摘要。
          </p>
          <div className="rounded-control bg-canvas px-3 py-2 text-caption text-ink">
            <div>
              通道：{CHANNEL_LABEL[current]} → <span className="font-semibold">{CHANNEL_LABEL[sel]}</span>
            </div>
            <div className="mt-1 text-caption-xs text-[rgba(59,46,36,.62)]">
              凭据更新：{credPatchCount > 0 ? `${credPatchCount} 位（掩码留痕，真值不明文显示）` : '本次不变更凭据'}
            </div>
          </div>
          <Field label={`请输入「${CONFIRM_PHRASE}」以继续`} hint="防误触：口令与按钮双重确认（server 同句硬闸）">
            <input
              className={inputCls}
              data-testid="pay-channel-confirm-input"
              placeholder={CONFIRM_PHRASE}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={saving}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
