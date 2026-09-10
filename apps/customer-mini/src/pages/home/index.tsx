import { useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { trpcQuery } from '../../lib/trpc';
import { fenToYuan } from '../../lib/config';

type NearbyData = Awaited<ReturnType<typeof loadNearby>>;
type StoreItem = NearbyData['stores'][number];
type ServiceItem = Awaited<ReturnType<typeof loadServices>>['services'][number];

async function loadNearby() {
  return trpcQuery('store', 'listNearby');
}
async function loadServices(storeId: string) {
  return trpcQuery('store', 'getWithServices', { storeId });
}

/**
 * 首页（批次 7.1 任务 C · 只读真实数据，tRPC 直连）
 * - 附近好店：store.listNearby（geo 粗排前 20，仅 active）；
 * - 推荐服务横滑：最近门店 store.getWithServices 的 active 服务项（口径同 PWA HomePage）。
 * 不下单、不支付；点门店/服务卡 → 门店详情（只读）。
 */
export default function HomePage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [err, setErr] = useState('');

  useDidShow(() => {
    setErr('');
    loadNearby()
      .then(async (data) => {
        setStores(data.stores);
        const first = data.stores[0];
        if (first) {
          const detail = await loadServices(first.id);
          setServices(detail.services);
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : '数据加载失败'));
  });

  const goStore = (id: string) => Taro.navigateTo({ url: `/pages/store/index?id=${id}` });

  return (
    <View className="min-h-screen bg-canvas">
      <View className="px-4 pt-4">
        <View className="rounded-card bg-philia-gradient p-5 shadow-philia">
          <Text className="block font-display text-title-lg text-ink">菲丽亚宠物 Philia</Text>
          <Text className="mt-1 block text-body text-ink">给毛孩子一个温柔的家</Text>
        </View>
      </View>

      <View className="mt-4 px-4">
        <Text className="block text-title text-ink">附近好店</Text>
        <View className="mt-2 flex flex-col gap-3">
          {stores.map((s) => (
            <View key={s.id} className="rounded-card bg-card p-4 shadow-card" onClick={() => goStore(s.id)}>
              <Text className="block text-body-lg font-semibold text-ink">{s.name}</Text>
              {s.address ? (
                <Text className="mt-1 block text-caption text-ink-secondary">{s.address}</Text>
              ) : null}
              <Text className="mt-2 block text-caption text-brand-primary-pressed">查看门店与服务 ›</Text>
            </View>
          ))}
          {stores.length === 0 && !err ? (
            <Text className="block text-body text-ink-secondary">附近暂无门店</Text>
          ) : null}
        </View>
      </View>

      <View className="mt-5">
        <Text className="block px-4 text-title text-ink">推荐服务</Text>
        <ScrollView scrollX className="mt-2 whitespace-nowrap" enhanced showScrollbar={false}>
          <View className="flex flex-row gap-3 px-4">
            {services.map((sv) => (
              <View
                key={sv.id}
                className="inline-block w-40 shrink-0 rounded-card bg-card p-4 shadow-card"
                onClick={() => goStore(sv.storeId)}
              >
                <Text className="block truncate text-body font-semibold text-ink">{sv.name}</Text>
                <Text className="mt-1 block text-caption text-ink-secondary">
                  {sv.type === 'boarding' ? '寄养' : '洗护'}
                  {sv.durationMin ? ` · ${sv.durationMin} 分钟` : ''}
                </Text>
                <Text className="mt-2 block font-number text-price text-ink">¥{fenToYuan(sv.priceFen)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {err ? <Text className="mt-4 block px-4 text-center text-body text-danger">{err}</Text> : null}
      <View className="h-6" />
    </View>
  );
}
