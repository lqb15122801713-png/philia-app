import { useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import { Button } from '@nutui/nutui-react-taro';
import Taro from '@tarojs/taro';
import { devLogin, fetchSeedUsers, loginWechatMini, type SeedUser } from '../../lib/auth';
import { ApiError } from '../../lib/request';

/**
 * 登录页（批次 7.1 任务 B）
 * - weapp：「微信一键登录」→ wx.login(jsCode) → /api/auth/wechat-mini → 进首页。
 *   授权口径按现行规范：仅静默换 jsCode，不强制头像昵称授权；
 * - H5 降级：内测期走现有 dev-login（种子用户 + BETA_GATE_CODE 口令门）。
 */

const IS_WEAPP = process.env.TARO_ENV === 'weapp';

export default function LoginPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // H5 dev-login 降级状态
  const [seedUsers, setSeedUsers] = useState<SeedUser[] | null>(null);
  const [gateCode, setGateCode] = useState('');
  const [needGate, setNeedGate] = useState(false);

  const goHome = () => Taro.switchTab({ url: '/pages/home/index' });

  const onWechatLogin = async () => {
    setBusy(true);
    setErr('');
    try {
      await loginWechatMini();
      goHome();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '登录失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  const loadSeedUsers = async (code?: string) => {
    setBusy(true);
    setErr('');
    try {
      setSeedUsers(await fetchSeedUsers(code));
      setNeedGate(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // BETA_GATE_REQUIRED：显示口令输入框
        setNeedGate(true);
      } else {
        setErr(e instanceof Error ? e.message : '种子用户拉取失败');
      }
    } finally {
      setBusy(false);
    }
  };

  const onDevLogin = async (userId: string) => {
    setBusy(true);
    setErr('');
    try {
      await devLogin(userId, gateCode || undefined);
      goHome();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setNeedGate(true);
        setErr(e.message);
      } else {
        setErr(e instanceof Error ? e.message : '登录失败，请重试');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="min-h-screen bg-canvas px-6 pt-16">
      <View className="flex flex-col items-center">
        <View className="flex h-20 w-20 items-center justify-center rounded-card bg-philia-gradient shadow-philia">
          <Text className="font-display text-title-lg text-ink">P</Text>
        </View>
        <Text className="mt-4 block font-display text-title-lg text-ink">菲丽亚宠物 Philia</Text>
        <Text className="mt-1 block text-body text-ink-secondary">给毛孩子一个温柔的家</Text>
      </View>

      {IS_WEAPP ? (
        <View className="mt-12">
          <Button type="primary" block loading={busy} onClick={onWechatLogin}>
            微信一键登录
          </Button>
          <Text className="mt-3 block text-center text-caption text-ink-placeholder">
            登录即代表同意《用户协议》与《隐私政策》；不强制授权头像昵称
          </Text>
        </View>
      ) : (
        <View className="mt-10">
          <Text className="block text-body text-ink-secondary">H5 内测降级：dev-login（带口令门）</Text>
          {seedUsers === null ? (
            <View className="mt-4">
              {needGate ? (
                <View className="mb-3 rounded-input bg-card px-3 py-2">
                  <Input
                    className="text-body text-ink"
                    placeholder="内测口令（BETA_GATE_CODE）"
                    password
                    value={gateCode}
                    onInput={(e) => setGateCode(e.detail.value)}
                  />
                </View>
              ) : null}
              <Button type="primary" block loading={busy} onClick={() => loadSeedUsers(gateCode || undefined)}>
                {needGate ? '带口令加载种子用户' : '加载种子用户'}
              </Button>
            </View>
          ) : (
            <View className="mt-4 flex flex-col gap-3">
              {seedUsers.map((u) => (
                <Button key={u.id} block loading={busy} onClick={() => onDevLogin(u.id)}>
                  {u.nickname ?? u.id}（{u.roles.join('/')}）
                </Button>
              ))}
            </View>
          )}
        </View>
      )}

      {err ? <Text className="mt-4 block text-center text-body text-danger">{err}</Text> : null}
    </View>
  );
}
