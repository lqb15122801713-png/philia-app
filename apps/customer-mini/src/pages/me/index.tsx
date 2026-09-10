import { View, Text } from '@tarojs/components';

/**
 * 我的骨架（批次 7.1 任务 A 占位；任务 B 装配登录态展示/退出，宠物档案/会员页为批次 7.3 范围）
 */
export default function MePage() {
  return (
    <View className="min-h-screen bg-canvas px-4 pt-4">
      <View className="rounded-card bg-card p-4 shadow-card">
        <Text className="block text-title text-ink">我的</Text>
        <Text className="mt-2 block text-body text-ink-secondary">任务 B 接入微信登录态</Text>
      </View>
    </View>
  );
}
