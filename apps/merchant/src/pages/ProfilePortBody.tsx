/**
 * 门店档案端口内核（商家端大批片 2 · E1 点亮 · ConsolePage 右栏 active==='profile' 嵌入件）。
 * 档案表单（name/address/phone/lat/lng/groupName + hqId 下拉 + openHours 只读展示，编辑走设置页原口）
 * + 连锁归属只读行（storeType/hqId/groupName 真值）；保存=store.update（连锁扩参已落地，真类型直连）。
 */

import { Skeleton, usePhiliaClient } from '@philia/shared';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { QuietButton } from '../components/MainScaffold';
import { openHoursLabel } from '../components/dashboard/utils';
import { errMsg } from '../components/staff-admin/format';
import { Field, inputCls, toast, ToasterMount } from '../components/staff-admin/ui';
import { cadm } from '../copy/consoleAdmin';

/** 只读行（.set-row 行式工艺：label 左 / 值右，墨 6% 顶线） */
function InfoRow({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-[rgba(59,46,36,.06)] py-[11px] text-caption first:border-t-0">
      <div className="min-w-0 flex-1 text-ink">{title}</div>
      <span className="shrink-0 font-bold text-[rgba(59,46,36,.62)]">{children ?? '—'}</span>
    </div>
  );
}

export function ProfilePortBody() {
  const { trpc, queryClient } = usePhiliaClient();

  const meQuery = useQuery({ queryKey: ['auth', 'me', 'full'], queryFn: () => trpc.auth.me.query() });
  const store = meQuery.data?.store ?? null;
  /* hqId 下拉店集合（listMine：owner=全域集合，选自身=店即己部单层特例） */
  const mineQuery = useQuery({
    queryKey: ['store', 'listMine'],
    queryFn: () => trpc.store.listMine.query(),
  });
  const mineStores = mineQuery.data?.stores ?? [];

  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    lat: '',
    lng: '',
    groupName: '',
    hqId: '',
  });
  const [saving, setSaving] = useState(false);

  // 门店行就绪时渲染期回填（react-hooks v6 口径：不在 effect 里同步 setState；照 SettingsPage 先例）
  const [backfilledFor, setBackfilledFor] = useState<string | null>(null);
  if (store && store.id !== backfilledFor) {
    setBackfilledFor(store.id);
    setForm({
      name: store.name ?? '',
      address: store.address ?? '',
      phone: store.phone ?? '',
      lat: store.lat != null ? String(store.lat) : '',
      lng: store.lng != null ? String(store.lng) : '',
      groupName: store.groupName ?? '',
      hqId: store.hqId ?? store.id,
    });
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast('门店名称不能为空', 'error');
      return;
    }
    let lat: number | null = null;
    let lng: number | null = null;
    if (form.lat.trim()) {
      lat = Number(form.lat);
      if (Number.isNaN(lat) || lat < -90 || lat > 90) {
        toast('纬度须为 -90 ~ 90 的数字', 'error');
        return;
      }
    }
    if (form.lng.trim()) {
      lng = Number(form.lng);
      if (Number.isNaN(lng) || lng < -180 || lng > 180) {
        toast('经度须为 -180 ~ 180 的数字', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      await trpc.store.update.mutate({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        lat,
        lng,
        groupName: form.groupName.trim() || null,
        hqId: form.hqId || undefined,
      });
      toast(cadm('cadm.profileSaved'));
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
      void queryClient.invalidateQueries({ queryKey: ['store', 'listMine'] });
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const hqName = (id: string | null | undefined): string => {
    if (!id) return '—';
    const hit = mineStores.find((s) => s.id === id);
    if (!hit) return id;
    return id === store?.id ? `${hit.name} · ${cadm('cadm.profileHqSelf')}` : hit.name;
  };

  return (
    <>
      <ToasterMount />
      <section className="wsk-card" data-testid="console-profile-port">
        <div className="wsk-hd">
          <span className="t">{cadm('cadm.profileEmptyTitle')}</span>
          <span className="a">{cadm('cadm.profileEmptyBody')}</span>
        </div>
        {meQuery.isPending ? (
          <div className="space-y-3" aria-label="加载中">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 rounded-control" />
            ))}
          </div>
        ) : !store ? (
          <p className="py-4 text-center text-caption-xs text-[rgba(59,46,36,.42)]">—</p>
        ) : (
          <div className="space-y-3">
            <Field label="门店名称">
              <input
                className={inputCls}
                value={form.name}
                maxLength={64}
                data-testid="profile-name"
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              />
            </Field>
            <Field label="门店地址">
              <input
                className={inputCls}
                value={form.address}
                maxLength={255}
                data-testid="profile-address"
                onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="联系电话">
                <input
                  className={inputCls}
                  value={form.phone}
                  maxLength={32}
                  data-testid="profile-phone"
                  onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                />
              </Field>
              <Field label="分组名" hint="连锁分栏分组锚，可留空">
                <input
                  className={inputCls}
                  value={form.groupName}
                  maxLength={32}
                  data-testid="profile-group"
                  onChange={(e) => setForm((s) => ({ ...s, groupName: e.target.value }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="纬度" hint="-90 ~ 90，可留空">
                <input
                  className={inputCls}
                  value={form.lat}
                  inputMode="decimal"
                  data-testid="profile-lat"
                  onChange={(e) => setForm((s) => ({ ...s, lat: e.target.value }))}
                />
              </Field>
              <Field label="经度" hint="-180 ~ 180，可留空">
                <input
                  className={inputCls}
                  value={form.lng}
                  inputMode="decimal"
                  data-testid="profile-lng"
                  onChange={(e) => setForm((s) => ({ ...s, lng: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="营业时间" hint="编辑走「设置」页原口（本口只读展示）">
              <div className="u1-num rounded-control bg-[rgba(59,46,36,.04)] px-3 py-2 text-caption text-[rgba(59,46,36,.62)]">
                {openHoursLabel(store.openHours, new Date())}
              </div>
            </Field>
            <Field label="归属总部" hint={`选自身=${cadm('cadm.profileHqSelf')}`}>
              <select
                className={inputCls}
                value={form.hqId}
                data-testid="profile-hq"
                onChange={(e) => setForm((s) => ({ ...s, hqId: e.target.value }))}
              >
                {mineStores.length === 0 ? (
                  <option value={store.id}>{store.name}</option>
                ) : (
                  mineStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.storeType === 'hq' ? '（总部）' : ''}
                      {s.id === store.id ? ` · ${cadm('cadm.profileHqSelf')}` : ''}
                    </option>
                  ))
                )}
              </select>
            </Field>
            <div className="flex justify-end pt-1">
              <QuietButton testid="profile-save" disabled={saving} onClick={() => void save()}>
                {saving ? '保存中…' : cadm('cadm.portProfileSave')}
              </QuietButton>
            </div>
          </div>
        )}
      </section>

      {/* 连锁归属只读行（storeType/hqId/groupName 真值透出） */}
      <section className="wsk-card" data-testid="console-profile-chain">
        <div className="wsk-hd">
          <span className="t">{cadm('cadm.profileChainTitle')}</span>
        </div>
        <InfoRow title="类型">{store ? (store.storeType === 'hq' ? '总部' : '门店') : '—'}</InfoRow>
        <InfoRow title="归属总部">{hqName(store?.hqId ?? store?.id)}</InfoRow>
        <InfoRow title="分组">{store?.groupName || '—'}</InfoRow>
      </section>
    </>
  );
}
