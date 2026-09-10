import { View, Text } from '@tarojs/components';

/**
 * 首页骨架（批次 7.1 任务 A 占位；任务 C 接附近好店 + 推荐服务真实数据）
 * 色值全部走 VI token 类名（bg-canvas / text-ink / bg-philia-gradient 等）。
 */
export default function HomePage() {
  return (
    <View className="min-h-screen bg-canvas px-4 pt-4">
      <View className="rounded-card bg-philia-gradient p-5 shadow-philia">
        <Text className="block font-display text-title-lg text-ink">菲丽亚宠物 Philia</Text>
        <Text className="mt-1 block text-body text-ink">给毛孩子一个温柔的家</Text>
      </View>
      <View className="mt-4 rounded-card bg-card p-4 shadow-card">
        <Text className="block text-title text-ink">附近好店</Text>
        <Text className="mt-2 block text-body text-ink-secondary">任务 C 接入真实数据</Text>
      </View>
      <View className="mt-4 rounded-card bg-card p-4 shadow-card">
        <Text className="block text-title text-ink">推荐服务</Text>
        <Text className="mt-2 block text-body text-ink-secondary">任务 C 接入真实数据</Text>
      </View>
    </View>
  );
}
