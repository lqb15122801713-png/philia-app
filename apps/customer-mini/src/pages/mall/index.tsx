import { View, Text } from '@tarojs/components';

/**
 * 商城骨架（批次 7.1 任务 A 占位；任务 C 接商品详情浏览，购物车/结算为批次 7.3 范围）
 */
export default function MallPage() {
  return (
    <View className="min-h-screen bg-canvas px-4 pt-4">
      <View className="rounded-card bg-card p-4 shadow-card">
        <Text className="block text-title text-ink">商城</Text>
        <Text className="mt-2 block text-body text-ink-secondary">任务 C 接入商品浏览真实数据</Text>
      </View>
    </View>
  );
}
