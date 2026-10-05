import { useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import { useDidShow, useRouter } from '@tarojs/taro';
import { trpcQuery } from '../../lib/trpc';
import { assetUrl, fenToYuan } from '../../lib/config';

type Detail = Awaited<ReturnType<typeof load>>;
async function load(productId: string) {
  return trpcQuery('mall', 'getProduct', { productId });
}

/**
 * 商品详情（批次 7.1 任务 C · 只读真实数据）
 * mall.getProduct：图/名/价/描述/库存/店名。不下单、不支付（购物车/结算为批次 7.3）。
 */
export default function ProductPage() {
  const router = useRouter();
  const productId = router.params.id ?? '';
  const [data, setData] = useState<Detail | null>(null);
  const [err, setErr] = useState('');

  useDidShow(() => {
    if (!productId) {
      setErr('缺少商品 id');
      return;
    }
    load(productId)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : '数据加载失败'));
  });

  const p = data?.product;
  const images = p && Array.isArray(p.images) ? (p.images as string[]) : [];

  return (
    <View className="min-h-screen bg-canvas">
      {p ? (
        <>
          {images.length > 0 ? (
            <Image className="h-64 w-full bg-oak-light" src={assetUrl(images[0])} mode="aspectFill" />
          ) : (
            <View className="flex h-64 w-full items-center justify-center bg-oak-light">
              <Text className="text-body text-ink-secondary">{p.category}</Text>
            </View>
          )}
          <View className="mt-[-16px] rounded-t-sheet bg-card p-4 shadow-card">
            <Text className="block text-title-lg text-ink">{p.name}</Text>
            <Text className="mt-1 block text-caption text-ink-secondary">
              {data?.storeName ?? ''} · {p.category}
            </Text>
            <View className="mt-2 flex flex-row items-baseline justify-between">
              <Text className="font-number text-price text-ink">¥{fenToYuan(p.priceFen)}</Text>
              <Text className="text-caption text-ink-secondary">库存 {p.stock}</Text>
            </View>
            {p.description ? (
              <Text className="mt-3 block text-body text-ink-secondary">{p.description}</Text>
            ) : null}
            <View className="mt-5">
              <Button type="primary" block disabled>
                立即购买（7.3 开放）
              </Button>
            </View>
          </View>
        </>
      ) : (
        <Text className="block pt-10 text-center text-body text-ink-secondary">{err || '加载中…'}</Text>
      )}
      <View className="h-6" />
    </View>
  );
}
