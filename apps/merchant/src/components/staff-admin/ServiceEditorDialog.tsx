/**
 * 服务项新增/编辑弹层（T4.3 · SettingsPage）
 *
 * 保存 → store.upsertService（merchant 本店；id 存在为编辑，否则新增）。
 * 服务端约束：type ∈ grooming/boarding；boardingRoomType 仅寄养类可设；
 * priceFen 为非负整数（分）；durationMin 正整数（分钟，可空）。
 * UI 口径：价格按「元」输入（两位小数 → 分）；洗护类时长必填，寄养类按晚计费可空。
 */

import { usePhiliaClient } from '@philia/shared';
import { useEffect, useState } from 'react';
import { errMsg } from './format';
import type { ServiceRow } from './types';
import { Btn, Field, inputCls, Modal, Switch, toast } from './ui';

export default function ServiceEditorDialog({
  service,
  open,
  onClose,
  onSaved,
}: {
  /** null = 新增；否则编辑该服务项 */
  service: ServiceRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: (service: ServiceRow, created: boolean) => void;
}) {
  const { trpc } = usePhiliaClient();
  const [type, setType] = useState<'grooming' | 'boarding'>('grooming');
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [priceYuan, setPriceYuan] = useState('');
  const [roomType, setRoomType] = useState('');
  const [active, setActive] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setType(service?.type === 'boarding' ? 'boarding' : 'grooming');
    setName(service?.name ?? '');
    setDuration(service?.durationMin != null ? String(service.durationMin) : '');
    setPriceYuan(service ? (service.priceFen / 100).toFixed(2) : '');
    setRoomType(service?.boardingRoomType ?? '');
    setActive(service?.active ?? true);
    setPending(false);
    setError(null);
  }, [open, service]);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('请填写服务名称');
      return;
    }
    const price = Number(priceYuan);
    if (!priceYuan || Number.isNaN(price) || price < 0) {
      setError('请填写正确的价格（元，不能为负）');
      return;
    }
    const priceFen = Math.round(price * 100);
    let durationMin: number | undefined;
    if (type === 'grooming') {
      const d = Number(duration);
      if (!duration || !Number.isInteger(d) || d <= 0) {
        setError('洗护类服务请填写时长（分钟，正整数）');
        return;
      }
      durationMin = d;
    } else if (duration) {
      const d = Number(duration);
      if (!Number.isInteger(d) || d <= 0) {
        setError('时长须为正整数分钟（寄养按晚计费可不填）');
        return;
      }
      durationMin = d;
    }
    if (type === 'boarding' && !roomType.trim()) {
      setError('寄养类服务请填写房型（如：标准间 / 豪华间）');
      return;
    }

    setError(null);
    setPending(true);
    try {
      const r = await trpc.store.upsertService.mutate({
        id: service?.id,
        type,
        name: trimmed,
        durationMin,
        priceFen,
        boardingRoomType: type === 'boarding' ? roomType.trim() : undefined,
        active,
      });
      toast(r.created ? `已新增服务「${trimmed}」` : `已保存服务「${trimmed}」`);
      onSaved(r.service as ServiceRow, r.created);
      onClose();
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={service ? `编辑服务 · ${service.name}` : '新增服务项'}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>
            取消
          </Btn>
          <Btn variant="primary" onClick={() => void save()} disabled={pending}>
            {pending ? '保存中…' : '保存'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="服务大类">
          <div className="flex gap-2">
            {(
              [
                ['grooming', '洗护美容'],
                ['boarding', '寄养'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setType(v)}
                className={`rounded-full px-4 py-1.5 text-body transition-colors ${
                  type === v
                    ? 'bg-brand-primary text-white'
                    : 'border border-line-strong bg-card text-ink-secondary hover:bg-sunken'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="服务名称">
          <input
            className={inputCls}
            value={name}
            maxLength={64}
            placeholder={type === 'boarding' ? '如：寄养（标准间）/晚' : '如：基础洗护'}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="时长（分钟）"
            hint={type === 'boarding' ? '寄养按晚计费可不填' : undefined}
          >
            <input
              className={inputCls}
              value={duration}
              inputMode="numeric"
              placeholder={type === 'boarding' ? '可不填' : '如：90'}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Field>
          <Field label="价格（元）">
            <input
              className={inputCls}
              value={priceYuan}
              inputMode="decimal"
              placeholder="如：128.00"
              onChange={(e) => setPriceYuan(e.target.value)}
            />
          </Field>
        </div>
        {type === 'boarding' ? (
          <Field label="寄养房型" hint="如：标准间 / 豪华间 / 猫别墅">
            <input
              className={inputCls}
              value={roomType}
              maxLength={32}
              placeholder="标准间"
              onChange={(e) => setRoomType(e.target.value)}
            />
          </Field>
        ) : null}
        <div className="flex items-center justify-between rounded-input bg-sunken px-3 py-2">
          <span className="text-body text-ink">上架状态</span>
          <span className="flex items-center gap-2 text-caption text-ink-secondary">
            {active ? '已上架（客户可约）' : '已下架（客户不可见）'}
            <Switch checked={active} onChange={setActive} label="上架状态" />
          </span>
        </div>
        {error ? <p className="text-caption text-danger-deep">{error}</p> : null}
      </div>
    </Modal>
  );
}
