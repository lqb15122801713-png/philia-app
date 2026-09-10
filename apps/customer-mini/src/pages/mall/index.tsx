import { useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { trpcQuery } from '../../lib/trpc';
import { assetUrl, fenToYuan } from '../../lib/config';

type Products = Awaited<ReturnType<typeof loadProducts>>['items'];
type Stores = Awaited<ReturnType<typeof loadStores>>['stores'];

async function loadProducts() {
  return trpcQuery('mall', 'listProducts', { page: 1, pageSize: 50 });
}
async function loadStores() {
  return trpcQuery('store', 'listNearby');
}

/**
 * 商城（批次 7.1 任务 C · 只读真实数据）
 * mall.listProducts 双列卡（图/名/价/店名——店名经 store.listNearby 映射，口径同 PWA MallPage）；
 * 点卡片 → 商品详情（只读）。购物车/结算为批次 7.3 范围。
 */
export default function MallPage() {
  const [items, setItems] = useState<Products>([]);
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');

  useDidShow(() => {
    loadProducts()
      .then((d) => setItems(d.items))
      .catch((e) => setErr(e instanceof Error ? e.message : '数据加载失败'));
    loadStores()
      .then((d) => setStoreNames(Object.fromEntries(d.stores.map((s) => [s.id, s.name]))))
      .catch(() => undefined);
  });

  return (
    <View className="min-h-screen bg-canvas px-4 pt-4">
      <Text className="block text-title text-ink">商城</Text>
      <View className="mt-3 flex flex-row flex-wrap justify-between">
        {items.map((p) => {
          const firstImg = Array.isArray(p.images) ? (p.images[0] as string | undefined) : undefined;
          return (
            <View
              key={p.id}
              className="mb-3 w-[48%] overflow-hidden rounded-card bg-card shadow-card"
              onClick={() => Taro.navigateTo({ url: `/pages/product/index?id=${p.id}` })}
            >
              {firstImg ? (
                <Image className="h-28 w-full bg-oak-light" src={assetUrl(firstImg)} mode="aspectFill" />
              ) : (
                <View className="flex h-28 w-full items-center justify-center bg-oak-light">
                  <Text className="text-caption text-ink-secondary">{p.category}</Text>
                </View>
              )}
              <View className="p-3">
                <Text className="block truncate text-body font-semibold text-ink">{p.name}</Text>
                <Text className="mt-1 block truncate text-caption text-ink-secondary">
                  {storeNames[p.storeId] ?? ''}
                </Text>
                <Text className="mt-1 block font-number text-price text-ink">¥{fenToYuan(p.priceFen)}</Text>
              </View>
            </View>
          );
        })}
      </View>
      {items.length === 0 && !err ? (
        <Text className="mt-4 block text-body text-ink-secondary">暂无在售商品</Text>
      ) : null}
      {err ? <Text className="mt-4 block text-center text-body text-danger">{err}</Text> : null}
      <View className="h-6" />
    </View>
  );
}
