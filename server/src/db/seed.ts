/**
 * 种子脚本（npm run db:seed）
 *
 * 幂等策略：重跑时先按「子表 -> 父表」顺序清空全部业务表，再重新插入，
 * 因此重复执行不会产生重复数据。
 *
 * 种子内容：
 * - 1 门店（菲丽亚宠物·示例店，open_hours 全周 09:00-20:00）
 * - 1 店主用户（merchant_owner）+ 3 员工用户（staff 角色 + staff 记录，技能覆盖
 *   wash/groom/boarding）+ 1 客户用户（customer）
 * - 2 宠物（1 狗 1 猫，含疫苗有效期）
 * - 10 服务项（grooming 6 + boarding 4，boarding 含房型）
 * - 10 商品（分类覆盖 主粮/零食/玩具/清洁，images 用 /products/*.svg 占位图（scripts/gen-product-placeholders.mjs 生成））
 * - store_slots：明天起未来 7 天，30min 粒度，09:00-19:30，capacity=2（154 条）
 *
 * 结束打印各表行数。
 *
 * 注：整个清空+插入包在一个事务里。SQLite 单写者模型下行锁天然安全；
 * 未来切 MySQL 该事务结构语义不变。
 */

import { client, db, schema } from './index';

/* ---------------- 清空（子表 -> 父表） ---------------- */

const CLEAR_ORDER = [
  schema.stepPhotos,
  schema.appointmentSteps,
  schema.boardingDailyLogs,
  schema.boardingStays,
  schema.appointments,
  schema.storeSlots,
  schema.payments,
  schema.orders,
  schema.products,
  schema.services,
  schema.pets,
  schema.staffInvites,
  schema.staff,
  schema.stores,
  schema.notifications,
  schema.pushSubscriptions,
  schema.eventOutbox,
  schema.userRoles,
  schema.users,
] as const;

/* ---------------- 种子数据 ---------------- */

/** 全周 09:00-20:00 */
const OPEN_HOURS_ALL_WEEK: schema.StoreOpenHours = {
  mon: { open: '09:00', close: '20:00' },
  tue: { open: '09:00', close: '20:00' },
  wed: { open: '09:00', close: '20:00' },
  thu: { open: '09:00', close: '20:00' },
  fri: { open: '09:00', close: '20:00' },
  sat: { open: '09:00', close: '20:00' },
  sun: { open: '09:00', close: '20:00' },
};

const STAFF_SCHEDULE: schema.StaffSchedule = {
  mon: [{ start: '09:00', end: '18:00' }],
  tue: [{ start: '09:00', end: '18:00' }],
  wed: [{ start: '09:00', end: '18:00' }],
  thu: [{ start: '09:00', end: '18:00' }],
  fri: [{ start: '09:00', end: '18:00' }],
  sat: [{ start: '10:00', end: '19:00' }],
  sun: [{ start: '10:00', end: '19:00' }],
};

/** 生成未来 7 天（明天起）30min 粒度的营业时段：每天 09:00-19:30 共 22 个 */
function buildSlots(): Date[] {
  const starts: Date[] = [];
  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const day = new Date();
    day.setDate(day.getDate() + dayOffset);
    day.setHours(9, 0, 0, 0); // 当天营业开始 09:00（本地时间）
    for (let i = 0; i < 22; i++) {
      const slot = new Date(day.getTime() + i * 30 * 60 * 1000);
      starts.push(slot); // 09:00 ... 19:30
    }
  }
  return starts;
}

async function main() {
  console.log('[seed] 开始（先清空业务表，保证幂等）…');

  await db.transaction(async (tx) => {
    for (const table of CLEAR_ORDER) {
      await tx.delete(table);
    }

    /* ---- 用户与角色 ---- */
    const [owner, staffUser1, staffUser2, staffUser3, customer] = await tx
      .insert(schema.users)
      .values([
        { kimiId: 'seed_kimi_owner', nickname: '菲丽亚店主', phone: '13900000001' },
        { kimiId: 'seed_kimi_staff1', nickname: '小美', phone: '13900000002' },
        { kimiId: 'seed_kimi_staff2', nickname: '阿强', phone: '13900000003' },
        { kimiId: 'seed_kimi_staff3', nickname: '丽丽', phone: '13900000004' },
        { kimiId: 'seed_kimi_customer', nickname: '示例客户', phone: '13800000000' },
      ])
      .returning();

    await tx.insert(schema.userRoles).values([
      { userId: owner.id, role: 'merchant_owner' },
      { userId: staffUser1.id, role: 'staff' },
      { userId: staffUser2.id, role: 'staff' },
      { userId: staffUser3.id, role: 'staff' },
      { userId: customer.id, role: 'customer' },
    ]);

    /* ---- 门店 ---- */
    const [store] = await tx
      .insert(schema.stores)
      .values({
        ownerId: owner.id,
        name: '菲丽亚宠物·示例店',
        address: '杭州市西湖区文三路 100 号',
        lat: 30.2741,
        lng: 120.1551,
        openHours: OPEN_HOURS_ALL_WEEK,
        status: 'active',
      })
      .returning();

    /* ---- 员工（技能覆盖 wash/groom/boarding） ---- */
    const staffRows = await tx
      .insert(schema.staff)
      .values([
        {
          storeId: store.id,
          userId: staffUser1.id,
          name: '小美',
          skills: ['wash', 'groom'],
          schedule: STAFF_SCHEDULE,
          status: 'active',
        },
        {
          storeId: store.id,
          userId: staffUser2.id,
          name: '阿强',
          skills: ['wash', 'boarding'],
          schedule: STAFF_SCHEDULE,
          status: 'active',
        },
        {
          storeId: store.id,
          userId: staffUser3.id,
          name: '丽丽',
          skills: ['groom', 'boarding'],
          schedule: STAFF_SCHEDULE,
          status: 'active',
        },
      ])
      .returning();
    void staffRows;

    /* ---- 宠物（1 狗 1 猫，含疫苗有效期） ---- */
    await tx.insert(schema.pets).values([
      {
        ownerId: customer.id,
        name: '旺财',
        species: 'dog',
        breed: '金毛寻回犬',
        birthday: '2021-03-15',
        weightKg: 28.5,
        vaccineValidUntil: '2027-03-01',
        neutered: true,
        temperamentTags: ['亲人', '好动'],
      },
      {
        ownerId: customer.id,
        name: '咪咪',
        species: 'cat',
        breed: '英国短毛猫',
        birthday: '2022-07-01',
        weightKg: 4.2,
        vaccineValidUntil: '2026-12-01',
        neutered: false,
        temperamentTags: ['胆小', '安静'],
      },
    ]);

    /* ---- 服务项：grooming 6 + boarding 4（boarding 含房型，按晚计费 duration 留空） ---- */
    await tx.insert(schema.services).values([
      { storeId: store.id, type: 'grooming', name: '基础洗护（小型犬）', durationMin: 60, priceFen: 8800 },
      { storeId: store.id, type: 'grooming', name: '基础洗护（中型犬）', durationMin: 90, priceFen: 12800 },
      { storeId: store.id, type: 'grooming', name: '猫咪精致洗护', durationMin: 90, priceFen: 16800 },
      { storeId: store.id, type: 'grooming', name: '造型修剪', durationMin: 120, priceFen: 19800 },
      { storeId: store.id, type: 'grooming', name: '深层清洁 SPA', durationMin: 120, priceFen: 25800 },
      { storeId: store.id, type: 'grooming', name: '快速洗+吹干', durationMin: 45, priceFen: 6800 },
      { storeId: store.id, type: 'boarding', name: '标准间寄养（犬）', boardingRoomType: '标准间', priceFen: 19900 },
      { storeId: store.id, type: 'boarding', name: '豪华间寄养（犬）', boardingRoomType: '豪华间', priceFen: 29900 },
      { storeId: store.id, type: 'boarding', name: '猫专属间寄养', boardingRoomType: '猫别墅', priceFen: 25900 },
      { storeId: store.id, type: 'boarding', name: '豪华猫别墅寄养', boardingRoomType: '豪华猫别墅', priceFen: 35900 },
    ]);

    /* ---- 商品：主粮/零食/玩具/清洁（images 用 /products/*.svg 占位图） ---- */
    await tx.insert(schema.products).values([
      { storeId: store.id, category: '主粮', name: '全价成犬粮 2kg', description: '鸡肉味全价犬粮', images: ['/products/staple-1.svg'], priceFen: 12900, stock: 50 },
      { storeId: store.id, category: '主粮', name: '全价成猫粮 1.5kg', description: '三文鱼配方', images: ['/products/staple-2.svg'], priceFen: 11900, stock: 60 },
      { storeId: store.id, category: '主粮', name: '幼犬奶糕粮 1kg', description: '离乳期幼犬适用', images: ['/products/staple-3.svg'], priceFen: 9900, stock: 40 },
      { storeId: store.id, category: '零食', name: '风干鸡肉干 100g', description: '纯鸡肉低温风干', images: ['/products/snack-1.svg'], priceFen: 4900, stock: 100 },
      { storeId: store.id, category: '零食', name: '猫条混合装 12 支', description: '金枪鱼+鸡肉', images: ['/products/snack-2.svg'], priceFen: 2900, stock: 120 },
      { storeId: store.id, category: '零食', name: '洁齿磨牙棒 7 支', description: '犬用洁齿零食', images: ['/products/snack-3.svg'], priceFen: 3900, stock: 80 },
      { storeId: store.id, category: '玩具', name: '发声橡胶球', description: '耐咬发声玩具', images: ['/products/toy-1.svg'], priceFen: 1900, stock: 70 },
      { storeId: store.id, category: '玩具', name: '羽毛逗猫棒', description: '可替换羽毛头', images: ['/products/toy-2.svg'], priceFen: 1500, stock: 90 },
      { storeId: store.id, category: '清洁', name: '宠物通用香波 500ml', description: '温和低敏配方', images: ['/products/clean-1.svg'], priceFen: 5900, stock: 45 },
      { storeId: store.id, category: '清洁', name: '豆腐猫砂 6L', description: '低尘可冲厕', images: ['/products/clean-2.svg'], priceFen: 4900, stock: 55 },
    ]);

    /* ---- 时段库存：未来 7 天 × 22 个 30min 时段 = 154 条，capacity=2 ---- */
    await tx.insert(schema.storeSlots).values(
      buildSlots().map((slotStart) => ({
        storeId: store.id,
        slotStart,
        capacity: 2,
        bookedCount: 0,
      })),
    );
  });

  /* ---- 打印各表行数 ---- */
  const TABLES: Array<[string, string]> = [
    ['users', 'users'],
    ['user_roles', 'user_roles'],
    ['stores', 'stores'],
    ['staff', 'staff'],
    ['staff_invites', 'staff_invites'],
    ['pets', 'pets'],
    ['services', 'services'],
    ['appointments', 'appointments'],
    ['store_slots', 'store_slots'],
    ['appointment_steps', 'appointment_steps'],
    ['step_photos', 'step_photos'],
    ['boarding_stays', 'boarding_stays'],
    ['boarding_daily_logs', 'boarding_daily_logs'],
    ['products', 'products'],
    ['orders', 'orders'],
    ['push_subscriptions', 'push_subscriptions'],
    ['event_outbox', 'event_outbox'],
    ['notifications', 'notifications'],
  ];

  console.log('[seed] 完成，各表行数：');
  for (const [label, table] of TABLES) {
    // TABLES 为脚本内固定常量，直接拼 SQL 字符串即可
    const r = await client.execute(`SELECT COUNT(*) AS c FROM ${table}`);
    console.log(`  ${label.padEnd(22)} ${String(r.rows[0].c)}`);
  }
}

await main();
client.close();
