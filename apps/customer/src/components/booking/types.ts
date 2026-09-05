/**
 * 预约域共享类型（T2.2）——从 tRPC 客户端推导，端到端类型不手写。
 *
 * 用法：页面/组件经 usePhiliaClient() 拿 trpc 实例取数；
 * 这里只导出「返回体形状」类型别名，供组件 props 标注。
 */

import type { PhiliaClient } from '@philia/shared';

type Trpc = PhiliaClient['trpc'];

/** store.listNearby 门店项 */
export type StoreItem = Awaited<ReturnType<Trpc['store']['listNearby']['query']>>['stores'][number];

/** store.getWithServices 返回体（store + services + slots） */
export type StoreServices = Awaited<ReturnType<Trpc['store']['getWithServices']['query']>>;
export type StoreWithHours = StoreServices['store'];
export type ServiceItem = StoreServices['services'][number];
export type SlotItem = StoreServices['slots'][number];

/** store.listStaffPublic 员工项（id/name/skills） */
export type StaffPublic = Awaited<ReturnType<Trpc['store']['listStaffPublic']['query']>>['staff'][number];

/** pet.list 宠物项 */
export type PetItem = Awaited<ReturnType<Trpc['pet']['list']['query']>>[number];

/** appointment.listMine 分组与列表项 */
export type AppointmentGroups = Awaited<ReturnType<Trpc['appointment']['listMine']['query']>>['groups'];
export type AppointmentStatus = keyof AppointmentGroups;
export type AppointmentListItem = AppointmentGroups[AppointmentStatus][number];

/** appointment.get 详情返回体 */
export type AppointmentDetail = Awaited<ReturnType<Trpc['appointment']['get']['query']>>;

/** appointment.create 入参 */
export type AppointmentCreateInput = Parameters<Trpc['appointment']['create']['mutate']>[0];

/** 预约码（getCode 返回体） */
export type BookingCodeResult = Awaited<ReturnType<Trpc['appointment']['getCode']['query']>>;
