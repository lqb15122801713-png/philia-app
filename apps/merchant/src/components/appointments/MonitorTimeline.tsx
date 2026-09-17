/**
 * 单约监控 · 六步进度（U3 任务 N · 规格书 §13 · 母本 754-814 行右栏）。
 *
 * 由 T4.2 的「共享 StepTimeline 视觉 + 行内打标钮」改为 U3 本地档 u3-stepv
 * 竖向步进（index.css 同义类：薄荷 done 圆点 / 柠檬 now 圆点 / 墨灰未到描边点，
 * 2px 墨灰连接线），行内容：
 * - done：HH:MM · N 张；
 * - now：进行中 · X/Y 张（Y=maxPhotos，confirm 步 0-0 不显示张数）；
 * - 未到：「未到」；confirm 步补「完成后家长收到通知」；
 * - 已打标：红字小行「已打标，等待重拍」（旧照已作废，等员工重拍）。
 *
 * 打标重拍从行内钮移往右栏「快捷操作」（规格书 §13），本组件导出
 * pickFlaggableStep 供页面选出可打标步骤——规则 5 镜像与 T4.2 一致：
 * 当前 active 步；或 step_order 最大的 done 步且其后全部 locked、当前无 active 步。
 */

import { getStepDef } from '@philia/shared';
import { fmtTime } from './appt-utils';
import type { StepListItem } from './appt-utils';

/** 规则 5 镜像：选出当前唯一可打标重拍的步骤；无可打标步返回 null */
export function pickFlaggableStep(steps: StepListItem[]): StepListItem | null {
  const active = steps.find((s) => s.status === 'active');
  if (active) return active;
  const doneSteps = steps.filter((s) => s.status === 'done');
  const latestDone = doneSteps[doneSteps.length - 1] ?? null;
  if (!latestDone) return null;
  const restLocked = steps
    .filter((x) => x.stepOrder > latestDone.stepOrder)
    .every((x) => x.status === 'locked');
  return restLocked ? latestDone : null;
}

/** 行副行文案（时间戳 + 张数 + 状态提示） */
function subLine(step: StepListItem): string {
  const photoCount = step.photos.length;
  if (step.status === 'done') {
    const time = step.doneAt ? `${fmtTime(step.doneAt)} · ` : '';
    return `${time}${photoCount} 张`;
  }
  if (step.status === 'active') {
    const max = getStepDef(step.stepKey)?.maxPhotos;
    return max && max > 0 ? `进行中 · ${photoCount}/${max} 张` : '进行中';
  }
  return step.stepKey === 'confirm' ? '未到 · 完成后家长收到通知' : '未到';
}

export function MonitorTimeline({ steps }: { steps: StepListItem[] }) {
  return (
    <div className="u3-stepv px-[17px] pb-[14px] pt-1">
      {steps.map((step) => {
        const rowCls = step.status === 'done' ? 'done' : step.status === 'active' ? 'now' : '';
        const name = getStepDef(step.stepKey)?.name ?? step.stepKey;
        return (
          <div key={step.id} className={`row ${rowCls}`}>
            <i className="dt" />
            <div className="tx">
              <b>{name}</b>
              <small>{subLine(step)}</small>
              {step.flagged ? (
                <small className="font-semibold text-[#D92D20]">已打标，等待重拍</small>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
