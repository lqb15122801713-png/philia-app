import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { useDidShow, useRouter } from '@tarojs/taro';
import { trpcQuery } from '../../lib/trpc';
import { fenToYuan } from '../../lib/config';

type Detail = Awaited<ReturnType<typeof load>>;
async function load(storeId: string) {
  return trpcQuery('store', 'getWithServices', { storeId });
}

const DAY_LABEL: Record<string, string> = {
  mon: '周一',
  tue: '周二',
  wed: '周三',
  thu: '周四',
  fri: '周五',
  sat: '周六',
  sun: '周日',
};

/**
 * 门店详情 + 服务项列表（批次 7.1 任务 C · 只读真实数据）
 * store.getWithServices：门店 + active 服务项 + 未来 7 天可约槽（此处只读展示数量，下单为 7.2）。
 */
export default function StorePage() {
  const router = useRouter();
  const storeId = router.params.id ?? '';
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState('');

  useDidShow(() => {
    if (!storeId) {
      setErr('缺少门店 id');
      return;
    }
    load(storeId)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : '数据加载失败'));
  });

  const store = data?.store;
  const openDays = store?.openHours
    ? Object.entries(store.openHours)
        .filter(([, v]) => v)
        .map(([k, v]) => `${DAY_LABEL[k] ?? k} ${v!.open}-${v!.close}`)
    : [];

  return (
    <View className="min-h-screen bg-canvas px-4 pt-4">
      {store ? (
        <>
          <View className="rounded-card bg-card p-4 shadow-card">
            <Text className="block text-title-lg text-ink">{store.name}</Text>
            {store.address ? (
              <Text className="mt-1 block text-body text-ink-secondary">{store.address}</Text>
            ) : null}
            {openDays.length > 0 ? (
              <Text className="mt-2 block text-caption text-ink-secondary">营业：{openDays.join(' · ')}</Text>
            ) : null}
            <Text className="mt-2 block text-caption text-success-deep">
              未来 7 天可约时段 {data?.slots.length ?? 0} 个（预约下单为批次 7.2 范围）
            </Text>
          </View>

          <Text className="mt-5 block text-title text-ink">服务项</Text>
          <View className="mt-2 flex flex-col gap-3">
            {(data?.services ?? []).map((sv) => (
              <View key={sv.id} className="flex flex-row items-center justify-between rounded-card bg-card p-4 shadow-card">
                <View className="flex-1">
                  <Text className="block text-body-lg font-semibold text-ink">{sv.name}</Text>
                  <Text className="mt-1 block text-caption text-ink-secondary">
                    {sv.type === 'boarding' ? '寄养' : '洗护'}
                    {sv.durationMin ? ` · ${sv.durationMin} 分钟` : ''}
                  </Text>
                </View>
                <Text className="font-number text-price text-ink">¥{fenToYuan(sv.priceFen)}</Text>
              </View>
            ))}
            {(data?.services ?? []).length === 0 ? (
              <Text className="block text-body text-ink-secondary">该店暂无上架服务</Text>
            ) : null}
          </View>
        </>
      ) : (
        <Text className="block pt-10 text-center text-body text-ink-secondary">{err || '加载中…'}</Text>
      )}
      {err && store ? <Text className="mt-4 block text-center text-body text-danger">{err}</Text> : null}
      <View className="h-6" />
    </View>
  );
}
