/**
 * 种子脚本（npm run db:seed）
 *
 * 幂等策略：重跑时先按「子表 -> 父表」顺序清空全部业务表，再重新插入，
 * 因此重复执行不会产生重复数据。
 *
 * 种子内容：
 * - 1 门店（菲丽亚宠物·示例店，open_hours 全周 09:00-20:00）
 * - 1 店主用户（merchant_owner）+ 3 员工用户（staff 角色 + staff 记录，技能覆盖
 *   wash/groom/boarding；批次 S1 岗位角色：小美=frontdesk，阿强/丽丽=groomer）+ 1 客户用户（customer）
 * - 2 宠物（1 狗 1 猫，含疫苗有效期）
 * - 10 服务项（grooming 6 + boarding 4，boarding 含房型）
 * - 10 商品（分类覆盖 主粮/零食/玩具/清洁，images 用 /products/*.svg 占位图（scripts/gen-product-placeholders.mjs 生成））
 * - store_slots：明天起未来 7 天，30min 粒度，09:00-19:30，capacity=2（154 条）
 * - 批次 staff-2（R7~R10）：commission_rules 种子 22 行（提成规则表 V1.3 全表，
 *   含作废/备用/预留行 active=0）、xp_rules 种子 23 行（附件一 V1.0 全表，拉新置灰）、
 *   员工 grade（丽丽=G2、阿强=G1、小美=P1）、3 个安心包商品（category='care_package'，
 *   含 20 天后到期 1 个 + 消毒耗材 1 个）
 *
 * 结束打印各表行数。
 *
 * 注：整个清空+插入包在一个事务里。SQLite 单写者模型下行锁天然安全；
 * 未来切 MySQL 该事务结构语义不变。
 */

import { client, db, schema } from './index';

/* ---------------- 清空（子表 -> 父表） ---------------- */

const CLEAR_ORDER = [
  /* ---- staff-2（R7~R10）新表：全部子表须先于各自父表清空 ---- */
  schema.overworkApprovals, // FK → stores/staff/users（0012 产能红线批准留痕）
  schema.receptionLogs, // FK → cashier_bills/appointments/users（0012 起 bill_id 可空+appointment_id）
  schema.attendanceApprovals, // FK → attendance_records/staff/stores/users
  schema.attendanceRecords, // FK → staff/stores/users
  schema.inventoryCountItems, // FK → inventory_counts/products
  schema.inventoryCounts, // FK → stores/users
  schema.stockMovements, // FK → products/stores/users
  schema.commissionSnapshots, // FK → stores/staff
  schema.deductionRecords, // FK → stores/staff/users
  schema.performanceGrades, // FK → stores/staff/users
  schema.xpEvents, // FK → stores/staff/users
  schema.xpLevels, // FK → stores/staff
  schema.reviews, // FK → appointments/stores/users/staff
  schema.commissionRules, // FK → users
  schema.durationRules, // FK → users（补充令① 时长系数配置表）
  schema.xpRules, // FK → users
  schema.ruleConfigVersions, // FK → users
  /* ---- 既有表（原顺序不动） ---- */
  schema.cashierPayments, // M1 收银台（FK → cashier_bills/member_pass），须先于父表清空
  schema.cashierBillItems,
  schema.cashierBills,
  /* staff-2 闸门修复：补齐 M1-补2 域清表（cashier_bills.shift_id → shifts，故须在 shifts 前；
     dayCloses → shifts/stores/users；储值三表 logs→accounts，均 → users/stores） */
  schema.dayCloses,
  schema.shifts,
  schema.storedValueLogs,
  schema.storedValueImportBatches,
  schema.storedValueAccounts,
  schema.stepPhotos,
  schema.appointmentSteps,
  schema.boardingDailyLogs,
  schema.boardingStays,
  schema.passDeductLogs, // B2-7 表（FK → appointments/member_pass），须先于父表清空
  schema.memberPasses,
  schema.appointments,
  schema.boardingSlots,
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

/** 距今天 N 天的时点（安心包效期演示数据用） */
const daysFromNow = (days: number): Date => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  console.log('[seed] 开始（先清空业务表，保证幂等）…');

  await db.transaction(async (tx) => {
    for (const table of CLEAR_ORDER) {
      await tx.delete(table);
    }

    /* ---- 用户与角色 ---- */
    const [owner, staffUser1, staffUser2, staffUser3, clerkUser, customer] = await tx
      .insert(schema.users)
      .values([
        { kimiId: 'seed_kimi_owner', nickname: '菲丽亚店主', phone: '13900000001' },
        { kimiId: 'seed_kimi_staff1', nickname: '小美', phone: '13900000002' },
        { kimiId: 'seed_kimi_staff2', nickname: '阿强', phone: '13900000003' },
        { kimiId: 'seed_kimi_staff3', nickname: '丽丽', phone: '13900000004' },
        { kimiId: 'seed_kimi_clerk', nickname: '小周', phone: '13900000005' },
        { kimiId: 'seed_kimi_customer', nickname: '示例客户', phone: '13800000000' },
      ])
      .returning();

    await tx.insert(schema.userRoles).values([
      { userId: owner.id, role: 'merchant_owner' },
      { userId: staffUser1.id, role: 'staff' },
      { userId: staffUser2.id, role: 'staff' },
      { userId: staffUser3.id, role: 'staff' },
      /* staff-2 闸门修复：补齐 merchant_clerk 三级账号种子（smoke-deploy 既有断言 seed_clerk；
         口径=users + user_roles(merchant_clerk) + staff 行绑店，同 middleware 登记口径） */
      { userId: clerkUser.id, role: 'merchant_clerk' },
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

    /* ---- 员工（批次 S1 双角色：小美=前台 frontdesk；阿强/丽丽=美容师 groomer；
       批次 staff-2 R9 附带列 grade：丽丽=G2、阿强=G1、小美=P1） ---- */
    const staffRows = await tx
      .insert(schema.staff)
      .values([
        {
          storeId: store.id,
          userId: staffUser1.id,
          name: '小美',
          role: 'frontdesk',
          skills: ['wash', 'groom'],
          schedule: STAFF_SCHEDULE,
          status: 'active',
          grade: 'P1',
        },
        {
          storeId: store.id,
          userId: staffUser2.id,
          name: '阿强',
          role: 'groomer',
          skills: ['wash', 'boarding'],
          schedule: STAFF_SCHEDULE,
          status: 'active',
          grade: 'G1',
        },
        {
          storeId: store.id,
          userId: staffUser3.id,
          name: '丽丽',
          role: 'groomer',
          skills: ['groom', 'boarding'],
          schedule: STAFF_SCHEDULE,
          status: 'active',
          grade: 'G2',
        },
        {
          storeId: store.id,
          userId: clerkUser.id,
          name: '小周',
          role: 'frontdesk',
          skills: ['wash'],
          schedule: STAFF_SCHEDULE,
          status: 'active',
          grade: 'P0',
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
      { storeId: store.id, type: 'boarding', name: '标准间寄养（犬）', boardingRoomType: '标准间', roomCount: 2, priceFen: 19900 },
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
      /* staff-2 R8 安心包演示数据：category='care_package' 单独成类 */
      { storeId: store.id, category: 'care_package', name: '安心包·离店洗护护理包', description: '洗护后居家护理套装', images: ['/products/clean-1.svg'], priceFen: 9900, stock: 30, expiresAt: daysFromNow(20) },
      { storeId: store.id, category: 'care_package', name: '安心包·消毒耗材包', description: '消毒步骤耗材（消毒步完成自动扣 1 落流水）', images: ['/products/clean-2.svg'], priceFen: 1900, stock: 100, isDisinfectionSupply: true },
      { storeId: store.id, category: 'care_package', name: '安心包·寄养陪伴包', description: '寄养离店陪伴套装', images: ['/products/toy-1.svg'], priceFen: 5900, stock: 20 },
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

    /* ---- staff-2 R9：提成规则配置种子（《提成规则表 V1.3》全表照转，version=1，改数不改码） ----
     * 数值口径：比例/系数/倍率统一 bp（万分比，10000=1.0=100%），定额统一分（fen）。
     * 生效时间=V1.3 老板拍板日（2026-09-20）；作废/备用/预留行 active=false 落库留痕。
     */
    const RULES_EFFECTIVE_FROM = new Date('2026-09-20T00:00:00+08:00');
    const commissionSeed = (ruleKey: string, label: string, valueJson: schema.RuleConfigValue, active = true) => ({
      version: 1,
      ruleKey,
      label,
      valueJson,
      effectiveFrom: RULES_EFFECTIVE_FROM,
      active,
      createdBy: owner.id,
    });
    await tx.insert(schema.commissionRules).values([
      /* —— 提成规则总表（V1.3 §一 全行）—— */
      commissionSeed('commission_grooming_rate', '美容师洗美服务提成（G1-G4）：当单门市价 20%（会员折扣差额门店承担；券核销单同按门市价；门店统一促销特价单按实收）', { rate_bp: 2000 }),
      commissionSeed('commission_grooming_assistant_g0_rate', '美容师学徒洗护助理提成（G0）：当单门市价 5%；scope=bath 仅洗护单不含造型（默认，洗护判别读 duration_service_kind_keywords 关键词表）/ scope=all 全部 grooming 单（老板端口可调）', { rate_bp: 500, scope: 'bath' }),
      commissionSeed('commission_mentor_split', '师徒带教组合单拆分：按徒弟当单门市价，徒弟计件 80%、师傅加计 20%', { split_bp: { apprentice: 8000, mentor: 2000 } }),
      commissionSeed('commission_overwork_multiplier', '美容师产能红线加计：日超 8 只须店长批准，超出部分按 1.5 倍计', { threshold_per_day: 8, multiplier_bp: 15000 }),
      commissionSeed('commission_g4_store_rate', '美容师 G4 全店管理提成：本店月度洗美营收（门市价）0.5%，对全店技术质量负责', { rate_bp: 50 }),
      commissionSeed('commission_product_rate', '前台商品销售提成（P0-P2）：个人月度商品销售额（实收）一刀切 5%', { rate_bp: 500 }),
      commissionSeed('commission_card_fixed', '年费会员售卡定额：萤火199→5元/单、烛光299→10元/单、暖阳599→20元/单、微光免费档无提成', { fixed_fen_by_plan: { '萤火199': 500, '烛光299': 1000, '暖阳599': 2000, '微光免费档': 0 } }),
      commissionSeed('commission_stored_value_topup', '储值充值提成（已作废：储值新售冻结·决策15，旧充值提成口径作废）', {}, false),
      commissionSeed('commission_live_animal_rate', '活体销售提成（备用）：个人月度活体销售额 5%-10%，活体收缩中保留口径备用', { rate_bp_min: 500, rate_bp_max: 1000 }, false),
      commissionSeed('commission_probation_multiplier', '试用期前台提成：同 P0 基数按 P0 标准×50%（试用期不设绩效与全勤）', { multiplier_bp: 5000 }),
      commissionSeed('commission_p3_personal', '店长 P3 个人提成：本人开单按前台口径（同前台规则）', { same_as: 'frontdesk' }),
      commissionSeed('commission_p3_store_rate', '店长 P3 全店提成：全店服务营收 1%（商品/年费不进全店提成，会员新增已在店长绩效权重中）', { rate_bp: 100 }),
      commissionSeed('commission_p4_region_rate', '区域店长 P4 区域提成：区域营收，比例待补（P4 暂无在岗，schema 预留）', {}, false),
      /* —— 绩效（V1.3 §二：Philia 绩效口径=洗美营收 5% 额外奖励，季度考核季度发放，SABCD 五档系数）—— */
      commissionSeed('perf_base_rate', '绩效基数比例：当季本人操作（美容师）/本人接待归属（前台）洗美营收·门市价 ×5%（同源双计两池分列）', { rate_bp: 500 }),
      commissionSeed('perf_coeff_s', '绩效系数 S 档（1.2）', { coeff_bp: 12000 }),
      commissionSeed('perf_coeff_a', '绩效系数 A 档（1.0）', { coeff_bp: 10000 }),
      commissionSeed('perf_coeff_b', '绩效系数 B 档（0.8）', { coeff_bp: 8000 }),
      commissionSeed('perf_coeff_c', '绩效系数 C 档（0.5）', { coeff_bp: 5000 }),
      commissionSeed('perf_coeff_d', '绩效系数 D 档（0）', { coeff_bp: 0 }),
      /* —— 计提与结算（V1.3 §三）+ 扣减红线 —— */
      commissionSeed('perf_deduction_cap_bp', '绩效扣减当月累计上限：≤当月绩效 50%（只扣绩效不扣提成，超限拒写）', { cap_bp: 5000 }),
      commissionSeed('settlement_day', '结算日：次月 15 日随工资发放', { day: 15 }),
      commissionSeed('snapshot_day', '月度快照：每月 1 日 02:00（季度绩效同 15 日口径快照）', { day: 1, hour: 2 }),
    ]);

    /* ---- 补充令①：时长规则配置种子（决策 #39/#40，version=1） ----
     * 初始值=原 durationEngine.ts 占位常量（第 35-72 行）照转，label 注「占位待供给」；
     * 引擎/G0 洗护判别（决策 #40 共用 duration_service_kind_keywords）只读表，改数不改码。
     */
    const durationSeed = (ruleKey: string, label: string, valueJson: schema.RuleConfigValue) => ({
      version: 1,
      ruleKey,
      label,
      valueJson,
      effectiveFrom: RULES_EFFECTIVE_FROM,
      active: true,
      createdBy: owner.id,
    });
    await tx.insert(schema.durationRules).values([
      durationSeed('duration_base_min', '基础时长（分钟）：物种×服务种类（占位待供给）', { dog: { bath: 60, groom: 90 }, cat: { bath: 90, groom: 120 } }),
      durationSeed('duration_size_coef', '体型系数：小/中/大型（占位待供给）', { small: 1.0, medium: 1.5, large: 2.0 }),
      durationSeed('duration_coat_coef', '毛长系数：短毛/长毛（占位待供给）', { short: 1.0, long: 1.25 }),
      durationSeed('duration_size_tier_weight_kg', '体型分档体重阈值（kg）：weight<smallMax→小，smallMax≤weight≤mediumMax→中，>mediumMax→大（占位待供给）', { dog: { smallMax: 10, mediumMax: 25 }, cat: { smallMax: 5, mediumMax: 10 } }),
      durationSeed('duration_long_coat_breeds', '长毛品种关键词（pets.breed 子串命中即长毛，未命中短毛）（占位待供给）', { keywords: ['金毛', '萨摩', '阿拉斯加', '哈士奇', '二哈', '边牧', '边境牧羊', '苏牧', '苏格兰牧羊', '古牧', '古代牧羊', '松狮', '博美', '比熊', '泰迪', '贵宾', '雪纳瑞', '喜乐蒂', '藏獒', '布偶', '波斯', '缅因', '挪威森林', '西森', '金吉拉', '英长', '英国长毛', '长毛'] }),
      durationSeed('duration_service_kind_keywords', '服务种类关键词（服务名命中即归类，bath 先于 groom 判定；时长引擎与 G0 洗护判别共用·决策 #40）（占位待供给）', { bath: ['洗', '浴', 'SPA', 'spa', '清洁', '吹干'], groom: ['美容', '造型', '修剪', '修毛', '剪'] }),
    ]);

    /* ---- staff-2 R10：XP 规则配置种子（附件一冻结版 V1.0 全表照转，version=1） ----
     * 分值单位 XP 点；段位门槛/保级线为累计/月增量 XP；拉新 referral 置灰（active=false，
     * 随会员游戏化批 G3 链路开通，server 拒写该来源）。
     */
    const xpSeed = (ruleKey: string, label: string, valueJson: schema.RuleConfigValue, active = true) => ({
      version: 1,
      ruleKey,
      label,
      valueJson,
      effectiveFrom: RULES_EFFECTIVE_FROM,
      active,
      createdBy: owner.id,
    });
    await tx.insert(schema.xpRules).values([
      /* —— 六来源分值（附件一 §一）—— */
      xpSeed('xp_attendance_daily', '出勤：正常打卡全勤 +5/天（迟到/早退当天不得出勤分不扣分；补卡通过视同正常）', { points: 5 }),
      xpSeed('xp_service_order', '服务量：完成一单服务（六步全走完）+2/单', { points: 2 }),
      xpSeed('xp_service_boarding_night', '服务量：寄养按晚计 +2/晚', { points: 2 }),
      xpSeed('xp_review_5_star', '客户好评：评价 5 星 +6/单（匿名评价同权）', { points: 6 }),
      xpSeed('xp_review_4_star', '客户好评：评价 4 星 +3/单', { points: 3 }),
      xpSeed('xp_penalty_low_star', '差评扣分：评价 ≤2 星 −8/单（扣分不扣款，申诉改判后冲正）', { points: -8 }),
      xpSeed('xp_exam_p0', '考试学习：六步考试 P0 通过 +30（学习通道单列，不计日上限）', { points: 30 }),
      xpSeed('xp_exam_p1', '考试学习：六步考试 P1 通过 +50（学习通道单列，不计日上限）', { points: 50 }),
      xpSeed('xp_exam_p2', '考试学习：六步考试 P2 通过 +80（学习通道单列，不计日上限）', { points: 80 }),
      xpSeed('xp_cover_shift', '临时补位：非本人班次顶班（店长指派留痕为准）+15/次', { points: 15 }),
      xpSeed('xp_referral', '拉新拓客（置灰：随会员游戏化批 G3 链路开通，server 拒写+页面无邀新入口）', {}, false),
      /* —— 每日上限与防刷（附件一 §二）—— */
      xpSeed('xp_daily_cap', '每日上限：日常五来源（出勤/服务量/好评/拉新/补位）日合计 60 XP，超出丢弃+留痕；考试 XP 不占此额度', { cap: 60 }),
      xpSeed('xp_exam_monthly_limit', '防刷：考试每级每月最多计 1 次', { limit: 1 }),
      xpSeed('xp_review_daily_limit_per_customer', '防刷：同一客户对同一员工当日好评只计 1 次', { limit: 1 }),
      /* —— 五段位门槛（附件一 §三，累计 XP）—— */
      xpSeed('xp_level_threshold_0', '段位门槛·嫩芽：累计 0（入职即）', { level: 0, name: '嫩芽', threshold: 0 }),
      xpSeed('xp_level_threshold_1', '段位门槛·熟手：累计 300（排班建议序+1）', { level: 1, name: '熟手', threshold: 300 }),
      xpSeed('xp_level_threshold_2', '段位门槛·能手：累计 900（解锁 P2 考试资格）', { level: 2, name: '能手', threshold: 900 }),
      xpSeed('xp_level_threshold_3', '段位门槛·掌柜：累计 2000（晋升提名候选）', { level: 3, name: '掌柜', threshold: 2000 }),
      xpSeed('xp_level_threshold_4', '段位门槛·导师：累计 4000（月度之星候选+带教资格）', { level: 4, name: '导师', threshold: 4000 }),
      /* —— 月度保级线（附件一 §四 V1.0 固定值：月增量≥保级线保级，不足降一级，累计不清零；嫩芽无保级）—— */
      xpSeed('xp_retention_1', '月度保级线·熟手：月增量 150', { level: 1, name: '熟手', monthly_xp: 150 }),
      xpSeed('xp_retention_2', '月度保级线·能手：月增量 300', { level: 2, name: '能手', monthly_xp: 300 }),
      xpSeed('xp_retention_3', '月度保级线·掌柜：月增量 500', { level: 3, name: '掌柜', monthly_xp: 500 }),
      xpSeed('xp_retention_4', '月度保级线·导师：月增量 700', { level: 4, name: '导师', monthly_xp: 700 }),
    ]);
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
    ['boarding_slots', 'boarding_slots'],
    ['appointment_steps', 'appointment_steps'],
    ['step_photos', 'step_photos'],
    ['boarding_stays', 'boarding_stays'],
    ['boarding_daily_logs', 'boarding_daily_logs'],
    ['products', 'products'],
    ['orders', 'orders'],
    ['cashier_bills', 'cashier_bills'],
    ['cashier_bill_items', 'cashier_bill_items'],
    ['cashier_payments', 'cashier_payments'],
    ['push_subscriptions', 'push_subscriptions'],
    ['event_outbox', 'event_outbox'],
    ['notifications', 'notifications'],
    /* staff-2（R7~R10）新表 */
    ['attendance_records', 'attendance_records'],
    ['attendance_approvals', 'attendance_approvals'],
    ['stock_movements', 'stock_movements'],
    ['inventory_counts', 'inventory_counts'],
    ['inventory_count_items', 'inventory_count_items'],
    ['commission_rules', 'commission_rules'],
    ['duration_rules', 'duration_rules'],
    ['commission_snapshots', 'commission_snapshots'],
    ['deduction_records', 'deduction_records'],
    ['performance_grades', 'performance_grades'],
    ['reception_logs', 'reception_logs'],
    ['overwork_approvals', 'overwork_approvals'],
    ['xp_events', 'xp_events'],
    ['xp_levels', 'xp_levels'],
    ['xp_rules', 'xp_rules'],
    ['reviews', 'reviews'],
    ['rule_config_versions', 'rule_config_versions'],
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
