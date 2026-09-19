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
  /** Kimi 账号 ID（全局唯一；kimi_id 不删，批次 7.1 微信用户以 wxmini: 前缀占位） */
  kimiId: text('kimi_id').notNull().unique(),
  /** 微信小程序 openid（批次 7.1 新增，全局唯一；非微信渠道用户为 NULL） */
  wxOpenid: text('wx_openid').unique(),
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
    /** 角色，取值：customer | merchant_owner | merchant_manager | merchant_clerk（M1-补2 R2 新增） | staff */
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
  /**
   * 岗位角色（批次 S1）：frontdesk=前台（扫码核销/接待） | groomer=美容师（服务执行）。
   * NOT NULL 默认 'groomer'——存量员工=执行者，迁移零破坏。
   */
  role: text('role').notNull().default('groomer'),
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
  /**
   * 预置岗位角色（批次 S1）：frontdesk | groomer，缺省 groomer；
   * auth.bindStaff 兑现邀请码时写入 staff.role。
   */
  role: text('role').notNull().default('groomer'),
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
  /** 寄养房型的房间数（仅 boarding 类使用；NULL 时按默认 1 间计，见 boarding_slots） */
  roomCount: integer('room_count'),
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
  /**
   * 派单来源标记（批次 S4 任务 C/D）：auto=下单时自动派单（含客户指定 staffId 的
   * 下单即指派） | merchant=商家 assign 改派（改派后覆盖为 merchant，assigned 事件
   * payload.by 即轨迹，不做独立审计表）。NULL = 未派单或 S4 前的历史单。
   */
  assignSource: text('assign_source'),
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
  /**
   * 取消原因（v1.1-b3 B3-3 起落地，B3-5 W-14 客户取消原因复用本列）。
   * NULL = 未取消或取消时未填写原因。
   */
  cancelReason: text('cancel_reason'),
  /**
   * 取消来源标记，取值：merchant_reject（B3-3 商家拒单） | customer（客户自助取消，
   * W-14 起填） | merchant_review（商家批准 ≤4h 取消申请）。NULL = 未取消/历史数据。
   */
  cancelSource: text('cancel_source'),
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

/**
 * 寄养房型晚槽表（v1.1-b3 B3-2 · A-P1-11 红标）：寄养容量按「晚」占用。
 * 每房型（service_id）× 每住宿晚（night_date，本地日界 'YYYY-MM-DD'，取入住日
 * 到退房日前一日）一行；booked_count >= capacity 即满房，建单事务内逐晚校验占用，
 * 取消/拒单逐晚释放（appointment.releaseBoardingSlots）。
 * 与 store_slots（洗护 30min 时段槽）解耦：寄养不再占用洗护时段槽。
 * 行按需创建（该晚首单 UPSERT），capacity 快照自 services.room_count（空默认 1 间）。
 */
export const boardingSlots = sqliteTable(
  'boarding_slots',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 房型服务项 ID -> services.id */
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id),
    /** 住宿晚（本地日界，ISO 日期 'YYYY-MM-DD'） */
    nightDate: text('night_date').notNull(),
    /** 该房型房间数（容量快照） */
    capacity: integer('capacity').notNull(),
    /** 已预约数 */
    bookedCount: integer('booked_count').notNull().default(0),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_boarding_slots_store_service_night').on(t.storeId, t.serviceId, t.nightDate)],
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
/* 5.3b 次卡（v1.1-b2 B2-7 · 资损红标：扣减/回补与建单/取消同事务）        */
/* ------------------------------------------------------------------ */

/** 会员次卡表：按「客户 × 门店」一卡（唯一索引），记录累计充次与剩余次数 */
export const memberPasses = sqliteTable(
  'member_pass',
  {
    id: id(),
    /** 持卡人用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 发卡门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 累计充次总数（商家充次累加） */
    totalTimes: integer('total_times').notNull().default(0),
    /** 剩余可扣次数（建单扣次 -1 / 取消回补 +1 / 充次 +N） */
    remainTimes: integer('remain_times').notNull().default(0),
    /** 状态，取值：active | disabled */
    status: text('status').notNull().default('active'),
    /** 过期时间（NULL = 长期有效） */
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_member_pass_user_store').on(t.userId, t.storeId)],
);

/** 次卡流水表（只增不改的审计账：-1 扣次 / +1 取消回补 / +N 商家充次） */
export const passDeductLogs = sqliteTable(
  'pass_deduct_log',
  {
    id: id(),
    /** 次卡 ID -> member_pass.id */
    passId: text('pass_id')
      .notNull()
      .references(() => memberPasses.id),
    /** 关联预约单 ID -> appointments.id（NULL = 商家充次 / 收银台结账扣次等无单操作） */
    appointmentId: text('appointment_id').references(() => appointments.id),
    /** 次数变动：-1 扣次 / +1 取消回补 / +N 商家充次 */
    delta: integer('delta').notNull(),
    /**
     * 备注（批次 M1 追加，可空）：收银台结账扣次写「收银台结账 {bill_no}」，
     * 收银台扣次流水 appointment_id 恒 NULL，靠本列回溯来源单（裁定③）。
     */
    note: text('note'),
    ...auditColumns,
  },
  (t) => [
    index('ix_pass_deduct_log_pass').on(t.passId),
    index('ix_pass_deduct_log_appointment').on(t.appointmentId),
  ],
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
/* 5.4b 收银台（批次 M1 · 登记型收银，决策 #27：不碰真实支付）               */
/* ------------------------------------------------------------------ */

/**
 * 收银单表（批次 M1）。
 *
 * - 单号 bill_no：HD-{YYYYMMDD}-{当日 3 位序号}，日期按门店规范时区（+8，
 *   appointment.ts storeWallclock 位移法）取「当日」，序号=该店当日已开单数+1，
 *   全局唯一靠 UNIQUE 索引 + 事务内序号分配（收银写路径应用层串行锁，
 *   口径同 mall.withOrderWriteLock）。bill_no 同时是结账/收款/撤单的幂等键。
 * - 状态机：open（开单中）→ held（挂单）→ open（取单）→ settled（已结账）；
 *   open/held → voided（撤单留痕，禁止物理删除）；settled 终态不可撤
 *   （裁定③：撤单回补属退款专项，本批冻结）。
 * - 金额口径（分）：subtotal_fen = Σ行有效价×qty（有效价 = adjusted ?? unit）；
 *   discount_fen = 单级优惠额；payable_fen = subtotal − discount；
 *   paid_fen = 实收（M1-补1 起 settled 即全额已收，恒 = payable_fen；
 *   「记账 credit」已删除，收银单无待收态）。
 * - customer_id NULL = 散客；created_by = 开单人（商家用户）；
 *   operator_id = 操作员（M1-补1，v1 与 created_by 同源，M2 班次启用后分叉）；
 *   shift_id = 班次预留（M2，本批恒 NULL）。
 */
export const cashierBills = sqliteTable(
  'cashier_bills',
  {
    id: id(),
    /** 挂单/收银单号（全局唯一，幂等键）：HD-{YYYYMMDD}-{当日 3 位序号} */
    billNo: text('bill_no').notNull().unique(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 状态，取值：open | held | settled | voided | reversal（M1-补2 R3b：冲正单，金额镜像独立态） */
    status: text('status').notNull().default('open'),
    /** 会员用户 ID -> users.id（NULL = 散客） */
    customerId: text('customer_id').references(() => users.id),
    /** 单级优惠类型，取值：none | percent（折扣%） | amount（立减分） */
    discountType: text('discount_type').notNull().default('none'),
    /** 优惠值：percent 时为 1-100（如 90 = 九折）；amount 时为立减金额（分） */
    discountValue: integer('discount_value').notNull().default(0),
    /** 合计（分）：Σ行有效价×qty（服务端按快照重算，不信前端金额） */
    subtotalFen: integer('subtotal_fen').notNull().default(0),
    /** 单级优惠额（分） */
    discountFen: integer('discount_fen').notNull().default(0),
    /** 应收（分）= subtotal − discount */
    payableFen: integer('payable_fen').notNull().default(0),
    /**
     * 实收（分）：M1-补1 起 settled 即全额已收（无记账态），恒 = payable_fen；
     * 列保留骨架不动（收银单待收态随 credit 删除而废——「待收」是预约域口径）。
     */
    paidFen: integer('paid_fen').notNull().default(0),
    /** 备注 */
    note: text('note'),
    /** 开单人（商家用户 ID -> users.id） */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    /**
     * 操作员（用户 ULID，必填）——by=who 审计链（M1-补1 修订 2，对齐裁定②）。
     * v1 与 created_by 同源（创建/挂单/结账时 = 当时操作人 ctx.user.id）；
     * M2 班次启用后与 created_by 分叉（created_by=开单人不变，operator_id=当班操作员）。
     */
    operatorId: text('operator_id')
      .notNull()
      .references(() => users.id),
    /**
     * 班次 ID（可空）——M1-补2 R3 正式启用：hold/settle 创建时点挂当班 shift_id
     * （无开班时懒建开班，见 cashier.ts ensureOpenShift）；存量单恒 NULL（迁移零破坏）。
     */
    shiftId: text('shift_id'),
    /** 最近挂单时间（NULL = 从未挂单） */
    heldAt: integer('held_at', { mode: 'timestamp' }),
    /** 结账时间（NULL = 未结账） */
    settledAt: integer('settled_at', { mode: 'timestamp' }),
    /** 撤单时间（NULL = 未撤单） */
    voidedAt: integer('voided_at', { mode: 'timestamp' }),
    /**
     * 撤单原因（选填；留痕不删除）
     * 年费分摊预留说明（M1-补1 修订 2）：会员年费分摊本批无售卖场景，
     * 不加列——会员前置批落地裁定④时再增分摊快照列。
     */
    voidReason: text('void_reason'),
    /* ---- M1-补2 R3b 收银台反结账（已支付单冲正，仅店主；补丁①3b） ----
     * 原 settled 单永存不涂改：以下三列是「被冲正」链接元数据（非账目数字涂改）；
     * 冲正单为独立行（status='reversal'，金额镜像负值，reversal_of_bill_no 指原单）。
     * 收入聚合口径：被冲正原单（reversed_at 非空）与冲正单一律排除（computeDayTender /
     * loadCashierFinance 双落点）。 */
    /** 被冲正时间（NULL = 未被冲正） */
    reversedAt: integer('reversed_at', { mode: 'timestamp' }),
    /** 冲正操作人（仅店主，闸门在路由层） */
    reversedBy: text('reversed_by').references(() => users.id),
    /** 冲正单单号（原单 → 冲正单链接；NULL = 未被冲正） */
    reversalBillNo: text('reversal_bill_no'),
    /** 冲正单 → 原单号链接（仅 status='reversal' 行有值） */
    reversalOfBillNo: text('reversal_of_bill_no'),
    ...auditColumns,
  },
  (t) => [
    index('ix_cashier_bills_store_status').on(t.storeId, t.status),
    index('ix_cashier_bills_store_created').on(t.storeId, t.createdAt),
  ],
);

/**
 * 收银单行表：服务行 / 商品行 / 预约行三类，快照留名留价（引用不复制语义
 * 仅指预约财务口径回写，行本身仍快照，防止后续改价/下架影响历史单）。
 * - 有效价 = adjusted_price_fen ?? unit_price_fen（改价留痕，仅店主可改，闸门在路由层）。
 * - paid_by_pass=true 的服务行：结账时走次卡扣次（1 行 = 扣 1 次），
 *   金额经 method='pass' 支付段覆盖。
 * - stock_short=true：结账时库存不足的留痕（任务书口径「不足不阻塞但须明示」，
 *   库存按 MAX(0, stock-qty) 扣减）。
 */
export const cashierBillItems = sqliteTable(
  'cashier_bill_items',
  {
    id: id(),
    /** 收银单 ID -> cashier_bills.id */
    billId: text('bill_id')
      .notNull()
      .references(() => cashierBills.id),
    /** 行类型，取值：service | product | appointment */
    kind: text('kind').notNull(),
    /** 引用 ID：services.id / products.id / appointments.id（按 kind 解释） */
    refId: text('ref_id').notNull(),
    /** 名称快照 */
    nameSnapshot: text('name_snapshot').notNull(),
    /** 规格快照（如「90 分钟」/ 宠物名·预约时间 / 商品单位），可空 */
    specSnapshot: text('spec_snapshot'),
    /** 数量（服务/预约行恒 1，仅商品行 >1；应用层约束） */
    qty: integer('qty').notNull().default(1),
    /** 单价快照（分） */
    unitPriceFen: integer('unit_price_fen').notNull(),
    /** 改价后单价（分，可空；NULL = 未改价；改价/折扣仅 merchant_owner） */
    adjustedPriceFen: integer('adjusted_price_fen'),
    /** 是否次卡扣次行（仅 grooming 服务行允许） */
    paidByPass: integer('paid_by_pass', { mode: 'boolean' }).notNull().default(false),
    /** 结账时库存不足留痕（不足不阻塞、库存兜底扣到 0） */
    stockShort: integer('stock_short', { mode: 'boolean' }).notNull().default(false),
    ...auditColumns,
  },
  (t) => [index('ix_cashier_bill_items_bill').on(t.billId)],
);

/**
 * 收银支付段表（登记型：只登记支付方式与金额，无任何真实扣款/网关）。
 * 一单可多段组合（如 现金 50 + 微信 68）。
 * 方式枚举（M1-补2 R5 五分列）：cash | wechat | alipay | pass | stored_value
 * （「扫码」拆微信/支付宝；stored_value=存量储值消费，M1-补2 正式启用——
 * 仅消费、全域无充值入口（新售冻结不变）；「记账 credit」已删除）。
 * 已收口径（裁定①）：已收=Σ现金类（cash/wechat/alipay）；pass 次卡等值与
 * stored_value 储值消费永不计入，作参考列单列（computeDayTender 出口）。
 * method='pass' 段须带 pass_id，扣次流水见 pass_deduct_log
 * （appointment_id=NULL，note 带 bill_no）；method='stored_value' 段扣减流水见
 * stored_value_logs（含前后余额+单号+操作人）。
 */
export const cashierPayments = sqliteTable(
  'cashier_payments',
  {
    id: id(),
    /** 收银单 ID -> cashier_bills.id */
    billId: text('bill_id')
      .notNull()
      .references(() => cashierBills.id),
    /** 支付方式，取值：cash | qr | pass | credit */
    method: text('method').notNull(),
    /** 金额（分）；pass 段金额 = 本单扣次行有效价合计（记账口径用，非现金） */
    amountFen: integer('amount_fen').notNull(),
    /** 次卡 ID -> member_pass.id（method='pass' 必填，其余 NULL） */
    passId: text('pass_id').references(() => memberPasses.id),
    ...auditColumns,
  },
  (t) => [index('ix_cashier_payments_bill').on(t.billId)],
);

/* ------------------------------------------------------------------ */
/* 5.4c 班次 / 日结 / 储值（批次 M1-补2：R3 交接班·日结·反结账 + R5/R5b 储值） */
/* ------------------------------------------------------------------ */

/**
 * 班次表（M1-补2 R3 · 启用 0009 预留的 cashier_bills.shift_id）：
 * 开店/交接班生成班次；收银单在创建时点（hold/settle）挂当班 shift_id。
 * 无开班时口径=懒建开班（ensureOpenShift：首笔收银写操作人记 openedBy，
 * 交接班「确认」是 owner/manager 的 closeShift；clerk 无任何交接班入口）。
 */
export const shifts = sqliteTable(
  'shifts',
  {
    id: id(),
    /** 所属门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 开班人（懒建时=首笔收银写操作人） */
    openedBy: text('opened_by')
      .notNull()
      .references(() => users.id),
    /** 开班时间 */
    openedAt: integer('opened_at', { mode: 'timestamp' }).notNull(),
    /** 闭班时间（NULL = 当班进行中） */
    closedAt: integer('closed_at', { mode: 'timestamp' }),
    /** 闭班确认人（owner|manager；clerk 无入口） */
    closedBy: text('closed_by').references(() => users.id),
    /** 状态，取值：open | closed */
    status: text('status').notNull().default('open'),
    ...auditColumns,
  },
  (t) => [index('ix_shifts_store_status').on(t.storeId, t.status)],
);

/**
 * 日结单表（M1-补2 R3 · 裁定④ + 补丁①3a）：
 * - 生成即冻结当班账目（status='frozen'）：账面现金（当班现金支付段 Σ，与
 *   todayTenderStats 同源的班次口径 computeShiftTender）vs 实点现金（手输），
 *   差异=实点−账面；微信/支付宝/次卡等值/储值分列 + 笔数快照。
 * - 原日结单永存不涂改：反结账（拆箱）不删不改原单数字，仅置 status='reversed'
 *   + reversed_at/reversed_by/reversal_id 链接元数据；冲正关联单为独立行
 *   （kind='reversal'，ref_close_id 指原单，snapshot_json 存前后值，强制原因）。
 * - 差错走调整备注（adjustments_json 追加只增不改，留痕含操作人）；重新日结=
 *   原单 reversed 后对同班次再 dayClose。
 */
export const dayCloses = sqliteTable(
  'day_closes',
  {
    id: id(),
    /** 所属门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 冻结的班次 ID -> shifts.id */
    shiftId: text('shift_id')
      .notNull()
      .references(() => shifts.id),
    /** 行类型：close=日结单 | reversal=冲正关联单 */
    kind: text('kind').notNull().default('close'),
    /** 冲正关联单 → 原日结单 ID（仅 kind='reversal' 有值） */
    refCloseId: text('ref_close_id'),
    /** 营业日（YYYY-MM-DD，门店规范时区 +8） */
    bizDate: text('biz_date').notNull(),
    /** 账面现金（分）：当班现金支付段 Σ */
    bookCashFen: integer('book_cash_fen').notNull().default(0),
    /** 实点现金（分，手输；reversal 行镜像原单值） */
    actualCashFen: integer('actual_cash_fen'),
    /** 差异（分）= 实点 − 账面（红字标出的数据源；reversal 行镜像原单值） */
    diffFen: integer('diff_fen'),
    /** 分列快照：微信 / 支付宝 / 次卡等值（参考列） / 储值消费（参考列） */
    wechatFen: integer('wechat_fen').notNull().default(0),
    alipayFen: integer('alipay_fen').notNull().default(0),
    passFen: integer('pass_fen').notNull().default(0),
    storedValueFen: integer('stored_value_fen').notNull().default(0),
    /** 笔数快照：收银单数 / 合并流水笔数 */
    cashierPaidCount: integer('cashier_paid_count').notNull().default(0),
    paidCount: integer('paid_count').notNull().default(0),
    /** 反结账强制原因（kind='reversal' 必填；close 行可空备注） */
    reason: text('reason'),
    /** 前后值快照 JSON（reversal 行：{before: 原单冻结数字, note}；双向可查） */
    snapshotJson: text('snapshot_json'),
    /** 调整备注 JSON 数组（次日调整单留痕：[{at, by, note}]，只增不改） */
    adjustmentsJson: text('adjustments_json'),
    /** 状态：frozen=冻结生效 | reversed=已被冲正（仅 close 行会翻转） */
    status: text('status').notNull().default('frozen'),
    /** 被冲正时间 / 操作人 / 冲正关联单 ID（close 行链接元数据） */
    reversedAt: integer('reversed_at', { mode: 'timestamp' }),
    reversedBy: text('reversed_by').references(() => users.id),
    reversalId: text('reversal_id'),
    /** 创建人（日结=确认人 owner|manager；冲正=店主） */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [
    index('ix_day_closes_store').on(t.storeId, t.status),
    index('ix_day_closes_shift').on(t.shiftId),
  ],
);

/**
 * 会员储值账户表（M1-补2 R5 · 裁定①③）：userId×storeId 唯一。
 * 台账两列分列：principal=本金、bonus=赠送；余额=本金+赠送。
 * 扣减顺序：先本金后赠送（台账赠送列全零，v1 简化口径，注释在案）。
 * 全域无充值入口（新售冻结不变）；账户仅由 R5b CSV 导入批次建立。
 */
export const storedValueAccounts = sqliteTable(
  'stored_value_accounts',
  {
    id: id(),
    /** 会员用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 归属门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 储值本金余额（分） */
    principalFen: integer('principal_fen').notNull().default(0),
    /** 储值赠送余额（分） */
    bonusFen: integer('bonus_fen').notNull().default(0),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_sv_account_user_store').on(t.userId, t.storeId)],
);

/**
 * 储值流水表（只增不改审计账）：结账扣减（billNo 带单号，delta 负）/
 * 反结账回补（delta 正）/ R5b 导入入账（importBatchId 带批次号）。
 * 前后余额=本金+赠送合计口径；分列 delta 供批次清除重算。
 */
export const storedValueLogs = sqliteTable(
  'stored_value_logs',
  {
    id: id(),
    /** 账户 ID -> stored_value_accounts.id */
    accountId: text('account_id')
      .notNull()
      .references(() => storedValueAccounts.id),
    /** 会员用户 ID（冗余列，按人查账免 join） */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 门店 ID */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 本金变动（分，带符号） */
    deltaPrincipalFen: integer('delta_principal_fen').notNull().default(0),
    /** 赠送变动（分，带符号） */
    deltaBonusFen: integer('delta_bonus_fen').notNull().default(0),
    /** 总变动（分，带符号）= deltaPrincipal + deltaBonus */
    deltaFen: integer('delta_fen').notNull(),
    /** 变动前后余额（分，本金+赠送合计） */
    balanceBeforeFen: integer('balance_before_fen').notNull(),
    balanceAfterFen: integer('balance_after_fen').notNull(),
    /** 关联收银单号（消费/回补；导入入账为 NULL） */
    billNo: text('bill_no'),
    /** 操作人（结账/回补=当班操作员；导入=owner） */
    operatorId: text('operator_id')
      .notNull()
      .references(() => users.id),
    /** 导入批次号（R5b；消费/回补为 NULL） */
    importBatchId: text('import_batch_id'),
    /** 备注 */
    note: text('note'),
    ...auditColumns,
  },
  (t) => [
    index('ix_sv_logs_account').on(t.accountId),
    index('ix_sv_logs_batch').on(t.importBatchId),
    index('ix_sv_logs_bill').on(t.billNo),
  ],
);

/**
 * 储值台账 CSV 导入批次表（M1-补2 R5b · 裁定③：只交付不执行，启用等老板令）。
 * 全量留痕：成功/失败行数报告（report_json）+ 源文件校验位（本金合计/人数）。
 * 批次可标记清除（试导回滚）：status executed→cleared + clearedAt/clearedBy；
 * 已产生消费（批次账户存在带 bill_no 的流水）的批次拒绝清除。
 */
export const storedValueImportBatches = sqliteTable(
  'stored_value_import_batches',
  {
    id: id(),
    /** 执行人（仅 owner，闸门在路由层） */
    operatorId: text('operator_id')
      .notNull()
      .references(() => users.id),
    /** 源文件名（留痕） */
    filename: text('filename'),
    /** 门店映射快照（台账店名 → storeId） */
    mappingJson: text('mapping_json'),
    /** 数据行数 / 成功行数 / 失败行数 */
    totalRows: integer('total_rows').notNull().default(0),
    okRows: integer('ok_rows').notNull().default(0),
    failRows: integer('fail_rows').notNull().default(0),
    /** 源文件校验位：本金>0 人数 / 本金合计（分） */
    memberCount: integer('member_count').notNull().default(0),
    principalTotalFen: integer('principal_total_fen').notNull().default(0),
    /** 状态：executed | cleared（标记清除） */
    status: text('status').notNull().default('executed'),
    clearedAt: integer('cleared_at', { mode: 'timestamp' }),
    clearedBy: text('cleared_by').references(() => users.id),
    /** 对账报告 JSON（preview 同构：校验位 + 失败原因分布 + 门店分布 + 次卡夹带计数） */
    reportJson: text('report_json'),
    ...auditColumns,
  },
  (t) => [index('ix_sv_batches_status').on(t.status)],
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
