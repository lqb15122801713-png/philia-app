/**
 * 换皮批片 5：已归并 ../PetPicker（单组件 + variant），本文件为转发层，
 * 既有调用点（single/PetCardBlock）零改动——固定 variant='flat'（v4.1 减法皮）。
 */

import PetPicker, { type PetPickerProps } from '../PetPicker';

export default function PetPickerFlat(props: Omit<PetPickerProps, 'variant'>) {
  return <PetPicker {...props} variant="flat" />;
}
