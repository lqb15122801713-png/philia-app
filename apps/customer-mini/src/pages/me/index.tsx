import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import Taro, { useDidShow } from '@tarojs/taro';
import { fetchMe, logout } from '../../lib/auth';

/**
 * 我的（批次 7.1 任务 B：登录态展示 + 退出；宠物档案/会员页为批次 7.3 范围）
 */
export default function MePage() {
  const [me, setMe] = useState<Awaited<ReturnType<typeof fetchMe>> | null>(null);
  const [err, setErr] = useState('');

  useDidShow(() => {
    fetchMe()
      .then((data) => setMe(data))
      .catch(() => setMe(null));
  });

  const onLogout = async () => {
    setErr('');
    try {
      await logout();
      Taro.reLaunch({ url: '/pages/login/index' });
    } catch (e) {
      setErr(e instanceof Error ? e.message : '退出失败');
    }
  };

  return (
    <View className="min-h-screen bg-canvas px-4 pt-4">
      {me ? (
        <>
          <View className="rounded-card bg-card p-4 shadow-card">
            <Text className="block text-title text-ink">{me.user.nickname ?? '菲丽亚用户'}</Text>
            <Text className="mt-1 block text-caption text-ink-secondary">
              ID：{me.user.id} · 角色：{me.roles.join(' / ') || 'customer'}
            </Text>
          </View>
          <View className="mt-4">
            <Button block onClick={onLogout}>
              退出登录
            </Button>
          </View>
        </>
      ) : (
        <View className="rounded-card bg-card p-4 shadow-card">
          <Text className="block text-title text-ink">未登录</Text>
          <Text className="mt-2 block text-body text-ink-secondary">登录后可查看我的预约与会员信息</Text>
          <View className="mt-4">
            <Button type="primary" block onClick={() => Taro.reLaunch({ url: '/pages/login/index' })}>
              去登录
            </Button>
          </View>
        </View>
      )}
      {err ? <Text className="mt-4 block text-center text-body text-danger">{err}</Text> : null}
    </View>
  );
}
