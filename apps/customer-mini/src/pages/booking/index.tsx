import { View, Text } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';

/**
 * 预约入口骨架（批次 7.1 任务 A 占位；单屏下单为批次 7.2 范围）
 */
export default function BookingPage() {
  return (
    <View className="min-h-screen bg-canvas px-4 pt-4">
      <View className="rounded-card bg-card p-4 shadow-card">
        <Text className="block text-title text-ink">预约服务</Text>
        <Text className="mt-2 block text-body text-ink-secondary">
          洗护美容 / 寄养酒店预约入口（下单链路为批次 7.2 范围，本批仅占位）
        </Text>
        <View className="mt-4">
          <Button type="primary" block disabled>
            敬请期待（7.2 开放）
          </Button>
        </View>
      </View>
    </View>
  );
}
