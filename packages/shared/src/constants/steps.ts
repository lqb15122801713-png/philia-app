/**
 * 菲丽亚宠物 Philia · 六步服务流程常量
 *
 * 一次洗护服务的标准流程定义，客户/商家/员工三端共用：
 * - 客户端 / 商家端 live 页用 StepTimeline 展示进度；
 * - 员工端执行页按 minPhotos / maxPhotos 校验每步上传照片数量。
 *
 * stepKey 为稳定标识（接口与数据库存储用），name 为展示名。
 * minPhotos/maxPhotos：该步骤要求的照片数量区间（before_after 固定 2 张：服务前 + 服务后；
 * confirm 不需要照片，为 0-0）。
 */

/** 六步流程的稳定 key 联合类型。 */
export type ServiceStepKey =
  | 'disinfection'
  | 'precheck'
  | 'grooming'
  | 'detail'
  | 'before_after'
  | 'confirm';

export interface ServiceStepDef {
  /** 稳定标识，接口 / 数据库存储用。 */
  stepKey: ServiceStepKey;
  /** 流程顺序（1-6）。 */
  stepOrder: number;
  /** 展示名。 */
  name: string;
  /** 该步骤最少照片数。 */
  minPhotos: number;
  /** 该步骤最多照片数。 */
  maxPhotos: number;
}

/** 六步服务流程定义（锁定顺序，不可乱序渲染）。 */
export const SERVICE_STEPS: readonly ServiceStepDef[] = [
  { stepKey: 'disinfection', stepOrder: 1, name: '消毒工具确认', minPhotos: 1, maxPhotos: 3 },
  { stepKey: 'precheck', stepOrder: 2, name: '预检', minPhotos: 2, maxPhotos: 6 },
  { stepKey: 'grooming', stepOrder: 3, name: '洗澡美容', minPhotos: 3, maxPhotos: 9 },
  { stepKey: 'detail', stepOrder: 4, name: '细节对比照', minPhotos: 2, maxPhotos: 6 },
  { stepKey: 'before_after', stepOrder: 5, name: '前后对比照', minPhotos: 2, maxPhotos: 2 },
  { stepKey: 'confirm', stepOrder: 6, name: '完成确认', minPhotos: 0, maxPhotos: 0 },
] as const;

/** 按 stepKey 查找步骤定义；未命中返回 undefined。 */
export function getStepDef(stepKey: string): ServiceStepDef | undefined {
  return SERVICE_STEPS.find((s) => s.stepKey === stepKey);
}

/** 步骤节点状态：done 已完成 / active 进行中 / locked 未到达。 */
export type ServiceStepStatus = 'done' | 'active' | 'locked';
