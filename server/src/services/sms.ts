/**
 * 短信通道抽象（批次 R13a 账号安全 · 内测模拟口径）
 *
 * - SmsProvider 接口：真实短信通道（阿里云/腾讯云 SMS）上线时新增实现替换
 *   `smsProvider` 即可，调用方（authSecurity.sendCode）零改动；验证码落库
 *   （verification_codes 表，哈希存储）由调用方负责，provider 只管送达。
 * - 当前唯一实现 MockSmsProvider：不发送真实短信；内测环境（NODE_ENV≠production，
 *   与 devLogin betaGate 同族判定）允许响应回显 devCode 供联调/e2e 断言，
 *   生产环境禁止回显（devEcho=false，sendCode 响应不含 devCode 字段）。
 */

export interface SmsProvider {
  /**
   * 发送验证码。返回 devEcho=true 表示内测环境允许响应回显明文码；
   * 生产实现必须返回 false。
   */
  send(phone: string, purpose: string, code: string): Promise<{ devEcho: boolean }>;
}

/** 内测环境判定（与 devLogin betaGate 同族：非 production 即内测/开发） */
export function isBetaEnv(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** mock 实现：不落任何外部调用，仅按环境给出回显许可 */
class MockSmsProvider implements SmsProvider {
  async send(_phone: string, _purpose: string, _code: string): Promise<{ devEcho: boolean }> {
    return { devEcho: isBetaEnv() };
  }
}

/** 当前生效 provider（生产替换点：改为真实 SMS 实现并保证 devEcho=false） */
export const smsProvider: SmsProvider = new MockSmsProvider();
