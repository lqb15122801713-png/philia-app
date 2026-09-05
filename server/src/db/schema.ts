/**
 * 菲丽亚宠物 Philia —— 数据库 schema（开发方案第 5 章，共 18 张表）
 *
 * 全库统一约定：
 * - 引擎：嵌入式 SQLite（@libsql/client + drizzle-orm/libsql）；未来切 MySQL 只改
 *   dialect/连接，表结构语义保持不变。
 * - 主键：text ULID，应用层生成（ulid 包，见 $defaultFn）；event_outbox 用
 *   monotonicFactory 保证 id 单调递增（按 id 排序即按时间排序）。
 * - 枚举：SQLite 无原生 enum，统一 text 列 + 注释标明取值集合，应用层用 zod 约束。
 * - JSON：text 列（mode: 'json'）+ $type<T>() 提供 TS 类型，应用层 zod 校验结构。
 * - 金额：integer，单位「分」（fen），字段名统一 *_fen。
 * - 日期时间：integer（mode: 'timestamp'），Unix 秒级时间戳，默认 (unixepoch())；
 *   应用层读写均为 JS Date。纯日期字段（birthday / vaccine_valid_until / log_date）
 *   用 text，ISO 格式 'YYYY-MM-DD'。
 * - created_at / updated_at 全表必备；SQLite 无 ON UPDATE，updated_at 由应用层在
 *   更新时显式写入（此处仅给插入默认值）。
 * - SQLite 单写者模型下行锁天然安全；业务代码保留事务结构（db.transaction），
 *   未来换 MySQL 后语义直接成立。
 */

import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { monotonicFactory, ulid } from 'ulid';

/** event_outbox 专用：单调递增 ULID（同一进程内保证字典序=时间序） */
const monotonicUlid = monotonicFactory();

/* ------------------------------------------------------------------ */
/* 通用列与 JSON 类型                                                    */
/* ------------------------------------------------------------------ */

/** 主键：text ULID，应用层生成 */
const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => ulid());

/** 全表统一审计列（Unix 秒，JS Date 读写） */
const auditColumns = {
  /** 创建时间（Unix 秒） */
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  /** 更新时间（Unix 秒）；SQLite 无 ON UPDATE，由应用层更新时写入 */
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
};

/** 门店营业时间：{ mon: {open,close} | null, ..., sun: ... }，null 表示当日休息 */
export type StoreOpenHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', { open: string; close: string } | null>
>;

/** 员工排班：{ mon: [{start,end}], ... } */
export type StaffSchedule = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', Array<{ start: string; end: string }>>
>;

/** 寄养随身物品登记 */
export type Belongings = Array<{ name: string; note?: string }>;

/** 寄养每日餐饮记录 */
export type DailyMeals = Array<{ time: string; food: string; amount?: string; finished?: boolean }>;

/** 订单商品明细行 */
export type OrderItem = {
  product_id: string;
  name: string;
  quantity: number;
  price_fen: number;
};

/** 订单收货地址快照 */
export type OrderAddress = {
  receiver: string;
  phone: string;
  province?: string;
  city?: string;
  district?: string;
  detail: string;
};

/* ------------------------------------------------------------------ */
/* 5.1 账号 / 门店 / 员工                                              */
/* ------------------------------------------------------------------ */

/** 用户表（对接 Kimi 账号体系） */
export const users = sqliteTable('users', {
  id: id(),
  /** Kimi 账号 ID（全局唯一） */
  kimiId: text('kimi_id').notNull().unique(),
  /** 昵称 */
  nickname: text('nickname'),
  /** 头像 URL */
  avatarUrl: text('avatar_url'),
  /** 手机号 */
  phone: text('phone'),
  ...auditColumns,
});

/** 用户角色表（一个用户可有多个角色） */
export const userRoles = sqliteTable(
  'user_roles',
  {
    id: id(),
    /** 用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 角色，取值：customer | merchant_owner | merchant_manager | staff */
    role: text('role').notNull(),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_user_roles_user_role').on(t.userId, t.role)],
);

/** 门店表 */
export const stores = sqliteTable('stores', {
  id: id(),
  /** 店主用户 ID -> users.id */
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  /** 门店名称 */
  name: text('name').notNull(),
  /** 门店地址 */
  address: text('address'),
  /** 纬度 */
  lat: real('lat'),
  /** 经度 */
  lng: real('lng'),
  /** 营业时间 JSON，结构见 StoreOpenHours */
  openHours: text('open_hours', { mode: 'json' }).$type<StoreOpenHours>(),
  /** 门店状态，取值：active | closed */
  status: text('status').notNull().default('active'),
  ...auditColumns,
});

/** 员工表（店员与门店的绑定 + 技能/排班） */
export const staff = sqliteTable('staff', {
  id: id(),
  /** 所属门店 ID -> stores.id */
  storeId: text('store_id')
    .notNull()
    .references(() => stores.id),
  /** 员工用户 ID -> users.id（一个用户在同系统内只做一条 staff 记录） */
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  /** 员工姓名 */
  name: text('name').notNull(),
  /** 技能标签 JSON，如 ["wash","groom","boarding"] */
  skills: text('skills', { mode: 'json' }).$type<string[]>(),
  /** 排班 JSON，结构见 StaffSchedule */
  schedule: text('schedule', { mode: 'json' }).$type<StaffSchedule>(),
  /** 在职状态，取值：active | suspended */
  status: text('status').notNull().default('active'),
  ...auditColumns,
});

/** 员工邀请表（店主发码，员工凭码入职绑定门店） */
export const staffInvites = sqliteTable('staff_invites', {
  id: id(),
  /** 门店 ID -> stores.id */
  storeId: text('store_id')
    .notNull()
    .references(() => stores.id),
  /** 邀请码（全局唯一） */
  code: text('code').notNull().unique(),
  /** 预填员工姓名 */
  staffName: text('staff_name'),
  /** 过期时间 */
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  /** 使用时间（NULL = 未使用） */
  usedAt: integer('used_at', { mode: 'timestamp' }),
  /** 创建人（店主/店长）用户 ID -> users.id */
  createdBy: text('created_by').references(() => users.id),
  ...auditColumns,
});

/* ------------------------------------------------------------------ */
/* 5.2 宠物 / 服务项                                                   */
/* ------------------------------------------------------------------ */

/** 宠物档案表 */
export const pets = sqliteTable('pets', {
  id: id(),
  /** 主人用户 ID -> users.id */
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  /** 宠物名 */
  name: text('name').notNull(),
  /** 物种，取值：dog | cat | other */
  species: text('species').notNull(),
  /** 品种 */
  breed: text('breed'),
  /** 生日，ISO 日期 'YYYY-MM-DD' */
  birthday: text('birthday'),
  /** 体重（kg） */
  weightKg: real('weight_kg'),
  /** 疫苗有效期至，ISO 日期 'YYYY-MM-DD' */
  vaccineValidUntil: text('vaccine_valid_until'),
  /** 是否已绝育 */
  neutered: integer('neutered', { mode: 'boolean' }).notNull().default(false),
  /** 性格标签 JSON，如 ["亲人","胆小"] */
  temperamentTags: text('temperament_tags', { mode: 'json' }).$type<string[]>(),
  /** 头像 URL */
  avatarUrl: text('avatar_url'),
  ...auditColumns,
});

/** 服务项表（洗护 / 寄养） */
export const services = sqliteTable('services', {
  id: id(),
  /** 所属门店 ID -> stores.id */
  storeId: text('store_id')
    .notNull()
    .references(() => stores.id),
  /** 服务大类，取值：grooming | boarding */
  type: text('type').notNull(),
  /** 服务名称 */
  name: text('name').notNull(),
  /** 预计时长（分钟） */
  durationMin: integer('duration_min'),
  /** 价格（分） */
  priceFen: integer('price_fen').notNull(),
  /** 寄养房型（仅 boarding 类使用，如 标准间/豪华间） */
  boardingRoomType: text('boarding_room_type'),
  /** 是否上架 */
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  ...auditColumns,
});

/* ------------------------------------------------------------------ */
/* 5.3 预约 / 服务步骤 / 寄养                                          */
/* ------------------------------------------------------------------ */

/** 预约单表 */
export const appointments = sqliteTable('appointments', {
  id: id(),
  /** 6 位人工核销码（全局唯一） */
  code: text('code').notNull().unique(),
  /** 客户用户 ID -> users.id */
  customerId: text('customer_id')
    .notNull()
    .references(() => users.id),
  /** 门店 ID -> stores.id */
  storeId: text('store_id')
    .notNull()
    .references(() => stores.id),
  /** 指派员工 ID -> staff.id（可空，到店后分配） */
  staffId: text('staff_id').references(() => staff.id),
  /** 宠物 ID -> pets.id */
  petId: text('pet_id')
    .notNull()
    .references(() => pets.id),
  /** 服务项 ID -> services.id */
  serviceId: text('service_id')
    .notNull()
    .references(() => services.id),
  /** 业务大类，取值：grooming | boarding */
  type: text('type').notNull(),
  /** 预约开始时间 */
  scheduledStart: integer('scheduled_start', { mode: 'timestamp' }).notNull(),
  /** 预约结束时间 */
  scheduledEnd: integer('scheduled_end', { mode: 'timestamp' }).notNull(),
  /**
   * 状态，取值：pending | confirmed | in_service | in_boarding |
   * completed | cancel_requested | cancelled
   */
  status: text('status').notNull().default('pending'),
  /** 订单金额（分） */
  priceFen: integer('price_fen').notNull(),
  /** 支付方式，取值：pay_at_store（到店付） | pass_deduct（次卡抵扣） */
  paymentMode: text('payment_mode'),
  /** 支付完成时间 */
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  /** 实付金额（分） */
  paidFen: integer('paid_fen'),
  /** 备注 */
  note: text('note'),
  /** 到店签到时间 */
  checkedInAt: integer('checked_in_at', { mode: 'timestamp' }),
  /** 服务完成时间 */
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  /** 评分（1-5） */
  rating: integer('rating'),
  /** 评价内容 */
  review: text('review'),
  ...auditColumns,
});

/** 门店时段容量表（按 30min 粒度维护可约库存） */
export const storeSlots = sqliteTable(
  'store_slots',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 时段开始时间 */
    slotStart: integer('slot_start', { mode: 'timestamp' }).notNull(),
    /** 时段容量（可并行服务数） */
    capacity: integer('capacity').notNull(),
    /** 已预约数 */
    bookedCount: integer('booked_count').notNull().default(0),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_store_slots_store_start').on(t.storeId, t.slotStart)],
);

/** 服务步骤表（洗护六步流程，寄养可复用部分步骤） */
export const appointmentSteps = sqliteTable(
  'appointment_steps',
  {
    id: id(),
    /** 预约单 ID -> appointments.id */
    appointmentId: text('appointment_id')
      .notNull()
      .references(() => appointments.id),
    /** 步骤标识，取值：disinfection | precheck | grooming | detail | before_after | confirm */
    stepKey: text('step_key').notNull(),
    /** 步骤顺序（1 起） */
    stepOrder: integer('step_order').notNull(),
    /** 步骤状态，取值：locked | active | done */
    status: text('status').notNull().default('locked'),
    /** 本步骤要求的照片数量 */
    requiredPhotos: integer('required_photos').notNull().default(0),
    /** 是否被标记异常（0/1） */
    flagged: integer('flagged', { mode: 'boolean' }).notNull().default(false),
    /** 步骤开始时间 */
    startedAt: integer('started_at', { mode: 'timestamp' }),
    /** 步骤完成时间 */
    doneAt: integer('done_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_appointment_steps_appt_key').on(t.appointmentId, t.stepKey),
    index('ix_appointment_steps_appt_status').on(t.appointmentId, t.status),
  ],
);

/** 步骤照片表 */
export const stepPhotos = sqliteTable(
  'step_photos',
  {
    id: id(),
    /** 所属步骤 ID -> appointment_steps.id */
    stepId: text('step_id')
      .notNull()
      .references(() => appointmentSteps.id),
    /** 原图 URL */
    url: text('url').notNull(),
    /** 缩略图 URL */
    thumbUrl: text('thumb_url'),
    /** 照片标签，取值：normal | before | after（默认 normal） */
    tag: text('tag').notNull().default('normal'),
    /** 拍摄人（员工用户 ID -> users.id） */
    takenBy: text('taken_by').references(() => users.id),
    /** 拍摄时间 */
    takenAt: integer('taken_at', { mode: 'timestamp' }),
    /** 作废时间（NULL = 有效；作废不删除，保留审计） */
    invalidatedAt: integer('invalidated_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [index('ix_step_photos_step').on(t.stepId)],
);

/** 寄养住宿表（与寄养类预约单一一对应） */
export const boardingStays = sqliteTable('boarding_stays', {
  id: id(),
  /** 预约单 ID -> appointments.id（唯一） */
  appointmentId: text('appointment_id')
    .notNull()
    .unique()
    .references(() => appointments.id),
  /** 房间号 */
  roomNo: text('room_no'),
  /** 入住体重（kg） */
  checkinWeightKg: real('checkin_weight_kg'),
  /** 随身物品 JSON，结构见 Belongings */
  belongings: text('belongings', { mode: 'json' }).$type<Belongings>(),
  /** 退住时间（NULL = 在住） */
  checkoutAt: integer('checkout_at', { mode: 'timestamp' }),
  ...auditColumns,
});

/** 寄养每日护理日志表 */
export const boardingDailyLogs = sqliteTable(
  'boarding_daily_logs',
  {
    id: id(),
    /** 住宿记录 ID -> boarding_stays.id */
    stayId: text('stay_id')
      .notNull()
      .references(() => boardingStays.id),
    /** 记录员工 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 日志日期，ISO 日期 'YYYY-MM-DD' */
    logDate: text('log_date').notNull(),
    /** 餐饮记录 JSON，结构见 DailyMeals */
    meals: text('meals', { mode: 'json' }).$type<DailyMeals>(),
    /** 遛放次数 */
    walks: integer('walks').notNull().default(0),
    /** 备注 */
    note: text('note'),
    /** 照片 URL 列表 JSON */
    photos: text('photos', { mode: 'json' }).$type<string[]>(),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_boarding_daily_logs_stay_date').on(t.stayId, t.logDate)],
);

/* ------------------------------------------------------------------ */
/* 5.4 商城                                                            */
/* ------------------------------------------------------------------ */

/** 商品表 */
export const products = sqliteTable('products', {
  id: id(),
  /** 所属门店 ID -> stores.id */
  storeId: text('store_id')
    .notNull()
    .references(() => stores.id),
  /** 分类（如 主粮/零食/玩具/清洁，应用层枚举约束） */
  category: text('category').notNull(),
  /** 商品名 */
  name: text('name').notNull(),
  /** 商品描述 */
  description: text('description'),
  /** 商品图 URL 列表 JSON */
  images: text('images', { mode: 'json' }).$type<string[]>(),
  /** 价格（分） */
  priceFen: integer('price_fen').notNull(),
  /** 库存 */
  stock: integer('stock').notNull().default(0),
  /** 上架状态，取值：on | off */
  status: text('status').notNull().default('on'),
  ...auditColumns,
});

/** 商品订单表 */
export const orders = sqliteTable('orders', {
  id: id(),
  /** 订单编号（全局唯一，展示用） */
  orderNo: text('order_no').notNull().unique(),
  /** 客户用户 ID -> users.id */
  customerId: text('customer_id')
    .notNull()
    .references(() => users.id),
  /** 门店 ID -> stores.id */
  storeId: text('store_id')
    .notNull()
    .references(() => stores.id),
  /** 订单明细 JSON，结构见 OrderItem[] */
  items: text('items', { mode: 'json' }).$type<OrderItem[]>().notNull(),
  /** 订单总额（分） */
  totalFen: integer('total_fen').notNull(),
  /** 收货地址快照 JSON，结构见 OrderAddress */
  address: text('address', { mode: 'json' }).$type<OrderAddress>(),
  /** 状态，取值：pending | paid | shipped | received | cancelled | refunding */
  status: text('status').notNull().default('pending'),
  /** 快递单号 */
  trackingNo: text('tracking_no'),
  ...auditColumns,
});

/**
 * 支付流水表（P5 T5.1 追加 · coder-mall-server 名下）
 *
 * 记录每笔成功支付/退款流水：payCallback 验签 + 金额核对通过后，与订单
 * pending→paid 同事务写入；raw_callback 留回调原文供审计对账。
 * 幂等靠「订单条件更新影响行数」保证（见 routes/payCallback.ts），重复投递
 * 不会产生重复流水。
 */
export const payments = sqliteTable(
  'payments',
  {
    id: id(),
    /** 订单 ID -> orders.id */
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id),
    /** 支付渠道，取值：mock | wechat */
    provider: text('provider').notNull(),
    /** 渠道侧支付单号（PaymentProvider.createPayment 返回的 paymentId） */
    paymentId: text('payment_id').notNull(),
    /** 支付金额（分） */
    amountFen: integer('amount_fen').notNull(),
    /** 流水状态，取值：paid | refunded */
    status: text('status').notNull().default('paid'),
    /** 回调原文 JSON（审计/对账用） */
    rawCallback: text('raw_callback', { mode: 'json' }).$type<Record<string, unknown>>(),
    ...auditColumns,
  },
  (t) => [index('ix_payments_order_id').on(t.orderId)],
);

/* ------------------------------------------------------------------ */
/* 5.5 实时推送 / 事件 / 通知                                          */
/* ------------------------------------------------------------------ */

/** SSE 推送连接订阅表 */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: id(),
  /** 用户 ID -> users.id */
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  /** 客户端标识（设备/浏览器实例） */
  clientId: text('client_id'),
  /** 应用端类型，取值：customer | merchant | staff */
  appType: text('app_type').notNull(),
  /** 已收到的最后事件 ID（断线重连续传用） */
  lastEventId: text('last_event_id'),
  /** 连接建立时间 */
  connectedAt: integer('connected_at', { mode: 'timestamp' }),
  /** 断开时间（NULL = 在线） */
  disconnectedAt: integer('disconnected_at', { mode: 'timestamp' }),
  ...auditColumns,
});

/** 事件发件箱表（可靠事件投递 + SSE 断线重放） */
export const eventOutbox = sqliteTable(
  'event_outbox',
  {
    /** 事件 ID：单调递增 ULID，按 id 排序即按时间排序 */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => monotonicUlid()),
    /** 投递频道（如 store:{id} / user:{id}） */
    channel: text('channel').notNull(),
    /** 事件类型（如 appointment.created / step.done） */
    eventType: text('event_type').notNull(),
    /** 事件载荷 JSON */
    payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
    /** 是否已投递（0/1） */
    delivered: integer('delivered', { mode: 'boolean' }).notNull().default(false),
    ...auditColumns,
  },
  (t) => [index('ix_event_outbox_channel_id').on(t.channel, t.id)],
);

/** 站内通知表 */
export const notifications = sqliteTable('notifications', {
  id: id(),
  /** 接收用户 ID -> users.id */
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  /** 通知类型（应用层枚举，如 appointment.remind） */
  type: text('type').notNull(),
  /** 标题 */
  title: text('title').notNull(),
  /** 正文 */
  body: text('body'),
  /** 跳转链接 */
  link: text('link'),
  /** 阅读时间（NULL = 未读） */
  readAt: integer('read_at', { mode: 'timestamp' }),
  ...auditColumns,
});
