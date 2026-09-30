/**
 * 换皮批片 5：已归并 ../StaffPicker（单组件 + variant），本文件为转发层，
 * 既有调用点（GroomingSinglePage）零改动——固定 variant='flat'（定稿 B-01
 * gr-rail 皮：随缘派单末卡 + 最早可约时刻）。
 */

import StaffPicker, { type StaffPickerProps } from '../StaffPicker';

export default function StaffPickerFlat(props: Omit<StaffPickerProps, 'variant'>) {
  return <StaffPicker {...props} variant="flat" />;
}
