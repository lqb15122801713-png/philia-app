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
  /**
   * 软注销时间（批次 R13a 账号安全 · 0017）：非 NULL=已注销——会话中间件视同
   * 用户不存在（全接口/SSE 401），登录路径明文拒；手机号同步释放为
   * `_deact_<uid>_<原号>`（同号可重新注册建档，与原账号互不可见）。
   */
  deactivatedAt: integer('deactivated_at', { mode: 'timestamp' }),
  /** 注销原因（门店审批 note 快照） */
  deactivateReason: text('deactivate_reason'),
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
  /**
   * 提成/绩效档位（批次 staff-2 R9 附带列）：美容师 G0..G4 | 前台/店长 P0..P4。
   * NULL = 未评级；计提/绩效判定只读本列，比例系数落 commission_rules 配置表。
   */
  grade: text('grade'),
  /**
   * 试用期标记（批次 staff-2 R9 · 0012）：试用期前台提成 ×50%
   * （commission_probation_multiplier）；试用期不设绩效与全勤。
   */
  probation: integer('probation', { mode: 'boolean' }).notNull().default(false),
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
  /**
   * 软删除标记（批次 R13a 账号注销联动 · 0017）：非 NULL=已随账号注销标记删除。
   * 读侧不过滤（注销账号全接口 401 不可达；历史预约/单据保留可见，留痕口径）。
   */
  deletedAt: integer('deleted_at', { mode: 'timestamp' }),
  /** 软删除原因（如「账号注销」） */
  deleteReason: text('delete_reason'),
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
  /**
   * 接待人（批次 staff-2 R9-C · 0012，可空 -> users.id）：预约单到店核销时可改挂
   * 实际接待人的落点；收银开单时若含预约行，账单 receptionist_id 优先取本列
   * （无则=开单人）。NULL = 未指定。变更留痕见 reception_logs（挂 appointment_id）。
   */
  receptionistId: text('receptionist_id').references(() => users.id),
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
    /** 拍摄时刻（秒；server 从原图 EXIF DateTimeOriginal 解析，jimp 剥离前留痕——片 3 B5-2 只许现场拍兜底闸） */
    clientTakenAt: integer('client_taken_at', { mode: 'timestamp' }),
    /** 校验留痕（如「EXIF 缺失放行留痕」；NULL=校验通过或无异常） */
    flagReason: text('flag_reason'),
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
  /**
   * 效期截止时间（批次 staff-2 R8 附带列）：安心包（category='care_package'）
   * 效期 ≤30 天预警查询用；NULL = 无有效期概念。
   */
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  /**
   * 是否消毒耗材（批次 staff-2 R8 附带列，0/1 默认 0）：洗护消毒步完成时，
   * 本店 is_disinfection_supply=1 商品各扣 1 并落流水（source_type='disinfection'）。
   */
  isDisinfectionSupply: integer('is_disinfection_supply', { mode: 'boolean' })
    .notNull()
    .default(false),
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
     * 接待人（批次 staff-2 R9-C，可空 -> users.id）：前台绩效归属字段。
     * 默认=开单人（迁移回填 receptionist_id = operator_id）；预约单到店核销时
     * 可改挂实际接待人，变更写 reception_logs（前后值留痕）；无接待人（IS NULL）
     * 的洗美单在前台绩效聚合中硬排除（宁可漏计，不许乱挂）。
     */
    receptionistId: text('receptionist_id').references(() => users.id),
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
    /* ---- R12 退款专项（退款 ≠ 反结账；原单永存不涂改，仅挂退款关联标记，内容一字不改） ---- */
    /**
     * 退款状态（批次 R12，可空）：NULL=未退款 | 'partial' 部分退款 | 'refunded' 已退款。
     * 原单仅挂本标记，金额/行项一字不改；退款明细见 refund_bills.bill_id 索引双向可查。
     */
    refundStatus: text('refund_status'),
    /** 最近一笔退款单号（RB-yyyymmdd-NNN，可空；与 refund_bills.bill_id 构成双向可查） */
    refundBillNo: text('refund_bill_no'),
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
 * 日结单表（M1-补2 R3 · 裁定④ + 补丁①3a + 条件②全日口径）：
 * - 生成即冻结**自然日全部支付段（跨班次，computeDayTender 同源）**
 *   （status='frozen'）：账面现金（当日现金支付段 Σ）vs 实点现金（手输），
 *   差异=实点−账面；微信/支付宝/次卡等值/储值分列 + 笔数快照；班次拆分
 *   明细存 snapshot_json.shiftBreakdown（展示用）；一日一结（bizDate 唯一冻结）。
 * - shift_id 列=日结发起时当班（追溯记录，口径与冻结无关）；班次账拆分见
 *   snapshot；交接班闭班（shifts.status）不冻结账目。
 * - 原日结单永存不涂改：反结账（拆箱）不删不改原单数字，仅置 status='reversed'
 *   + reversed_at/reversed_by/reversal_id 链接元数据；冲正关联单为独立行
 *   （kind='reversal'，ref_close_id 指原单，snapshot_json 存前后值，强制原因）。
 * - 差错走调整备注（adjustments_json 追加只增不改，留痕含操作人）；重新日结=
 *   原单 reversed 后对同日再 dayClose。
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
  /**
   * 通知分类（补缺大批片 5 站内信分类）：trade 交易 | service 服务 | account 账户 | marketing 营销。
   * NOT NULL 默认 'service'（存量行迁移按 type 前缀回填，见 0017 迁移）；
   * 硬口径：trade/service/account 不可退订（保障服务履约），仅 marketing 可关。
   */
  category: text('category').notNull().default('service'),
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

/**
 * 站内信订阅偏好表（补缺大批片 5）：user × category 一行，enabled=0 即退订。
 * 无行 = 默认全订阅（enabled=1）。硬口径：仅 marketing 行允许 enabled=0，
 * trade/service/account 置 0 在 push.setNotifyPref 硬拒（闸在路由层，本表不做 DB 约束）。
 */
export const userNotifyPrefs = sqliteTable(
  'user_notify_prefs',
  {
    id: id(),
    /** 用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 分类，取值：trade | service | account | marketing */
    category: text('category').notNull(),
    /** 是否订阅（1/0，默认 1） */
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_user_notify_prefs_user_category').on(t.userId, t.category)],
);

/* ------------------------------------------------------------------ */
/* 5.6 员工端 2.0（批次 staff-2 · R7~R10；字段级规格见 docs/staff2/R7-R10-DESIGN.md §一） */
/* 口径：数值一律落配置表（commission_rules / xp_rules），代码只读表、不落常量。      */
/* ------------------------------------------------------------------ */

/** 规则配置值载体：比例 bp / 定额分 / 拆分 / 门槛全在此，结构按 rule_key 约定，应用层 zod 校验 */
export type RuleConfigValue = Record<string, unknown>;

/** 提成/绩效快照分列载荷（美容师绩效池/前台绩效池两行不合并等，结构按 kind 约定） */
export type CommissionSnapshotPayload = Record<string, unknown>;

/** 规则配置变更留痕：每 key 前后值数组 */
export type RuleConfigChanges = Array<{ rule_key: string; before: unknown; after: unknown }>;

/* ---- R7 考勤 ---- */

/**
 * 考勤打卡记录表（R7）：缺卡不落行（无行即缺卡）。
 * - 打卡时按 staff.schedule 周模板比对班次（容差 10min）→ status late/early；
 * - 围栏=门店经纬度 300m，围栏外 server 拒写（不写异常行）；
 * - 防代打：同 device_id 同日不同 user_id 打卡账号数 >2 → 该批记录 flagged=1（只标记不阻断）；
 * - 补卡审批通过 → 插入 makeup=1 行（status='normal'）并回链审批单。
 */
export const attendanceRecords = sqliteTable(
  'attendance_records',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 员工 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 打卡用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 打卡日期（本地日界，ISO 'YYYY-MM-DD'） */
    date: text('date').notNull(),
    /** 打卡类型，取值：in（上班） | out（下班） */
    kind: text('kind').notNull(),
    /** 打卡时间（Unix 秒） */
    ts: integer('ts', { mode: 'timestamp' }).notNull(),
    /** 打卡纬度 / 经度（围栏采样） */
    lat: real('lat').notNull(),
    lng: real('lng').notNull(),
    /** 距门店围栏圆心距离（米） */
    distanceM: integer('distance_m').notNull(),
    /** 状态，取值：normal | late（迟到） | early（早退） */
    status: text('status').notNull().default('normal'),
    /** 补卡标记（0/1）：补卡审批通过插入的行 =1 */
    makeup: integer('makeup', { mode: 'boolean' }).notNull().default(false),
    /** 打卡设备标识（防代打判定维度） */
    deviceId: text('device_id').notNull(),
    /** 防代打标记（0/1，只标记不阻断） */
    flagged: integer('flagged', { mode: 'boolean' }).notNull().default(false),
    /** 打卡来源：NULL=现场在线 | offline_relay=断网暂存补传（片 2 考勤 B1-3） */
    source: text('source'),
    /** 设备端打卡时刻（补传=客户侧实际打点时刻；现场=NULL 同 ts） */
    clientTs: integer('client_ts', { mode: 'timestamp' }),
    /** WiFi 打卡命中 BSSID（片 2 B1-1；NULL=未走 WiFi 校验） */
    bssid: text('bssid'),
    /** 外勤拍照 URL（片 2 B1-2 双要件之一） */
    photoUrl: text('photo_url'),
    /** 员工确认链（片 2 B1-6 · 闸门件 §五.2 已签：确认后改考勤须店长+留痕） */
    confirmedBy: text('confirmed_by').references(() => users.id),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [
    index('ix_attendance_records_store_date').on(t.storeId, t.date),
    index('ix_attendance_records_staff_date').on(t.staffId, t.date),
    index('ix_attendance_records_device_date').on(t.deviceId, t.date),
  ],
);

/**
 * 考勤审批表（R7，异常申诉 + 补卡双流）：
 * - 异常申诉（type='exception'）挂原卡 record_id；补卡（type='makeup'）填 date+kind+requested_ts；
 * - 补卡限当月 + 每人 ≤3 次/月（常量 MAKEUP_MONTHLY_LIMIT=3，任务书称可配置，本批代码常量+报备）；
 * - 审批通过 → 插入 makeup=1 的 attendance_records 行（status='normal'）并回链。
 */
export const attendanceApprovals = sqliteTable(
  'attendance_approvals',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 员工 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 申请人用户 ID -> users.id */
    applicantUserId: text('applicant_user_id')
      .notNull()
      .references(() => users.id),
    /** 审批类型，取值：exception（异常申诉） | makeup（补卡） */
    type: text('type').notNull(),
    /** 原打卡记录 ID -> attendance_records.id（异常申诉挂原卡；补卡为 NULL） */
    recordId: text('record_id').references(() => attendanceRecords.id),
    /** 目标日期（ISO 'YYYY-MM-DD'） */
    date: text('date').notNull(),
    /** 补卡申请目标，取值：in | out（exception 申诉时填原卡 kind） */
    kind: text('kind').notNull(),
    /** 补卡填的实际上下班时间（exception 申诉为 NULL） */
    requestedTs: integer('requested_ts', { mode: 'timestamp' }),
    /** 申请原因（必填） */
    reason: text('reason').notNull(),
    /** 状态，取值：pending | approved | rejected */
    status: text('status').notNull().default('pending'),
    /** 审批人用户 ID -> users.id（NULL = 待审批） */
    reviewerId: text('reviewer_id').references(() => users.id),
    /** 审批时间（NULL = 待审批） */
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    /** 审批备注 */
    reviewNote: text('review_note'),
    ...auditColumns,
  },
  (t) => [
    index('ix_attendance_approvals_store_status').on(t.storeId, t.status),
    index('ix_attendance_approvals_staff_date').on(t.staffId, t.date),
  ],
);

/* ---- R8 库存流水 / 盘点 ---- */

/**
 * 库存流水表（R8 地基，只增不改审计账）：收银扣减（cashier）/ 反结账回补（reversal）/
 * 盘点入账（count）/ 消毒耗材扣减（disinfection）/ 手工调整（manual）。
 * 收银扣减与反结账回补既有逻辑不动，增流水写入（事务内）；before/after 落前后值。
 */
export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 商品 ID -> products.id */
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    /** 来源类型，取值：cashier | reversal | count | disinfection | manual */
    sourceType: text('source_type').notNull(),
    /** 来源单号（收银单号 / 盘点单 id / 预约步骤 id 等；manual 可为空） */
    sourceId: text('source_id'),
    /** 库存变动（带符号，正增负减） */
    delta: integer('delta').notNull(),
    /** 变动前 / 后库存 */
    beforeStock: integer('before_stock').notNull(),
    afterStock: integer('after_stock').notNull(),
    /** 操作人用户 ID -> users.id */
    operatorId: text('operator_id')
      .notNull()
      .references(() => users.id),
    /** 备注 */
    note: text('note'),
    ...auditColumns,
  },
  (t) => [
    index('ix_stock_movements_product').on(t.productId),
    index('ix_stock_movements_store_created').on(t.storeId, t.createdAt),
    index('ix_stock_movements_source').on(t.sourceType, t.sourceId),
  ],
);

/**
 * 盘点单表（R8）：日盘（单价≥100 元商品，products.price_fen≥10000 过滤）/
 * 周盘（全量）/ 盲盘。确认（店长/老板）事务内按差异生成 stock_movements
 * （source_type='count'，来源=盘点单 id）+ 更新 products.stock + status→posted；
 * 驳回→rejected（退回重盘=可重新 counted）；confirm 前零库存写入。
 */
export const inventoryCounts = sqliteTable(
  'inventory_counts',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 盘点类型，取值：daily | weekly | blind */
    type: text('type').notNull(),
    /** 状态，取值：draft | counted | confirmed | posted | rejected */
    status: text('status').notNull().default('draft'),
    /** 建单人用户 ID -> users.id */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    /** 确认人用户 ID -> users.id（NULL = 未确认） */
    confirmedBy: text('confirmed_by').references(() => users.id),
    /** 确认时间（NULL = 未确认） */
    confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
    /** 入账时间（NULL = 未入账） */
    postedAt: integer('posted_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [index('ix_inventory_counts_store_status').on(t.storeId, t.status)],
);

/** 盘点单行表（R8）：建单时账面快照 system_stock + 实盘 actual_stock（NULL = 未盘） */
export const inventoryCountItems = sqliteTable(
  'inventory_count_items',
  {
    id: id(),
    /** 盘点单 ID -> inventory_counts.id */
    countId: text('count_id')
      .notNull()
      .references(() => inventoryCounts.id),
    /** 商品 ID -> products.id */
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    /** 建单时账面库存快照 */
    systemStock: integer('system_stock').notNull(),
    /** 实盘库存（NULL = 未录入） */
    actualStock: integer('actual_stock'),
    ...auditColumns,
  },
  (t) => [index('ix_inventory_count_items_count').on(t.countId)],
);

/* ---- R9 提成 / 绩效 ---- */

/**
 * 提成规则配置表（R9 · 改数不改码）：V1.3 全表种子 version=1（含售卡定额
 * 5/10/20 元、活体 5%-10% 备用、P4 预留行 active=0、绩效 SABCD 系数、
 * 绩效基数 5%、扣减上限 50%、结算日 15、快照日 1）。
 * 计提=只读计算：按 effective_from 取规则版本算；老板端配置页保存=version+1
 * 新行 active=1（见 rule_config_versions），新规只约束生效后的单不回溯。
 */
export const commissionRules = sqliteTable(
  'commission_rules',
  {
    id: id(),
    /** 规则版本（初始全表种子 =1） */
    version: integer('version').notNull(),
    /** 规则键（如 commission_grooming_rate / perf_coeff_s） */
    ruleKey: text('rule_key').notNull(),
    /** 规则中文名（配置页展示） */
    label: text('label').notNull(),
    /** 规则值 JSON（比例 bp / 定额分 / 拆分 / 门槛），结构见 RuleConfigValue */
    valueJson: text('value_json', { mode: 'json' }).$type<RuleConfigValue>().notNull(),
    /** 生效时间（按此取规则版本；新规只管生效后的单） */
    effectiveFrom: integer('effective_from', { mode: 'timestamp' }).notNull(),
    /** 是否生效（0/1；预留/作废行 =0） */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** 创建/变更人用户 ID -> users.id */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_commission_rules_key_active').on(t.ruleKey, t.active)],
);

/**
 * 时长规则配置表（补充令① · 时长系数表配置化，决策 #39/#40；结构逐列同 commission_rules）：
 * durationEngine 全部系数（物种×服务种类基础时长、体型系数、毛长系数、体重分档阈值、
 * 长毛品种关键词、服务种类关键词）落本表，引擎/提成（G0 洗护判别共用服务种类关键词表）
 * 只读表，改数不改码；初始 version=1 种子=原引擎占位常量照转（label 注「占位待供给」）。
 * 保存即生效、版本化留痕（rule_config_versions domain='duration'）；新值只管修改后新
 * 产生的预约/时长计算，不回溯既有单据。
 */
export const durationRules = sqliteTable(
  'duration_rules',
  {
    id: id(),
    /** 规则版本（初始全表种子 =1） */
    version: integer('version').notNull(),
    /** 规则键（如 duration_base_min / duration_size_coef / duration_service_kind_keywords） */
    ruleKey: text('rule_key').notNull(),
    /** 规则中文名（配置页展示；占位期注明「占位待供给」） */
    label: text('label').notNull(),
    /** 规则值 JSON（分钟/系数/阈值/关键词表），结构见 RuleConfigValue */
    valueJson: text('value_json', { mode: 'json' }).$type<RuleConfigValue>().notNull(),
    /** 生效时间（按此取规则版本；新规只管生效后的单） */
    effectiveFrom: integer('effective_from', { mode: 'timestamp' }).notNull(),
    /** 是否生效（0/1） */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** 创建/变更人用户 ID -> users.id */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_duration_rules_key_active').on(t.ruleKey, t.active)],
);

/**
 * 提成/绩效月度快照表（R9）：每月 1 日 02:00 快照（server 定时器幂等）；
 * 季度绩效同 15 日口径快照。已快照月份读快照，差额进当月「调整项」，不动历史。
 * payload_json 分列池：美容师绩效池/前台绩效池两行不合并（同源双计为设计）。
 */
export const commissionSnapshots = sqliteTable(
  'commission_snapshots',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 员工 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 账期：'YYYY-MM'（月度提成）或 'YYYY-Qn'（季度绩效） */
    period: text('period').notNull(),
    /** 快照类型，取值：commission | performance */
    kind: text('kind').notNull(),
    /** 分列池载荷 JSON（美容师绩效池/前台绩效池两行不合并） */
    payloadJson: text('payload_json', { mode: 'json' })
      .$type<CommissionSnapshotPayload>()
      .notNull(),
    /** 快照总额（分） */
    totalFen: integer('total_fen').notNull(),
    /** 计提所用规则版本（commission_rules.version） */
    ruleVersion: integer('rule_version').notNull(),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_commission_snapshots_staff_period_kind').on(t.staffId, t.period, t.kind),
    index('ix_commission_snapshots_store_period').on(t.storeId, t.period),
  ],
);

/**
 * 绩效扣减记录表（R9）：只扣绩效不扣提成；插入闸门=当月累计 ≤ 当月绩效 50%
 * （cap 值落 commission_rules rule_key=perf_deduction_cap_bp），超限 server 拒绝
 * 「已达当月扣减上限」。
 */
export const deductionRecords = sqliteTable(
  'deduction_records',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 员工 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 归属月份（'YYYY-MM'） */
    month: text('month').notNull(),
    /** 扣减金额（分） */
    amountFen: integer('amount_fen').notNull(),
    /** 扣减原因（必填） */
    reason: text('reason').notNull(),
    /** 录单人用户 ID -> users.id（店长或老板） */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
        /** 状态：active | reverted（申诉成立返还=置 reverted 留痕不删行，只增不改同族口径——片 4 B3-6） */
    status: text('status').notNull().default('active'),
    revertedBy: text('reverted_by').references(() => users.id),
    revertedAt: integer('reverted_at', { mode: 'timestamp' }),
    revertNote: text('revert_note'),
    ...auditColumns,
  },
  (t) => [
    index('ix_deduction_records_staff_month').on(t.staffId, t.month),
    index('ix_deduction_records_store_month').on(t.storeId, t.month),
  ],
);

/* ---- R9-B 绩效档位 ---- */

/**
 * 绩效档位表（R9-B）：季度考核 SABCD 五档（老板或授权店长打分）。
 * 系数 1.2/1.0/0.8/0.5/0 落 commission_rules（rule_key=perf_coeff_*）。
 */
export const performanceGrades = sqliteTable(
  'performance_grades',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 员工 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 季度（'YYYY-Qn'） */
    quarter: text('quarter').notNull(),
    /** 档位，取值：S | A | B | C | D */
    grade: text('grade').notNull(),
    /** 打分人用户 ID -> users.id（老板或授权店长） */
    graderId: text('grader_id')
      .notNull()
      .references(() => users.id),
    /** 备注 */
    note: text('note'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_performance_grades_staff_quarter').on(t.staffId, t.quarter),
    index('ix_performance_grades_store_quarter').on(t.storeId, t.quarter),
  ],
);

/* ---- R9-C 接待人域 ---- */

/**
 * 接待人变更留痕表（R9-C）：核销改挂实际接待人 / 事后纠偏时写入（前后值）。
 * 接待人本体=cashier_bills.receptionist_id（默认=开单人，迁移回填=operator_id）；
 * 预约侧落点=appointments.receptionist_id（0012 新增）。
 * 0012 起：bill_id 改可空 + 新增 appointment_id——留痕可挂预约（核销改挂时账单
 * 可能尚未开出）或账单（事后纠偏），两者至少其一非空（应用层约束）。
 */
export const receptionLogs = sqliteTable(
  'reception_logs',
  {
    id: id(),
    /** 收银单 ID -> cashier_bills.id（0012 起可空：核销改挂时账单未开则挂 appointment_id） */
    billId: text('bill_id').references(() => cashierBills.id),
    /** 预约单 ID -> appointments.id（0012 新增，可空：预约侧核销改挂留痕落点） */
    appointmentId: text('appointment_id').references(() => appointments.id),
    /** 变更前接待人 -> users.id（NULL = 原无接待人） */
    oldReceptionistId: text('old_receptionist_id').references(() => users.id),
    /** 变更后接待人 -> users.id */
    newReceptionistId: text('new_receptionist_id')
      .notNull()
      .references(() => users.id),
    /** 变更操作人 -> users.id */
    changedBy: text('changed_by')
      .notNull()
      .references(() => users.id),
    /** 备注 */
    note: text('note'),
    ...auditColumns,
  },
  (t) => [
    index('ix_reception_logs_bill').on(t.billId),
    index('ix_reception_logs_appointment').on(t.appointmentId),
  ],
);

/**
 * 产能红线批准留痕表（R9 · 0012 新增）：美容师日超 8 只超出部分按 1.5 倍计提
 * 须店长批准——批准落本表（unique(staff_id, date)，重复批准幂等 upsert）；
 * 无批准行的超出部分按 1 倍计提并在提成明细标 pendingApproval（待批准）。
 */
export const overworkApprovals = sqliteTable(
  'overwork_approvals',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 员工 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 批准日期（'YYYY-MM-DD'，产能红线按日判定） */
    date: text('date').notNull(),
    /** 批准人用户 ID -> users.id（店长或老板） */
    approvedBy: text('approved_by')
      .notNull()
      .references(() => users.id),
    /** 备注 */
    note: text('note'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_overwork_approvals_staff_date').on(t.staffId, t.date),
    index('ix_overwork_approvals_store_date').on(t.storeId, t.date),
  ],
);

/* ---- R10 XP ---- */

/**
 * XP 事件表（R10，只增不改）：六来源 attendance/service/review/exam/cover/penalty
 * （referral 拉新置灰——server 拒写+明示「随会员游戏化批开通」，防假功能第三态禁止）。
 * - 日上限 60 仅 channel='daily'；学习通道（exam）单列不占；超限写入 dropped=1 留痕不计分；
 * - 防刷：同客户对员工当日好评只计 1 次（查 reviews）；考试每级每月 1 次（查 source=exam source_id）。
 */
export const xpEvents = sqliteTable(
  'xp_events',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 员工 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 员工用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 来源，取值：attendance | service | review | exam | referral | cover | penalty | application（片 4 申报审核） | revoke_offset（片 4 扣分异议对冲） */
    source: text('source').notNull(),
    /** 来源单据 ID（打卡记录/预约单/评价/考试级别等） */
    sourceId: text('source_id').notNull(),
    /** 分值（正负；差评扣分 −8 扣分不扣款） */
    points: integer('points').notNull(),
    /** 通道，取值：daily（占日上限） | learning（学习通道单列不占） */
    channel: text('channel').notNull(),
    /** 计分所用规则版本（xp_rules.version） */
    ruleVersion: integer('rule_version').notNull(),
    /** 日上限超限丢弃留痕（0/1；dropped=1 不计分） */
    dropped: integer('dropped', { mode: 'boolean' }).notNull().default(false),
    ...auditColumns,
  },
  (t) => [
    index('ix_xp_events_staff_created').on(t.staffId, t.createdAt),
    index('ix_xp_events_store_created').on(t.storeId, t.createdAt),
    index('ix_xp_events_source').on(t.source, t.sourceId),
  ],
);

/**
 * XP 月度结算表（R10）：每月 1 日结算——上月 XP 增量 ≥ 保级线保级，
 * 不足降一级（不降多级），累计 XP 不清零。段位门槛/保级线落 xp_rules。
 */
export const xpLevels = sqliteTable(
  'xp_levels',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 员工 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 结算月份（'YYYY-MM'） */
    month: text('month').notNull(),
    /** 月初累计 XP */
    startXp: integer('start_xp').notNull(),
    /** 当月 XP 增量 */
    gainedXp: integer('gained_xp').notNull(),
    /** 月末累计 XP */
    endXp: integer('end_xp').notNull(),
    /** 结算前段位序号（0=嫩芽 1=熟手 2=能手 3=掌柜 4=导师） */
    levelBefore: integer('level_before').notNull(),
    /** 结算后段位序号（同上） */
    levelAfter: integer('level_after').notNull(),
    /** 是否保级（0/1；不足保级线降一级） */
    retained: integer('retained', { mode: 'boolean' }).notNull(),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_xp_levels_staff_month').on(t.staffId, t.month),
    index('ix_xp_levels_store_month').on(t.storeId, t.month),
  ],
);

/**
 * XP 规则配置表（R10 · 结构同 commission_rules）：种子=附件一冻结版 V1.0
 * （六来源分值 5/2/6/3/30/50/80/15/−8、日上限 60、段位门槛 0/300/900/2000/4000、
 * 保级线 150/300/500/700、考试月限 1、好评日限 1、拉新置灰 active=0）。
 */
export const xpRules = sqliteTable(
  'xp_rules',
  {
    id: id(),
    /** 规则版本（初始种子 =1） */
    version: integer('version').notNull(),
    /** 规则键（如 xp_attendance_daily / xp_level_threshold_1） */
    ruleKey: text('rule_key').notNull(),
    /** 规则中文名（配置页展示） */
    label: text('label').notNull(),
    /** 规则值 JSON（分值/上限/门槛/保级线），结构见 RuleConfigValue */
    valueJson: text('value_json', { mode: 'json' }).$type<RuleConfigValue>().notNull(),
    /** 生效时间 */
    effectiveFrom: integer('effective_from', { mode: 'timestamp' }).notNull(),
    /** 是否生效（0/1；置灰来源 =0） */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** 创建/变更人用户 ID -> users.id */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_xp_rules_key_active').on(t.ruleKey, t.active)],
);

/* ---- R10 最小评价域 ---- */

/**
 * 评价表（R10 最小评价域）：既有 appointment.review mutation 扩展写入（幂等不变），
 * 触发 XP（5 星+6 / 4 星+3 / ≤2 星 −8 扣分不扣款）+ ≤2 星 emit 店长频道差评提示事件。
 * 一句话评价 ≤140 字（应用层约束）；匿名评价同权计分。
 */
export const reviews = sqliteTable(
  'reviews',
  {
    id: id(),
    /** 预约单 ID -> appointments.id（一单一评，唯一） */
    appointmentId: text('appointment_id')
      .notNull()
      .references(() => appointments.id),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 评价客户用户 ID -> users.id */
    customerId: text('customer_id')
      .notNull()
      .references(() => users.id),
    /** 操作美容师 ID -> staff.id */
    staffId: text('staff_id')
      .notNull()
      .references(() => staff.id),
    /** 评分（1-5） */
    rating: integer('rating').notNull(),
    /** 评价内容（可空，≤140 字一句话） */
    text: text('text'),
    /** 是否匿名（0/1，匿名同权计分） */
    anonymous: integer('anonymous', { mode: 'boolean' }).notNull().default(false),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_reviews_appointment').on(t.appointmentId),
    index('ix_reviews_staff_created').on(t.staffId, t.createdAt),
    index('ix_reviews_store_created').on(t.storeId, t.createdAt),
    index('ix_reviews_customer_staff_created').on(t.customerId, t.staffId, t.createdAt),
  ],
);

/* ---- R9-F 规则配置版本 ---- */

/**
 * 规则配置版本表（R9-F 配置端口留痕）：老板端配置页保存=事务——旧 active 行失效
 * → 新行 active=1 version+1 effective_from=now + 本表一行（每 key 前后值数组）。
 * 仅 merchantOwnerProcedure；新规只管生效后的单，不回溯历史月份。
 */
export const ruleConfigVersions = sqliteTable(
  'rule_config_versions',
  {
    id: id(),
    /** 配置域，取值：commission | xp | duration（补充令①） | refund（R12） | member_plans（R11a）
     *  | service（补缺大批片 4） | pay（批次 6） | copy（端口批片 B 文案端口，CJ-1002-01） */
    domain: text('domain').notNull(),
    /** 保存后的新版本号 */
    version: integer('version').notNull(),
    /** 变更人用户 ID -> users.id（仅老板） */
    changedBy: text('changed_by')
      .notNull()
      .references(() => users.id),
    /** 变更明细 JSON（每 key 前后值数组），结构见 RuleConfigChanges */
    changesJson: text('changes_json', { mode: 'json' }).$type<RuleConfigChanges>().notNull(),
    ...auditColumns,
  },
  (t) => [index('ix_rule_config_versions_domain').on(t.domain, t.version)],
);

/* ------------------------------------------------------------------ */
/* 5.4d 退款（批次 R12 退款专项 · 冻结版 V1.0，老板会签 CJ-0921-23）        */
/* ------------------------------------------------------------------ */

/**
 * 退款单头表（R12 §一）。纲：退款 ≠ 反结账——反结账既有逻辑一行不动（错单纠正，
 * 不计当日已收）；退款=经营行为计退款单列，原单已收不涂改，当日净额=已收−退款。
 * - 原单永存不涂改：cashier_bills 仅挂 refund_status/refund_bill_no 标记，内容一字不改；
 * - biz_date=执行日（V7 跨日口径：计入发生日日结，不回填已封箱历史日结）；
 * - linkage_json=六联动快照（含 rebate_clawback_fen 列位默认 0——回馈金未上线 R11，
 *   冻结规则+R11 回归；快照另含支付段回补/库存回补/储值次卡回补/提成冲减明细）；
 * - 状态机：draft→executed（账已联动，不可撤销）→settled（实退完成）；rejected=驳回留痕。
 */
export const refundBills = sqliteTable(
  'refund_bills',
  {
    id: id(),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 退款单号（全局唯一，幂等键）：RB-yyyymmdd-NNN（日序，同既有单号发生器口径） */
    refundNo: text('refund_no').notNull(),
    /** 执行日（YYYY-MM-DD；V7：跨日退款计入发生日日结，不回填封箱历史） */
    bizDate: text('biz_date').notNull(),
    /** 原收银单 ID -> cashier_bills.id（原单永存不涂改，仅挂标记） */
    billId: text('bill_id')
      .notNull()
      .references(() => cashierBills.id),
    /** 退款类型，取值：full 全额 | partial_items 按行 | partial_amount 按金额 | boarding_nights 寄养剩余晚 | pass_cancel 次卡退卡 */
    type: text('type').notNull(),
    /** 本次退款总额（分） */
    amountFen: integer('amount_fen').notNull(),
    /** 退款原因（必填，红线 3） */
    reason: text('reason').notNull(),
    /** 状态，取值：draft | executed | settled | rejected（executed 后不可撤销，纠错=再开正单） */
    status: text('status').notNull().default('draft'),
    /**
     * 六联动快照 JSON（执行时落；含 rebate_clawback_fen 列位默认 0——回馈金未上线 R11
     * 冻结列位，R11 生效按冻结规则回归）。NULL = draft 未执行。
     */
    linkageJson: text('linkage_json', { mode: 'json' }).$type<RuleConfigValue>(),
    /** 实退方式（可空）：offline_original 内测期线下原路 | to_stored_value 退储值账户（次卡退卡二选一必选） */
    refundMethod: text('refund_method'),
    /** 实退完成时间（NULL = 未登记实退；超 24h 未登记进店长待办提醒） */
    settledAt: integer('settled_at', { mode: 'timestamp' }),
    /** 实退备注 */
    settleNote: text('settle_note'),
    /** 发起/执行人用户 ID -> users.id */
    operatorId: text('operator_id')
      .notNull()
      .references(() => users.id),
    /** 审批人用户 ID -> users.id（超阈值/涉储值=店主批；店长自批单发起即执行 approver=本人；NULL=draft 未批） */
    approverId: text('approver_id').references(() => users.id),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_refund_bills_refund_no').on(t.refundNo),
    index('ix_refund_bills_store_bizdate').on(t.storeId, t.bizDate),
    index('ix_refund_bills_bill').on(t.billId),
    index('ix_refund_bills_status').on(t.status),
  ],
);

/**
 * 退款明细表（R12 §一）：按行/按段退明细——行退挂 bill_item_id，支付段回补挂
 * payment_id，寄养剩余晚/次卡退卡折算挂 detail_json（分摊占比/晚数等），回补额精确到分。
 */
export const refundBillItems = sqliteTable(
  'refund_bill_items',
  {
    id: id(),
    /** 退款单 ID -> refund_bills.id */
    refundId: text('refund_id')
      .notNull()
      .references(() => refundBills.id),
    /** 原单行 ID -> cashier_bill_items.id（按行退的行；按金额/寄养晚退可空） */
    billItemId: text('bill_item_id').references(() => cashierBillItems.id),
    /** 支付段 ID -> cashier_payments.id（支付段回补行；非段回补可空） */
    paymentId: text('payment_id').references(() => cashierPayments.id),
    /** 明细类型，取值：item 按行 | segment 支付段 | night 寄养剩余晚 | pass 次卡退卡 */
    kind: text('kind').notNull(),
    /** 数量（按行退商品行 qty；其余可空） */
    qty: integer('qty'),
    /** 该行/段回补额（分，精确到分） */
    amountFen: integer('amount_fen').notNull(),
    /** 明细 JSON（分摊占比/晚数/折算口径等，可空） */
    detailJson: text('detail_json', { mode: 'json' }).$type<RuleConfigValue>(),
    ...auditColumns,
  },
  (t) => [index('ix_refund_bill_items_refund').on(t.refundId)],
);

/**
 * 退款规则配置表（R12 §一，同构 commission_rules）：种子 version=1 一行
 * refund_threshold_fen（店长累计阈值，按原单累计校验·V1，默认 ¥500=50000 分，
 * 冻结版 §九待老板终拍口径）。配置端口第四域 domain='refund'，保存即生效+版本化留痕。
 */
export const refundRules = sqliteTable(
  'refund_rules',
  {
    id: id(),
    /** 规则版本（初始种子 =1） */
    version: integer('version').notNull(),
    /** 规则键（如 refund_threshold_fen） */
    ruleKey: text('rule_key').notNull(),
    /** 规则中文名（配置页展示） */
    label: text('label').notNull(),
    /** 规则值 JSON（阈值分等），结构见 RuleConfigValue */
    valueJson: text('value_json', { mode: 'json' }).$type<RuleConfigValue>().notNull(),
    /** 生效时间（按此取规则版本；新规只管生效后的单） */
    effectiveFrom: integer('effective_from', { mode: 'timestamp' }).notNull(),
    /** 是否生效（0/1） */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** 创建/变更人用户 ID -> users.id */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_refund_rules_key_active').on(t.ruleKey, t.active)],
);

/* ------------------------------------------------------------------ */
/* 5.6c 客户退款申请（C5 批次 · 客户端退款申请实体 + 审批缝）                 */
/* ------------------------------------------------------------------ */

/** 退款申请行项快照（按行退的行；全额退存空数组，明细由 R12 内核全量处理） */
export type RefundRequestItem = { itemId: string; label: string; amountFen: number };

/** 退款申请时间线条目（状态推进留痕，at=ISO 时间串） */
export type RefundRequestTimelineEntry = { status: string; at: string; note?: string };

/**
 * 客户退款申请表（C5 批次）：客户端发起 → 商家审批 → 复用 R12 内核生成退款单。
 *
 * - 单号 request_no：RR-{YYYYMMDD}-{当日 3 位序号}（日序发生器仿 refund genRefundNo
 *   口径，全局唯一靠 UNIQUE 索引 + 收银写锁串行分配）。
 * - order_kind 双源：appointment=到店收银单（cashier_bills，预约/商品/混合单）；
 *   order=商城订单（orders）。bill_id 因双源不加外键（appointment→cashier_bills.id，
 *   order→orders.id），bill_no 冗余存原单号（HD-… / P…）供展示与 R12 内核入参。
 * - 状态机：submitted→approved→refunded→settled；侧支 rejected（驳回留痕）/
 *   cancelled（客户撤回）。到店单批准直通 R12 execute 时直接落 refunded
 *   （已批准且已生成退款单=退款中），settleActual 实退登记后联动 settled；
 *   商城单无 R12 挂接（refund_bills.bill_id NOT NULL→cashier_bills 红线），
 *   批准落 approved + orders.status='refunding'，线下原路办理。
 * - 幂等：同 (customer_id, bill_id) 有在途单（submitted/approved/refunded）→
 *   create 返回现状不新建；approve/reject/cancel 重复调用返回 idempotent=true。
 * - reapplied_after_days：退后重购留痕——同客户同原单再次申请时，填与上次
 *   settled 申请单的间隔天数（不拦截，纯留痕）。
 */
export const refundRequests = sqliteTable(
  'refund_requests',
  {
    id: id(),
    /** 申请单号（全局唯一，幂等键）：RR-yyyymmdd-NNN（日序，同 refund_bills 发生器口径） */
    requestNo: text('request_no').notNull(),
    /** 客户用户 ID -> users.id */
    customerId: text('customer_id')
      .notNull()
      .references(() => users.id),
    /** 门店 ID -> stores.id */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 原单类型，取值：appointment 到店收银单（cashier_bills） | order 商城订单（orders） */
    orderKind: text('order_kind').notNull(),
    /** 原单 ID（双源不加 FK：appointment→cashier_bills.id | order→orders.id） */
    billId: text('bill_id').notNull(),
    /** 原单号冗余（HD-… / P…，展示 + R12 execute 入参） */
    billNo: text('bill_no').notNull(),
    /** 退款类型，取值：refund_only 仅退款 | return_refund 退货退款（到店单强制 refund_only） */
    type: text('type').notNull(),
    /** 退款原因码（固定 6 码族；label 随端口枚举 refund_reason_options 位置取值） */
    reasonCode: text('reason_code').notNull(),
    /** 退款原因文案（申请时端口枚举快照，端口后改不回溯） */
    reasonLabel: text('reason_label').notNull(),
    /** 补充说明（reasonCode=other 时必填） */
    description: text('description'),
    /** 凭证图片 URL 数组（客户端先经 POST /api/upload relDir=refund/<requestId> 上传） */
    photoUrls: text('photo_urls', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    /** 申请金额（分）=行合计（按行退）或可退余额全量（全额退），≤原单可退余额 */
    amountFen: integer('amount_fen').notNull(),
    /** 行项快照（按行退：[{itemId,label,amountFen}]；全额退：[]，明细由 R12 内核全量处理） */
    itemsJson: text('items_json', { mode: 'json' })
      .$type<RefundRequestItem[]>()
      .notNull()
      .default(sql`'[]'`),
    /** 状态，取值：submitted | approved | refunded | settled | rejected | cancelled */
    status: text('status').notNull().default('submitted'),
    /** 时间线留痕 [{status,at,note?}]（提交/批准/退款中/实退/驳回/撤回逐条追加） */
    timelineJson: text('timeline_json', { mode: 'json' })
      .$type<RefundRequestTimelineEntry[]>()
      .notNull()
      .default(sql`'[]'`),
    /** 审批人用户 ID -> users.id（NULL=未审批） */
    approverId: text('approver_id').references(() => users.id),
    /** 审批时间（NULL=未审批） */
    approvedAt: integer('approved_at', { mode: 'timestamp' }),
    /** 驳回理由（驳回必填，客户端可见；NULL=未驳回） */
    rejectReason: text('reject_reason'),
    /** 关联 R12 退款单号（批准直通 execute 后回挂；商城单恒 NULL=线下原路） */
    refundBillNo: text('refund_bill_no'),
    /** 退后重购留痕：与上次 settled 申请单的间隔天数（NULL=首次申请；不拦截） */
    reappliedAfterDays: integer('reapplied_after_days'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_refund_requests_request_no').on(t.requestNo),
    index('ix_refund_requests_customer').on(t.customerId),
    index('ix_refund_requests_store_status').on(t.storeId, t.status),
    index('ix_refund_requests_bill').on(t.billId),
  ],
);

/* ------------------------------------------------------------------ */
/* 5.7 会员（批次 R11a 会员前置批·骨架批 · 冻结版 V1.0，CJ-0922-12/-13）     */
/* ------------------------------------------------------------------ */

/**
 * 会员档位配置表（R11a §一，同构 commission_rules，配置端口第四+域 domain='member_plans'）：
 * 种子 version=1——四档（微光 free / 萤火 199·2%·88折 / 烛光 299·5%·85折 / 暖阳 599·10%·8折，
 * 多宠全档统一：含 3 只、第 4 只起 +¥59/年/只、10 只封顶）+ 回馈金次月 5 日到账 /
 * 回馈金有效期 365 天 / 会员有效期 365 天。保存即生效+版本化留痕，新值只管新单不回溯。
 */
export const memberPlans = sqliteTable(
  'member_plans',
  {
    id: id(),
    /** 规则版本（初始种子 =1） */
    version: integer('version').notNull(),
    /** 规则键（plan_weiguang/plan_yinghuo/plan_zhuguang/plan_nuanyang/rebate_settlement_day/rebate_validity_days/membership_validity_days） */
    ruleKey: text('rule_key').notNull(),
    /** 规则中文名（配置页展示） */
    label: text('label').notNull(),
    /** 规则值 JSON（档位价格/回馈 bp/折扣 bp/多宠参数/天数），结构见 RuleConfigValue */
    valueJson: text('value_json', { mode: 'json' }).$type<RuleConfigValue>().notNull(),
    /** 生效时间（按此取规则版本；新规只管生效后的单） */
    effectiveFrom: integer('effective_from', { mode: 'timestamp' }).notNull(),
    /** 是否生效（0/1） */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** 创建/变更人用户 ID -> users.id */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_member_plans_key_active').on(t.ruleKey, t.active)],
);

/**
 * 会员实例表（R11a §一）：一行=一个用户的一张有效年卡。
 * - 微光自助开档 sold_store_id=NULL（或注册店）；付费三档售卡单 sold_store=bill.store_id
 *   （决策 #41 双归属：售卡店=sold_store，消费店=cashier_bills.store_id，注释写死口径）；
 * - expires_at=开通日+membership_validity_days（默认 365 天），开通时算定不重算；
 * - 到期冻结 status='frozen'（回馈金余额在不可用）/续费解冻/退会 cancelled+清零留痕
 *   （cancelled_at/cancel_reason/refund_fen=剩余整月×月均价折算，精确到分）。
 */
export const memberships = sqliteTable(
  'memberships',
  {
    id: id(),
    /** 会员用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 档位键（plan_weiguang/plan_yinghuo/plan_zhuguang/plan_nuanyang -> member_plans.rule_key） */
    planKey: text('plan_key').notNull(),
    /** 办卡门店 ID -> stores.id（微光自助开档=NULL 或注册店；付费档=售卡单消费店） */
    soldStoreId: text('sold_store_id').references(() => stores.id),
    /** 开通时间 */
    startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
    /** 到期时间（=开通日+365 天，开通时算定不重算） */
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    /** 状态，取值：active | frozen（到期冻结） | cancelled（退会） */
    status: text('status').notNull().default('active'),
    /** 名下宠物数（多宠附加费口径：含 3 只，第 4 只起 +¥59/年/只，10 只封顶） */
    petCount: integer('pet_count').notNull().default(0),
    /** 实付（分，多宠附加费含） */
    paidFen: integer('paid_fen').notNull().default(0),
    /** 退会时间（NULL=未退会） */
    cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
    /** 退会原因 */
    cancelReason: text('cancel_reason'),
    /** 退会折算退款额（分；剩余整月×月均价，CJ-0922-13 口径） */
    refundFen: integer('refund_fen'),
    /**
     * 预约下期档位键（补缺-3 · 46 号档+PD-07 到期换档，NULL=未预约）：
     * 到期前 member_change_window_days 天（端口默认 30）内可预约任意档；
     * renew 事务起读本列非空 → 按预约档全价收款+切档+置空（执行幂等）。
     */
    nextPlanKey: text('next_plan_key'),
    /** 预约落位时间（最后一次预约/覆盖时间；随 next_plan_key 同置同清） */
    nextPlanSetAt: integer('next_plan_set_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [index('ix_memberships_user_status').on(t.userId, t.status)],
);

/**
 * 会员事件留痕表（补缺-3 · 46 号档+PD-07，只增不改审计账）：
 * - type='upgrade'：期内升档/微光新购口径升档（fromPlan/toPlan/diffFen=补差分/billNo=升级补差单号）；
 * - type='change_schedule'：到期换档预约/覆盖/取消/到期执行（meta.cancelled=true 取消；
 *   meta.executed=true 到期 renew 执行落档）；
 * - type='cancel_rebuy_note'：防滥用留痕（退会后 member_cancel_cooldown_days 天内重购 /
 *   累计退会≥member_cancel_count_threshold 再购；只留痕不拦截，meta 记距上次退会天数/累计次数）。
 */
export const membershipEvents = sqliteTable(
  'membership_events',
  {
    id: id(),
    /** 会员用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 事件类型，取值：upgrade | change_schedule | cancel_rebuy_note */
    type: text('type').notNull(),
    /** 原档位键（cancel_rebuy_note 重购留痕为 NULL） */
    fromPlan: text('from_plan'),
    /** 目标档位键（取消预约事件为 NULL） */
    toPlan: text('to_plan'),
    /** 补差价（分；仅 upgrade 有值，微光新购口径=新档全价含附加） */
    diffFen: integer('diff_fen'),
    /** 关联收银单号（升级补差单 / 换档执行续费单 / 重购售卡单；可空） */
    billNo: text('bill_no'),
    /** 扩展留痕 JSON（公式明面/executed/cancelled/daysSinceLastCancel/cancelCount 等） */
    meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>(),
    ...auditColumns,
  },
  (t) => [index('ix_membership_events_user_created').on(t.userId, t.createdAt)],
);

/**
 * 回馈金余额表（R11a §一）：余额只反映已到账（grant 统一次月 5 日到账，见 rebate_settlements）；
 * 三本账物理分离，永不计营业额（与储值/XP 同红线）。
 */
export const rebateAccounts = sqliteTable(
  'rebate_accounts',
  {
    id: id(),
    /** 会员用户 ID -> users.id（一人一本） */
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    /** 可用余额（分；仅已到账期次合计） */
    balanceFen: integer('balance_fen').notNull().default(0),
    /** 状态，取值：active | frozen（会员到期冻结，余额在不可用） */
    status: text('status').notNull().default('active'),
    ...auditColumns,
  },
);

/**
 * 回馈金流水表（R11a §一，五类）：grant 发放（挂期次，次月到账）/ deduct 抵扣（仅商品行，
 * 1:1 扣已到账余额）/ clawback 扣回（R12 退款联动，余额不足扣 0 不负账，差额记未扣回）/
 * freeze 冻结 / clear 清零（退会）。前后余额+来源单号全留痕。
 */
export const rebateLogs = sqliteTable(
  'rebate_logs',
  {
    id: id(),
    /** 会员用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 回馈金账户 ID -> rebate_accounts.id */
    accountId: text('account_id')
      .notNull()
      .references(() => rebateAccounts.id),
    /** 流水类型，取值：grant 发放 | deduct 抵扣 | clawback 扣回 | freeze 冻结 | clear 清零 */
    type: text('type').notNull(),
    /** 变动额（分，正负） */
    deltaFen: integer('delta_fen').notNull(),
    /** 变动前余额（分；grant 未到账期余额不动，before=after） */
    beforeFen: integer('before_fen').notNull(),
    /** 变动后余额（分） */
    afterFen: integer('after_fen').notNull(),
    /** 来源单号（订单/账单/退款单/期次批次） */
    sourceId: text('source_id').notNull(),
    /** 期次（'YYYY-MM'，grant 挂期次统一次月到账；其余可空） */
    period: text('period'),
    /** 结算批次 ID -> rebate_settlements.id（grant 入账批次回链；未结算可空） */
    settlementId: text('settlement_id').references(() => rebateSettlements.id),
    /** 备注 */
    note: text('note'),
    ...auditColumns,
  },
  (t) => [
    index('ix_rebate_logs_user_created').on(t.userId, t.createdAt),
    index('ix_rebate_logs_period').on(t.period),
  ],
);

/**
 * 回馈金月度结算批次表（R11a §一）：每月 5 日（rebate_settlement_day 可调，故障顺延≤3 天
 * 页面明示）把上一期次 grant 行汇总入账——一批次一行，余额入账前后值落在 rebate_logs。
 */
export const rebateSettlements = sqliteTable(
  'rebate_settlements',
  {
    id: id(),
    /** 结算期次（'YYYY-MM'，唯一——一期一批，幂等） */
    period: text('period').notNull(),
    /** 本批入账笔数（grant 行数） */
    grantedCount: integer('granted_count').notNull(),
    /** 本批入账总额（分） */
    grantedFen: integer('granted_fen').notNull(),
    /** 计划结算日（该月几号，快照 rebate_settlement_day 当时值） */
    scheduledDay: integer('scheduled_day').notNull(),
    /** 实际执行时间（故障顺延留痕） */
    executedAt: integer('executed_at', { mode: 'timestamp' }),
    /** 状态，取值：done（一期完成恒 done；批次行存在即已执行） */
    status: text('status').notNull().default('done'),
    /** 备注 */
    note: text('note'),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_rebate_settlements_period').on(t.period)],
);

/* ------------------------------------------------------------------ */
/* 5.8 服务闭环补缺（补缺大批片 4 · server 侧）：证书/报告/工单/发票/服务规则  */
/* ------------------------------------------------------------------ */

/** 安心证书快照载荷（service_certificates.payload） */
export type CertificatePayload = {
  petName: string;
  serviceName: string;
  storeName: string;
  /** 服务完成时间（ISO 串） */
  completedAt: string;
  /** 六步汇总（步骤 label + 有效照片计数，照片口径=invalidated_at IS NULL） */
  stepsSummary: Array<{ stepKey: string; label: string; photoCount: number }>;
  /** 交付检查步 before/after 各取最新一张有效图 */
  beforeUrl: string;
  afterUrl: string;
};

/** 美容报告体征项（service_reports.vitals 元素；status: normal | attention | abnormal |
 *  unrecorded——补缺修复小批 UX 销项：未录入缺省项=unrecorded 中性签，不再挂「正常」） */
export type ReportVital = {
  key: 'weight' | 'skin' | 'ear' | 'coat' | 'nail';
  label: string;
  value: string;
  status: 'normal' | 'attention' | 'abnormal' | 'unrecorded';
  note?: string;
};

/** 工单时间线条目（support_tickets.timeline_json 元素） */
export type TicketTimelineItem = {
  /** 动作，取值：submitted | replied | closed */
  action: string;
  /** 动作时间（ISO 串） */
  at: string;
  /** 操作人用户 ID */
  by: string;
  /** 附注（回复内容等） */
  note?: string;
};

/**
 * 安心证书表（补缺大批片 4）：一单一证（appointment_id 唯一）。
 * 生成落点=serviceStep.confirmStep 末步三合一事务内（与预约 completed 同事务）；
 * R10 无数据不生成：交付检查步无有效 before/after 图则不落行（读侧 404 明文）。
 * deliveredAt=客户端首读时间（certificates 读口幂等置位，NULL=未读）。
 */
export const serviceCertificates = sqliteTable(
  'service_certificates',
  {
    id: id(),
    /** 预约单 ID -> appointments.id（一单一证） */
    appointmentId: text('appointment_id')
      .notNull()
      .unique()
      .references(() => appointments.id),
    /** 客户用户 ID -> users.id（冗余列，本人列表免 join） */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 证书快照 JSON，结构见 CertificatePayload */
    payload: text('payload', { mode: 'json' }).$type<CertificatePayload>().notNull(),
    /** 生成时间（= 末步完成同事务时点） */
    generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
    /** 客户端首读时间（NULL = 未读；读口幂等置位） */
    deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [index('ix_service_certificates_user').on(t.userId, t.createdAt)],
);

/**
 * 美容报告表（补缺大批片 4）：一单一报（appointment_id 唯一）。
 * 生成落点同证书（confirmStep 末步同事务）；报告恒生成——员工端报告卡 vitals
 * 缺省时各项 status='unrecorded'（未记录中性签）+ note='本次未记录'（补缺修复小批 UX 销项：
 * 缺项不再挂「正常」；留痕口径不阻塞完成）；体重项恒为 pets.weight_kg 服务端快照（不信客户端输入值）。
 */
export const serviceReports = sqliteTable(
  'service_reports',
  {
    id: id(),
    /** 预约单 ID -> appointments.id（一单一报） */
    appointmentId: text('appointment_id')
      .notNull()
      .unique()
      .references(() => appointments.id),
    /** 客户用户 ID -> users.id（冗余列，本人列表免 join） */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 体征快照 JSON 数组，结构见 ReportVital（五项：weight/skin/ear/coat/nail） */
    vitals: text('vitals', { mode: 'json' }).$type<ReportVital[]>().notNull(),
    /** 异常项拼句（任一 status≠normal 时生成；NULL=全正常） */
    abnormalText: text('abnormal_text'),
    /** 下次护理建议（员工端报告卡输入，可空） */
    nextAdvice: text('next_advice'),
    /** 生成时间（= 末步完成同事务时点） */
    generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
    /** 客户端首读时间（NULL = 未读；读口幂等置位） */
    deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [index('ix_service_reports_user').on(t.userId, t.createdAt)],
);

/**
 * 客服工单表（补缺大批片 4）：客户提单（建议/投诉/表扬/其他）→ 本店店长/店主回复。
 * ticket_no=TK-yyyymmdd-NNN（日序，全局唯一，与 HD/RB 单号发生器同口径）；
 * 状态机：submitted → replied → closed；timeline_json 全留痕（只增不改）。
 * photo_urls 为上传图 URL 列表（JSON 数组），已纳入 storage/cleanup 孤儿回收白名单。
 */
export const supportTickets = sqliteTable(
  'support_tickets',
  {
    id: id(),
    /** 工单号（全局唯一，幂等键）：TK-yyyymmdd-NNN */
    ticketNo: text('ticket_no').notNull().unique(),
    /** 提单客户用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 关联门店 ID -> stores.id（提单时选定的门店；店长待办按本店过滤） */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 工单类型，取值：suggest | complaint | praise | other | staff_voice（员工心声，片 3 B6-4 同族留痕） */
    type: text('type').notNull(),
    /** 问题描述 */
    description: text('description').notNull(),
    /** 附图 URL 列表 JSON */
    photoUrls: text('photo_urls', { mode: 'json' }).$type<string[]>().notNull().default([]),
    /** 提单通道：customer（客户端）| staff（员工心声，片 3） */
    createdVia: text('created_via').notNull().default('customer'),
    /** 联系方式（缺省回显=users.phone，客户端可改） */
    contactPhone: text('contact_phone'),
    /** 状态，取值：submitted | replied | closed */
    status: text('status').notNull().default('submitted'),
    /** 回复内容（NULL = 未回复） */
    replyText: text('reply_text'),
    /** 回复人用户 ID -> users.id（owner|manager） */
    repliedBy: text('replied_by').references(() => users.id),
    /** 回复时间 */
    repliedAt: integer('replied_at', { mode: 'timestamp' }),
    /** 时间线 JSON 数组（只增不改），结构见 TicketTimelineItem */
    timelineJson: text('timeline_json', { mode: 'json' }).$type<TicketTimelineItem[]>().notNull(),
    ...auditColumns,
  },
  (t) => [
    index('ix_support_tickets_store_status').on(t.storeId, t.status),
    index('ix_support_tickets_user').on(t.userId, t.createdAt),
  ],
);

/**
 * 发票申请表（补缺大批片 4）：客户对已付单据申请开票 → 本店店长/店主登记发票号。
 * invoice_no=IN-yyyymmdd-NNN（日序，全局唯一）；order_kind 三类来源：
 * appointment（appointments.paid_fen>0）/ cashier（settled 且未冲正）/ order（paid 及之后）；
 * 金额=服务端按来源单实付重算（不信任入参金额）；同单在途（submitted）重复申请幂等返回原单。
 * 状态机：submitted → issued（issued_invoice_no=实际发票号，register 登记）。
 */
export const invoiceRequests = sqliteTable(
  'invoice_requests',
  {
    id: id(),
    /** 申请单号（全局唯一，幂等键）：IN-yyyymmdd-NNN */
    invoiceNo: text('invoice_no').notNull().unique(),
    /** 申请客户用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 门店 ID -> stores.id（来源单所属店；店长待办按本店过滤） */
    storeId: text('store_id')
      .notNull()
      .references(() => stores.id),
    /** 来源单类型，取值：appointment | order | cashier */
    orderKind: text('order_kind').notNull(),
    /** 来源单 ID：appointments.id / orders.id / cashier_bills.id（按 order_kind 解释） */
    billId: text('bill_id').notNull(),
    /** 来源单号快照（预约码 / 订单号 / 收银单号） */
    billNo: text('bill_no').notNull(),
    /** 开票金额（分）= 来源单实付，服务端重算 */
    amountFen: integer('amount_fen').notNull(),
    /** 抬头类型，取值：personal | business（business 必填 tax_no；personal 置空） */
    titleType: text('title_type').notNull(),
    /** 发票抬头 */
    title: text('title').notNull(),
    /** 税号（仅 business；personal 恒 NULL） */
    taxNo: text('tax_no'),
    /** 交付方式，取值：email | pickup（email 必填邮箱） */
    delivery: text('delivery').notNull(),
    /** 接收邮箱（仅 delivery=email；pickup 恒 NULL） */
    email: text('email'),
    /** 状态，取值：submitted | issued */
    status: text('status').notNull().default('submitted'),
    /** 实际发票号（商家登记；NULL = 未开） */
    issuedInvoiceNo: text('issued_invoice_no'),
    /** 开票登记时间 */
    issuedAt: integer('issued_at', { mode: 'timestamp' }),
    /** 开票登记人用户 ID -> users.id（owner|manager） */
    issuedBy: text('issued_by').references(() => users.id),
    ...auditColumns,
  },
  (t) => [
    index('ix_invoice_requests_store_status').on(t.storeId, t.status),
    index('ix_invoice_requests_user').on(t.userId, t.createdAt),
    index('ix_invoice_requests_bill').on(t.orderKind, t.billId),
  ],
);

/* ------------------------------------------------------------------ */
/* 批次 R13a 账号安全（注销 / 换绑 / 申诉 / 设备登记）                       */
/* ------------------------------------------------------------------ */

/** 申诉/审批时间线条目：{ at: ISO 时间, action, by?, note? }（只增追加） */
export type AppealTimelineEntry = { at: string; action: string; by?: string; note?: string };

/** 注销阻断校验快照条目（deactivation_requests.checklist_json） */
export type DeactivationChecklistItem = {
  kind: 'appointment' | 'order' | 'refund';
  label: string;
  count: number;
};

/**
 * 手机验证码表（批次 R13a · 0017）：换绑双因子验证码。
 * - code 只存 sha256(code+phone+purpose+salt) 哈希，绝不落明文；
 * - expiry 为 ms epoch（本表特例，与全库 Unix 秒 timestamp 列不同——短时效毫秒口径）；
 * - 一次性：验证通过置 used_at；attempts≤5 防爆破（服务端计数）。
 */
export const verificationCodes = sqliteTable(
  'verification_codes',
  {
    id: id(),
    /** 目标手机号（明文——发送/校验必需；透出侧一律走 maskPhone） */
    phone: text('phone').notNull(),
    /** 用途，取值：change_bind_old（原号验证） | change_bind_new（新号验证） */
    purpose: text('purpose').notNull(),
    /** 验证码哈希（sha256(code+phone+purpose+salt)，salt 为仓内常量，内测口径） */
    codeHash: text('code_hash').notNull(),
    /** 过期时间（ms epoch，10 分钟有效） */
    expiry: integer('expiry').notNull(),
    /** 已尝试次数（≤5） */
    attempts: integer('attempts').notNull().default(0),
    /** 使用时间（一次性；NULL=未使用） */
    usedAt: integer('used_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [index('ix_verification_codes_phone_purpose').on(t.phone, t.purpose)],
);

/**
 * 换绑申诉单表（批次 R13a · 0017）：原号不可用时的门店协助换绑通道。
 * - request_no 日序单号 PC-yyyymmdd-NNN（门店规范时区 +8）；
 * - 留痕列只存脱敏号（old/new_phone_masked）；**new_phone 明文列=审批通过时
 *   写 users.phone 的执行载荷**（报备项：无此列审批无法落新号；透出/日志全 masked）；
 * - timeline_json 只增追加（submitted/approved/rejected 各节点）。
 */
export const phoneChangeRequests = sqliteTable(
  'phone_change_requests',
  {
    id: id(),
    /** 申诉单号（全局唯一，PC-yyyymmdd-NNN 日序号） */
    requestNo: text('request_no').notNull().unique(),
    /** 申请人用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 原手机号（脱敏 138****0000） */
    oldPhoneMasked: text('old_phone_masked').notNull(),
    /** 新手机号（脱敏） */
    newPhoneMasked: text('new_phone_masked').notNull(),
    /** 新手机号明文（审批执行载荷；仅服务端使用，透出侧一律 masked——见表头注） */
    newPhone: text('new_phone').notNull(),
    /** 证明材料照片 URL 数组 JSON */
    photoUrls: text('photo_urls', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    /** 申诉说明 */
    note: text('note'),
    /** 状态，取值：submitted | approved | rejected */
    status: text('status').notNull().default('submitted'),
    /** 时间线 JSON（AppealTimelineEntry[]，只增追加） */
    timelineJson: text('timeline_json', { mode: 'json' }).$type<AppealTimelineEntry[]>().notNull(),
    /** 审批人用户 ID -> users.id */
    approverId: text('approver_id').references(() => users.id),
    /** 审批时间 */
    decidedAt: integer('decided_at', { mode: 'timestamp' }),
    /** 审批备注（reject 必填，客户端可见） */
    decideNote: text('decide_note'),
    ...auditColumns,
  },
  (t) => [
    index('ix_phone_change_requests_user').on(t.userId),
    index('ix_phone_change_requests_status').on(t.status),
  ],
);

/**
 * 换绑留痕表（批次 R13a · 0017）：只增不改审计行。
 * channel=self（本人双码自助换绑） | assisted（门店申诉协助换绑，operator_id=审批人）。
 * 手机号全列脱敏存储。
 */
export const phoneChangeLogs = sqliteTable(
  'phone_change_logs',
  {
    id: id(),
    /** 换绑用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 原手机号（脱敏） */
    oldPhoneMasked: text('old_phone_masked').notNull(),
    /** 新手机号（脱敏） */
    newPhoneMasked: text('new_phone_masked').notNull(),
    /** 通道，取值：self | assisted */
    channel: text('channel').notNull(),
    /** 操作人用户 ID（assisted=审批人；self=NULL） */
    operatorId: text('operator_id'),
    /** 换绑发生时间 */
    at: integer('at', { mode: 'timestamp' }).notNull(),
    ...auditColumns,
  },
  (t) => [index('ix_phone_change_logs_user').on(t.userId)],
);

/**
 * 用户设备登记表（批次 R13a · 0017）：客户端登录后静默登记一次；
 * (user_id, device_id) 唯一幂等 upsert，last_seen_at 刷新。
 */
export const userDevices = sqliteTable(
  'user_devices',
  {
    id: id(),
    /** 用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 设备标识（客户端生成） */
    deviceId: text('device_id').notNull(),
    /** 设备备注名（如「我的 iPhone」） */
    label: text('label'),
    /** 首次登记时间 */
    firstSeenAt: integer('first_seen_at', { mode: 'timestamp' }).notNull(),
    /** 最近活跃时间 */
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_user_devices_user_device').on(t.userId, t.deviceId),
    index('ix_user_devices_user').on(t.userId),
  ],
);

/* ------------------------------------------------------------------ */
/* 批次 6 补缺大批 · server 侧支付骨架（pay_orders / agreements / pay_rules） */
/* ------------------------------------------------------------------ */

/** 支付单业务域，取值：membership_open 线上开通会员 | membership_upgrade 升级（片 3 未合，预留） | mall 商城（预留） */
export type PayBizDomain = 'membership_open' | 'membership_upgrade' | 'mall';
/** 支付单状态机：created→paying→paid（终）/closed（超时关单，终）/failed（通道失败，终）；非法迁移硬拒 */
export type PayOrderStatus = 'created' | 'paying' | 'paid' | 'closed' | 'failed';
/** 支付通道，取值：mock | wechat_jsapi | wechat_h5 | alipay_wap（内测=mock） */
export type PayChannel = 'mock' | 'wechat_jsapi' | 'wechat_h5' | 'alipay_wap';
/** 协议键，取值：member_service 会员服务协议 | not_prepaid 非预付卡声明 | no_auto_renew 到期不自动续费告知 */
export type AgreementKey = 'member_service' | 'not_prepaid' | 'no_auto_renew';

/**
 * 线上支付单表（批次 6 补缺大批 · 涉钱最高戒律）：
 * - 金额 server 重算落库（前端金额一律不信，createOrder 入参金额直接忽略）；
 * - pay_no=PO-yyyymmdd-NNN 日序（storeWallclock +8 当日窗口 count+1，写串行锁内分配，
 *   口径同 cashier genBillNo / refund genRefundNo；无门店维度=全局日序）；
 * - biz_id 语义按域：membership_open=开通用户 users.id（归属/幂等/反查同键）；
 *   membership_upgrade/mall 预留（后续片接入时注释补齐）；
 * - idem_key 全局唯一=幂等闸：base=`{userId}|{bizDomain}|{planKey}|{当日}`，
 *   同人同档当日在途（created/paying）重复创建=返回现状 idempotent=true；
 *   在途单终结（closed/failed/paid）后再创建=base 加 `#a{N}` 尝试序号（审计可溯，
 *   unique 不撞）；
 * - biz_json=业务上下文快照（membership_open → {planKey, petCount, planLabel, phoneMasked}），
 *   兑付/补兑付（reconcile）据此重建业务行，不依赖入参；
 * - timeout_at=创建时快照 pay_timeout_minutes 端口值（超时关单 sweeper 按此比较；
 *   端口改值只管新单，不回溯在途单——与规则配置「新规只管新单」同口径）；
 * - 状态机硬拒：条件更新 WHERE status IN ('created','paying') 影响行数=0 且非 paid →
 *   拒绝（closed/failed 再回调/再支付一律 400）；重复回调（已 paid）幂等零副作用。
 * - 移位铁律：pay_no 日序按 created_at 计号，任何测试不得对 pay_orders.created_at 移位。
 */
export const payOrders = sqliteTable(
  'pay_orders',
  {
    id: id(),
    /** 支付单号（全局唯一）：PO-yyyymmdd-NNN 日序 */
    payNo: text('pay_no').notNull().unique(),
    /** 业务域，取值见 PayBizDomain */
    bizDomain: text('biz_domain').notNull(),
    /** 业务对象 ID（membership_open=users.id；其余域预留） */
    bizId: text('biz_id').notNull(),
    /** 业务上下文快照 JSON（兑付依据），结构见 PayOrderBizJson */
    bizJson: text('biz_json', { mode: 'json' }).$type<Record<string, unknown>>(),
    /** 金额（分，server 重算落库，前端金额一律不信） */
    amountFen: integer('amount_fen').notNull(),
    /** 支付通道，取值见 PayChannel */
    channel: text('channel').notNull(),
    /** 状态，取值见 PayOrderStatus */
    status: text('status').notNull().default('created'),
    /** 幂等键（全局唯一；base 或 base+#a{N} 尝试序号） */
    idemKey: text('idem_key').notNull().unique(),
    /** 通道侧支付单号（PaymentProvider.createPayment 返回；NULL=通道未下单） */
    paymentId: text('payment_id'),
    /** 回调原文 JSON（审计/对账用；NULL=未收回调） */
    callbackJson: text('callback_json', { mode: 'json' }).$type<Record<string, unknown>>(),
    /** 支付超时时间（创建时 pay_timeout_minutes 端口值快照；NULL 不用） */
    timeoutAt: integer('timeout_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [
    index('ix_pay_orders_biz').on(t.bizDomain, t.bizId),
    index('ix_pay_orders_status').on(t.status),
  ],
);

/**
 * 服务域规则配置表（补缺大批片 4，同构 commission_rules）：配置端口第六域
 * domain='service'。种子 version=1 一行 service_hours（客服服务时间公示，
 * 客户端读口 serviceLoop.serviceHours）。保存即生效+版本化留痕，新值只管新读不回溯。
 */
export const serviceRules = sqliteTable(
  'service_rules',
  {
    id: id(),
    /** 规则版本（初始种子 =1） */
    version: integer('version').notNull(),
    /** 规则键（如 service_hours） */
    ruleKey: text('rule_key').notNull(),
    /** 规则中文名（配置页展示） */
    label: text('label').notNull(),
    /** 规则值 JSON（如 { text: '09:00–21:00' }），结构见 RuleConfigValue */
    valueJson: text('value_json', { mode: 'json' }).$type<RuleConfigValue>().notNull(),
    /** 生效时间（按此取规则版本；新规只管生效后的读） */
    effectiveFrom: integer('effective_from', { mode: 'timestamp' }).notNull(),
    /** 是否生效（0/1） */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** 创建/变更人用户 ID -> users.id */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_service_rules_key_active').on(t.ruleKey, t.active)],
);

/**
 * 文案端口覆盖表（端口批片 B · CJ-1002-01 内容层全端口化，控制台第七域 domain='copy'，
 * 同构 commission_rules）：copy 键全表后台可改——界面文案老板/未来文案运营自管，
 * 改完即生效（只管新渲染）零代码零部署。
 * - 种子=三端 copy 键全表（迁移 0024 幂等落库；label=域分组：member/mall/refund/…）；
 * - value_json={ text: '界面文案' }（STRING_KEYS 族校验既有）；
 * - 读取顺序=端口值（active 行）→ 码内默认（copy 键 fallback 不改码）；
 * - 高危键（涉钱/涉协议/涉会员口径）改前重确认（config.save confirmedHighRisk 闸）+
 *   保存时禁令词校验（禁充值/储值文案/自动续费类命中即拒，否定明面句豁免）；
 * - 保存=版本化事务留痕（rule_config_versions domain='copy' 每键前后值），新规只管新渲染不回溯。
 */
export const copyOverrides = sqliteTable(
  'copy_overrides',
  {
    id: id(),
    /** 版本（初始种子=1；域级单调，同 config.save 口径） */
    version: integer('version').notNull(),
    /** copy 键（如 'refund.submitCta'；=码内 copy 表键名小写点分） */
    ruleKey: text('rule_key').notNull(),
    /** 域分组（member / mall / refund / notify / pay / serviceloop / home / account / booking / appointments / pets / devlogin / merchant:xx / staff:xx） */
    label: text('label').notNull(),
    /** 文案值 JSON：{ text: string } */
    valueJson: text('value_json', { mode: 'json' }).$type<RuleConfigValue>().notNull(),
    /** 生效时间（保存即生效；只管新渲染） */
    effectiveFrom: integer('effective_from', { mode: 'timestamp' }).notNull(),
    /** 是否生效（0/1） */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** 创建/变更人用户 ID -> users.id */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_copy_overrides_key_active').on(t.ruleKey, t.active)],
);

/**
 * 展示槽位表（端口批片 C · A5 落地，控制台第八域「槽位」）：
 * BANNER/卡面/登录宣言图/空态插画/商品占位模板等展示内容后台可换——换内容零代码零部署。
 * - 每槽多版本行：新上传=status='pending'（待审，新素材默认待审不上线 D-6 纪律）；点上线=
 *   该版本 'live'（同槽唯一 live）旧 live→'archived'；回退=上一版重新 live；
 * - content_json={url, alt}：url=null=渐变/图标占位（R10 不画假件——无真件不落假图，
 *   前端 fallback 纪律=码内渐变/默认图）；url 支持 /api/img 签名件与 public 静态路径；
 * - 权限：写与全量读=仅 owner（merchantOwnerProcedure）；客户端读口=仅 live 行公开透出。
 */
export const slotContents = sqliteTable(
  'slot_contents',
  {
    id: id(),
    /** 槽位键（如 home.banner / member.cardFace；注册表=种子七槽） */
    slotKey: text('slot_key').notNull(),
    /** 槽内版本（每槽自增，种子=1） */
    version: integer('version').notNull(),
    /** 内容 JSON：{ url: string|null, alt: string } */
    contentJson: text('content_json', { mode: 'json' }).$type<{ url: string | null; alt: string }>().notNull(),
    /** 状态：pending（待审） | live（上线） | archived（历史版） */
    status: text('status').notNull().default('pending'),
    /** 创建/操作人用户 ID -> users.id（上传人） */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    /** 最近一次发布/回退操作人（0026 补列：对齐文案域留痕治理口径；存量行=NULL 诚实空） */
    actedBy: text('acted_by').references(() => users.id),
    /** 最近一次发布/回退时刻 */
    actedAt: integer('acted_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [
    index('ix_slot_contents_key_status').on(t.slotKey, t.status),
    index('ix_slot_contents_key_version').on(t.slotKey, t.version),
  ],
);

/* ------------------------------------------------------------------ */
/* 员工端骨架整建批 片 2（排班 10+考勤 7）：排班域八表（0028）                   */
/* 命名注：按日排班实例=shift_assignments（shifts 名=收银交接班域既有占用，不撞名）   */
/* ------------------------------------------------------------------ */

/** 班次模板（规律性轮班来源；店域） */
export const shiftTemplates = sqliteTable(
  'shift_templates',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    /** 班次名（如「早班」） */
    name: text('name').notNull(),
    /** 起止（当日起算分钟数，如 600=10:00） */
    startMin: integer('start_min').notNull(),
    endMin: integer('end_min').notNull(),
    /** 适用周日 JSON 数组（1=周一…0/7=周日） */
    weekdays: text('weekdays', { mode: 'json' }).$type<number[]>().notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by').notNull().references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_shift_templates_store').on(t.storeId, t.active)],
);

/** 按日排班实例（模板生成/手动/拖拽调整均落此；source=manual|template） */
export const shiftAssignments = sqliteTable(
  'shift_assignments',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    staffId: text('staff_id').notNull().references(() => staff.id),
    /** 排班日期 ISO 'YYYY-MM-DD' */
    date: text('date').notNull(),
    startMin: integer('start_min').notNull(),
    endMin: integer('end_min').notNull(),
    templateId: text('template_id').references(() => shiftTemplates.id),
    /** 来源：manual | template（规律轮班自动生成） */
    source: text('source').notNull().default('manual'),
    /** 状态：active | cancelled */
    status: text('status').notNull().default('active'),
    /** 顶班/临时调整注记（留痕） */
    note: text('note'),
    /** 班表发布时刻（NULL=未发布；发布=推送员工可见，publishedAt 置位） */
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdBy: text('created_by').notNull().references(() => users.id),
    ...auditColumns,
  },
  (t) => [
    index('ix_shift_assignments_store_date').on(t.storeId, t.date, t.status),
    uniqueIndex('uq_shift_assignments_staff_date_start').on(t.staffId, t.date, t.startMin),
  ],
);

/** 换班申请审批（未认领前责任归原人：批准才换挂 assignment.staff_id） */
export const shiftSwaps = sqliteTable(
  'shift_swaps',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    assignmentId: text('assignment_id').notNull().references(() => shiftAssignments.id),
    fromStaffId: text('from_staff_id').notNull().references(() => staff.id),
    /** 目标员工（NULL=开放认领） */
    toStaffId: text('to_staff_id').references(() => staff.id),
    reason: text('reason').notNull(),
    /** 状态：pending | approved | rejected */
    status: text('status').notNull().default('pending'),
    decidedBy: text('decided_by').references(() => users.id),
    decidedAt: integer('decided_at', { mode: 'timestamp' }),
    decideNote: text('decide_note'),
    ...auditColumns,
  },
  (t) => [index('ix_shift_swaps_store_status').on(t.storeId, t.status)],
);

/** 员工自主可用时间/偏好（按周日） */
export const staffAvailability = sqliteTable(
  'staff_availability',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    staffId: text('staff_id').notNull().references(() => staff.id),
    /** 周日序号（1=周一…0=周日） */
    weekday: integer('weekday').notNull(),
    startMin: integer('start_min').notNull(),
    endMin: integer('end_min').notNull(),
    note: text('note'),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_staff_availability').on(t.staffId, t.weekday, t.startMin)],
);

/** 请假/调休申请（排到请假人=系统责任：发布/排班硬校验闸读此表） */
export const leaveRequests = sqliteTable(
  'leave_requests',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    staffId: text('staff_id').notNull().references(() => staff.id),
    /** 类型：leave=请假 | comp_off=调休 */
    kind: text('kind').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    decidedBy: text('decided_by').references(() => users.id),
    decidedAt: integer('decided_at', { mode: 'timestamp' }),
    decideNote: text('decide_note'),
    ...auditColumns,
  },
  (t) => [
    index('ix_leave_requests_store_status').on(t.storeId, t.status),
    index('ix_leave_requests_staff_range').on(t.staffId, t.startDate, t.endDate),
  ],
);

/** 调休余额台账（员工自助查；余额=sum(delta_minutes)） */
export const compOffLedger = sqliteTable(
  'comp_off_ledger',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    staffId: text('staff_id').notNull().references(() => staff.id),
    /** 变动分钟（正=增加/负=使用） */
    deltaMinutes: integer('delta_minutes').notNull(),
    reason: text('reason').notNull(),
    /** 来源单（如换班/审批 id） */
    sourceId: text('source_id'),
    createdBy: text('created_by').notNull().references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_comp_off_staff').on(t.staffId)],
);

/** 技能标签指派（标签集入配置端口 service 域 staff_skill_tags 键；本表=指派关系） */
export const staffSkills = sqliteTable(
  'staff_skills',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    staffId: text('staff_id').notNull().references(() => staff.id),
    tag: text('tag').notNull(),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_staff_skills').on(t.staffId, t.tag)],
);

/** WiFi 打卡 BSSID 白名单（片 2 B1-1；店长自管=商家端配置页；空=不做 WiFi 校验） */
export const attendanceWifiBssids = sqliteTable(
  'attendance_wifi_bssids',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    /** BSSID（AP MAC，形如 aa:bb:cc:dd:ee:ff） */
    bssid: text('bssid').notNull(),
    label: text('label').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by').notNull().references(() => users.id),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_wifi_bssids').on(t.storeId, t.bssid)],
);

/**
 * 账号注销申请单表（批次 R13a · 0017）：
 * - 同人仅一在途（status='submitted' 应用层判定幂等，不加部分索引）；
 * - checklist_json=提交时阻断校验快照（须为空清单才放行）；impacts_json=三项影响
 *   勾选快照（rebate/member/pets 缺一不可，服务端强校验）；
 * - 审批通过=软注销（users.deactivated_at 置位 + phone 释放 + 回馈金清零 +
 *   会员 cancelled（注销≠退会，不走折算退款——报备口径）+ pets 软删标记）。
 */
export const deactivationRequests = sqliteTable(
  'deactivation_requests',
  {
    id: id(),
    /** 申请用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 阻断校验快照（DeactivationChecklistItem[]，提交时重跑 precheck 的结果） */
    checklistJson: text('checklist_json', { mode: 'json' }).$type<DeactivationChecklistItem[]>().notNull(),
    /** 影响勾选快照（['rebate','member','pets'] 三项全勾选才可提交） */
    impactsJson: text('impacts_json', { mode: 'json' }).$type<string[]>().notNull(),
    /** 状态，取值：submitted | approved | rejected | cancelled */
    status: text('status').notNull().default('submitted'),
    /** 审批人用户 ID -> users.id */
    approverId: text('approver_id').references(() => users.id),
    /** 审批时间 */
    decidedAt: integer('decided_at', { mode: 'timestamp' }),
    /** 审批备注（reject 必填，客户端可见） */
    decideNote: text('decide_note'),
    ...auditColumns,
  },
  (t) => [index('ix_deactivation_requests_user').on(t.userId)],
);

/**
 * 协议留痕表（批次 6 补缺大批）：线上开通会员三协议勾选快照——
 * member_service 会员服务协议 / not_prepaid 非预付卡声明 / no_auto_renew 到期不自动续费告知。
 * createOrder 事务内与 pay_orders 同落（三行必传缺一拒单）：content/version 全文快照
 * （协议改版不回溯历史留痕）+ checked_at 勾选时刻 + user_snapshot（userId/phoneMasked/
 * planKey/petCount，取证四要素）。只增不改（无更新端点）。
 */
export const agreements = sqliteTable(
  'agreements',
  {
    id: id(),
    /** 勾选用户 ID -> users.id */
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    /** 协议键，取值见 AgreementKey */
    agreementKey: text('agreement_key').notNull(),
    /** 协议版本（快照，如 'v1.0'） */
    version: text('version').notNull(),
    /** 协议全文快照（改版不回溯） */
    content: text('content').notNull(),
    /** 勾选时刻 */
    checkedAt: integer('checked_at', { mode: 'timestamp' }).notNull(),
    /** 用户快照 JSON：{userId, phoneMasked, planKey, petCount} */
    userSnapshot: text('user_snapshot', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    ...auditColumns,
  },
  (t) => [index('ix_agreements_user_key').on(t.userId, t.agreementKey)],
);

/**
 * 支付规则配置表（批次 6 补缺大批，同构 commission_rules，配置端口第五域 domain='pay'）：
 * 种子 version=1 随 0017 幂等迁移落全库（created_by='system'，Y6 豁免件同 0016 工艺）——
 * pay_timeout_minutes{minutes:30} 支付超时关单时长（分钟）/
 * pay_channel_enabled{enabled:true} 线上支付通道开关（内测=mock）。
 * 保存即生效+版本化留痕，新值只管新单（在途单 timeout_at 为创建时快照，不回溯）。
 */
export const payRules = sqliteTable(
  'pay_rules',
  {
    id: id(),
    /** 规则版本（初始种子 =1） */
    version: integer('version').notNull(),
    /** 规则键（pay_timeout_minutes / pay_channel_enabled） */
    ruleKey: text('rule_key').notNull(),
    /** 规则中文名（配置页展示） */
    label: text('label').notNull(),
    /** 规则值 JSON（minutes/enabled），结构见 RuleConfigValue */
    valueJson: text('value_json', { mode: 'json' }).$type<RuleConfigValue>().notNull(),
    /** 生效时间（按此取规则版本；新规只管生效后的单） */
    effectiveFrom: integer('effective_from', { mode: 'timestamp' }).notNull(),
    /** 是否生效（0/1） */
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    /** 创建/变更人用户 ID -> users.id（迁移种子='system'，FK 豁免同 0016 工艺） */
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_pay_rules_key_active').on(t.ruleKey, t.active)],
);

/* ==================== 员工端骨架整建批 片 3（任务执行+通讯+权限，迁移 0031） ==================== */

/** 循环任务模板（片 3 B5-1；店长自管；freq=daily|weekly，weekly 用 weekdays 集；提醒 remind_min 分钟前置） */
export const taskTemplates = sqliteTable(
  'task_templates',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    title: text('title').notNull(),
    detail: text('detail'),
    /** 指派范围：role（按角色全员可见）| staff（指定到人） */
    assignScope: text('assign_scope').notNull(),
    /** assignScope=role 时：frontdesk | groomer */
    assignRole: text('assign_role'),
    /** assignScope=staff 时 -> staff.id */
    assignStaffId: text('assign_staff_id').references(() => staff.id),
    /** 循环频率：daily | weekly */
    freq: text('freq').notNull(),
    /** 适用周日 JSON 数组（1=周一…0/7=周日；daily=全集） */
    weekdays: text('weekdays', { mode: 'json' }).$type<number[]>().notNull(),
    /** 当日截止时刻（当日起算分钟数，如 1080=18:00） */
    dueMin: integer('due_min').notNull(),
    /** 截止前提醒分钟（NULL=不提醒；提醒=task.reminder 事件+notifications 落行） */
    remindMin: integer('remind_min'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdBy: text('created_by').notNull().references(() => users.id),
    ...auditColumns,
  },
  (t) => [index('ix_task_templates_store').on(t.storeId, t.active)],
);

/** 循环任务落实例（触读即补生成=ensureOpenShift 懒建同工艺；(template_id,biz_date) 幂等锚；scope=role 时 staffId=NULL 该角色全员可见，完成落 doneBy） */
export const taskRuns = sqliteTable(
  'task_runs',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    templateId: text('template_id').notNull().references(() => taskTemplates.id),
    /** 业务日期 ISO 'YYYY-MM-DD' */
    bizDate: text('biz_date').notNull(),
    /** 落实例到人（scope=staff 即定；scope=role=NULL 全员可见） */
    staffId: text('staff_id').references(() => staff.id),
    /** 状态：pending | done */
    status: text('status').notNull().default('pending'),
    doneBy: text('done_by').references(() => users.id),
    doneAt: integer('done_at', { mode: 'timestamp' }),
    /** 提醒已发时刻（幂等锚，一发不再发） */
    remindedAt: integer('reminded_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_task_runs_tpl_date').on(t.templateId, t.bizDate),
    index('ix_task_runs_store_date').on(t.storeId, t.bizDate, t.status),
  ],
);

/** PDCA 问题-整改-复检闭环（片 3 B5-4；状态机 open→fixing→recheck→closed(pass)/fixing(fail 回炉)；timeline_json 只增留痕照 support_tickets 工艺） */
export const pdcaIssues = sqliteTable(
  'pdca_issues',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    title: text('title').notNull(),
    detail: text('detail'),
    /** 问题类目（巡检排行分组维度；类目集入端口 pdca_categories） */
    category: text('category'),
    /** 照片留证 URL 列表 JSON（现场拍，走 /api/upload 既有链） */
    photoUrls: text('photo_urls', { mode: 'json' }).$type<string[]>().notNull().default([]),
    raisedBy: text('raised_by').notNull().references(() => users.id),
    /** 整改责任人 -> staff.id */
    assignStaffId: text('assign_staff_id').references(() => staff.id),
    /** 状态：open | fixing | recheck | closed */
    status: text('status').notNull().default('open'),
    fixNote: text('fix_note'),
    fixedBy: text('fixed_by').references(() => users.id),
    fixedAt: integer('fixed_at', { mode: 'timestamp' }),
    recheckNote: text('recheck_note'),
    recheckBy: text('recheck_by').references(() => users.id),
    recheckAt: integer('recheck_at', { mode: 'timestamp' }),
    /** 复检结果：pass | fail（fail=回炉 fixing） */
    recheckResult: text('recheck_result'),
    /** 时间线 JSON 数组（只增不改） */
    timelineJson: text('timeline_json', { mode: 'json' }).$type<Array<{ at: number; by: string; action: string; note?: string }>>().notNull(),
    ...auditColumns,
  },
  (t) => [index('ix_pdca_issues_store').on(t.storeId, t.status)],
);

/** 门店每日自检+上级审核（片 3 B5-5；表项=service_rules.self_check_items 端口值提交时快照；(store_id,biz_date) 一店一日一表幂等锚） */
export const selfCheckRuns = sqliteTable(
  'self_check_runs',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    bizDate: text('biz_date').notNull(),
    /** 提交时自检表快照：[{key,label,score,pass,photoUrl?,note?}] */
    itemsJson: text('items_json', { mode: 'json' }).$type<Array<{ key: string; label: string; score: number; pass: boolean; photoUrl?: string; note?: string }>>().notNull(),
    /** 总分（服务端按快照算，不信前端） */
    score: integer('score').notNull(),
    filledBy: text('filled_by').notNull().references(() => users.id),
    /** 状态：submitted | reviewed（上级审核） */
    status: text('status').notNull().default('submitted'),
    reviewNote: text('review_note'),
    reviewBy: text('review_by').references(() => users.id),
    reviewAt: integer('review_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_self_check_store_date').on(t.storeId, t.bizDate)],
);

/** 公告（片 3 B6-1；target_role=all|frontdesk|groomer 定向；发布即 published，archived 撤下） */
export const announcements = sqliteTable(
  'announcements',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** 定向：all | frontdesk | groomer */
    targetRole: text('target_role').notNull().default('all'),
    pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
    /** 状态：published | archived */
    status: text('status').notNull().default('published'),
    publishedBy: text('published_by').notNull().references(() => users.id),
    publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
    ...auditColumns,
  },
  (t) => [index('ix_announcements_store').on(t.storeId, t.status, t.publishedAt)],
);

/** 公告已读回执（片 3 B6-1；(announcement_id,user_id) 幂等锚；回执=店长可读名单对账） */
export const announcementReads = sqliteTable(
  'announcement_reads',
  {
    id: id(),
    announcementId: text('announcement_id').notNull().references(() => announcements.id),
    userId: text('user_id').notNull().references(() => users.id),
    readAt: integer('read_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [uniqueIndex('uq_announcement_reads').on(t.announcementId, t.userId)],
);

/** 交接班结构化日志（片 3 B6-3；挂收银员交接班 shifts 既有件，一班一份；不碰 shifts 列——收银/日结快照口径冻结） */
export const shiftHandoverLogs = sqliteTable(
  'shift_handover_logs',
  {
    id: id(),
    shiftId: text('shift_id').notNull().references(() => shifts.id),
    storeId: text('store_id').notNull().references(() => stores.id),
    /** 在洗清单 JSON：[{appointmentId, petName, stepLabel}]（服务端按在店单快照，可手工增补注记） */
    washingJson: text('washing_json', { mode: 'json' }).$type<Array<{ appointmentId: string; label: string }>>(),
    /** 钥匙交接注记 */
    keysNote: text('keys_note'),
    /** 现金交接注记 */
    cashNote: text('cash_note'),
    /** 客诉/异常注记 */
    complaintsNote: text('complaints_note'),
    fromUserId: text('from_user_id').notNull().references(() => users.id),
    /** 接棒人（NULL=未指定，下一班开岗人即接棒） */
    toUserId: text('to_user_id').references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [uniqueIndex('uq_handover_shift').on(t.shiftId)],
);

/** 离职资源改挂留痕（片 3 B7-4；仿 reception_logs 前后值口径：prev_value→new_value 快照+操作人；kind=appointment|boarding|member） */
export const staffExitHandoffs = sqliteTable(
  'staff_exit_handoffs',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    /** 资源类：appointment（未完结服务单）| boarding（在养宠物单）| member（会员档案） */
    kind: text('kind').notNull(),
    refId: text('ref_id').notNull(),
    fromStaffId: text('from_staff_id').notNull().references(() => staff.id),
    toStaffId: text('to_staff_id').references(() => staff.id),
    /** 前后值快照（JSON 字符串） */
    prevValue: text('prev_value'),
    newValue: text('new_value'),
    note: text('note'),
    changedBy: text('changed_by').notNull().references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('ix_exit_handoffs_store').on(t.storeId, t.fromStaffId)],
);

/* ==================== 员工端骨架整建批 片 4（薪资+XP，涉钱批，迁移 0033） ==================== */

/** 工资条批次（片 4 B3-4）：生成→老板确认两态；一店一月一批（uq 幂等锚） */
export const payrollRuns = sqliteTable(
  'payroll_runs',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    /** 工资月份 'YYYY-MM' */
    month: text('month').notNull(),
    /** 状态：generated（已生成待确认）| confirmed（老板确认定稿） */
    status: text('status').notNull().default('generated'),
    generatedBy: text('generated_by').notNull().references(() => users.id),
    generatedAt: integer('generated_at', { mode: 'timestamp' }).notNull(),
    confirmedBy: text('confirmed_by').references(() => users.id),
    confirmedAt: integer('confirmed_at', { mode: 'timestamp' }),
    ...auditColumns,
  },
  (t) => [uniqueIndex('uq_payroll_runs_store_month').on(t.storeId, t.month)],
);

/**
 * 员工工资条行（片 4 B3-4）：四费列+净额快照（payload_json=computeMonth 同构载荷）；
 * net = commission + performance − deduction + adjustment（adjustment 带符号，负=跨月回冲调整项）；
 * 发放=标记留痕（marked_by/at/method_note，开口项 3 裁：不碰真钱，全链路零支付通道）。
 */
export const payrollItems = sqliteTable(
  'payroll_items',
  {
    id: id(),
    runId: text('run_id').notNull().references(() => payrollRuns.id),
    storeId: text('store_id').notNull().references(() => stores.id),
    staffId: text('staff_id').notNull().references(() => staff.id),
    month: text('month').notNull(),
    /** computeMonth 同构载荷快照（服务/商品/售卡/绩效/扣减/调整项全明细） */
    payloadJson: text('payload_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
    commissionFen: integer('commission_fen').notNull().default(0),
    performanceFen: integer('performance_fen').notNull().default(0),
    deductionFen: integer('deduction_fen').notNull().default(0),
    /** 调整项（带符号：负=跨月回冲，正=补调） */
    adjustmentFen: integer('adjustment_fen').notNull().default(0),
    netFen: integer('net_fen').notNull().default(0),
    ruleVersion: integer('rule_version'),
    snapshotId: text('snapshot_id'),
    /** 发放标记（标记留痕不碰真钱；重复标记幂等） */
    markedBy: text('marked_by').references(() => users.id),
    markedAt: integer('marked_at', { mode: 'timestamp' }),
    methodNote: text('method_note'),
    ...auditColumns,
  },
  (t) => [
    uniqueIndex('uq_payroll_items_run_staff').on(t.runId, t.staffId),
    index('ix_payroll_items_staff').on(t.staffId, t.month),
  ],
);

/** 多人协作单提成拆分（片 4 B3-2）：一单 N 人 split_bp 万分比；主操作人吃余数（Σ协作 + 主 = 10000） */
export const appointmentCollaborators = sqliteTable(
  'appointment_collaborators',
  {
    id: id(),
    appointmentId: text('appointment_id').notNull().references(() => appointments.id),
    staffId: text('staff_id').notNull().references(() => staff.id),
    /** 协作角色注记（wash|groom|assist 等，文案走端口） */
    role: text('role').notNull(),
    /** 拆分比例（万分比 bp，如 4000=40%） */
    splitBp: integer('split_bp').notNull(),
    createdBy: text('created_by').notNull().references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [
    uniqueIndex('uq_collab_appt_staff').on(t.appointmentId, t.staffId),
    index('ix_collab_staff').on(t.staffId),
  ],
);

/** 薪资异议申诉（片 4 B3-5/6；仿 attendance_approvals 工艺：挂目标单+返还额闭环+审批前后值） */
export const payrollAppeals = sqliteTable(
  'payroll_appeals',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    staffId: text('staff_id').notNull().references(() => staff.id),
    /** 申诉目标类：deduction（扣款/罚单）| slip_line（工资条行）| adjustment（调整项） */
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id').notNull(),
    /** 申诉涉月 'YYYY-MM' */
    month: text('month').notNull(),
    reason: text('reason').notNull(),
    evidenceUrls: text('evidence_urls', { mode: 'json' }).$type<string[]>(),
    /** 状态：pending | approved | rejected */
    status: text('status').notNull().default('pending'),
    reviewerId: text('reviewer_id').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    reviewNote: text('review_note'),
    /** 返还额（分；approved 且 target=deduction 时落 deduction.status=reverted 返还留痕） */
    refundFen: integer('refund_fen'),
    ...auditColumns,
  },
  (t) => [
    index('ix_payroll_appeals_store').on(t.storeId, t.status),
    index('ix_payroll_appeals_staff').on(t.staffId, t.status),
  ],
);

/** XP 积分申请+扣分异议（片 4 B4；审核通过才落正式 xp_events——awardXp/正向对冲行；xp_events 只增流水零污染） */
export const xpApplications = sqliteTable(
  'xp_applications',
  {
    id: id(),
    storeId: text('store_id').notNull().references(() => stores.id),
    staffId: text('staff_id').notNull().references(() => staff.id),
    /** 申请类：award（积分申报）| revoke_appeal（扣分异议，挂原 penalty 事件） */
    appKind: text('app_kind').notNull(),
    /** revoke_appeal 时挂原 xp_events 事件 id */
    targetEventId: text('target_event_id').references(() => xpEvents.id),
    /** 请求分值（award=正分；revoke_appeal=请求对冲的正分值） */
    pointsRequested: integer('points_requested').notNull(),
    reason: text('reason').notNull(),
    /** 状态：pending | approved | rejected */
    status: text('status').notNull().default('pending'),
    reviewerId: text('reviewer_id').references(() => users.id),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    reviewNote: text('review_note'),
    /** 审核通过落正式事件的回链（awardXp 落行 id / 对冲行 id） */
    resolvedEventId: text('resolved_event_id').references(() => xpEvents.id),
    ...auditColumns,
  },
  (t) => [
    index('ix_xp_applications_store').on(t.storeId, t.status),
    index('ix_xp_applications_staff').on(t.staffId, t.status),
  ],
);
