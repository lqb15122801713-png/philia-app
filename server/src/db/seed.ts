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
import { COPY_SEED_ROWS } from './copySeedRows';
import { SLOT_SEED_ROWS } from './slotSeedRows';

/* ---------------- 清空（子表 -> 父表） ---------------- */

const CLEAR_ORDER = [
  /* ---- 客户端体验大批 片 3 新表（迁移 0040）：子父序，先于 users/stores/pets/products/orders 清空 ---- */
  schema.couponGrants, // FK → coupons/users/orders，先于三者清空
  schema.coupons, // FK → stores/users
  schema.productReviews, // FK → orders/products/stores/users
  schema.favorites, // FK → users/products
  schema.memberPerkGrants, // FK → users/stores/pets
  /* ---- 客户端体验大批 片 1 新表（迁移 0036）：先于 users/stores/appointments 清空（子父序）；
     users 扩列 birthday/gender 不种（空=诚实未填） ---- */
  schema.depositRecords, // FK → stores/users/appointments（ref_appointment_id），先于三者清空
  schema.addresses, // FK → users
  schema.invoiceTitles, // FK → users
  /* ---- 客户端体验大批片 4 新表（迁移 0042）：子表先父表，先于 appointments/boardingStays/pets/users 清空 ---- */
  schema.serviceIncidents, // FK → appointments/stores/pets/users
  schema.boardingUnsealLogs, // FK → boarding_stays/staff
  schema.petHealthRecords, // FK → pets/users
  schema.petWeightLogs, // FK → pets/users
  /* ---- 客户端体验大批片 5 新表（迁移 0044）：子表先父表，先于 stores/staff/users/appointments 清空 ---- */
  schema.metricAppeals, // FK → stores/staff/users
  schema.contentEvents, // FK → users/appointments/stores
  schema.productImportBatches, // FK → stores/users
  /* ---- 片 4 薪资+XP 域新表（迁移 0033）：子表先父表，先于 users/stores/staff/appointments/xpEvents 清空 ---- */
  schema.payrollItems, // FK → payroll_runs/stores/staff
  schema.payrollRuns, // FK → stores/users
  schema.payrollAppeals, // FK → stores/staff/users
  schema.xpApplications, // FK → stores/staff/users/xp_events（先于 xpEvents 清空）
  schema.appointmentCollaborators, // FK → appointments/staff/users（先于 appointments 清空）
  /* ---- 片 3 任务协作域新表：子表先父表，先于 users/stores/appointments 清空（e2e 自建夹具，无种子数据） ---- */
  schema.announcementReads, // FK → announcements/users
  schema.announcements, // FK → stores/users
  schema.shiftHandoverLogs, // FK → shifts/stores/users
  schema.staffExitHandoffs, // FK → stores/staff/users
  schema.selfCheckRuns, // FK → stores/users
  schema.pdcaIssues, // FK → stores/users/staff
  schema.taskRuns, // FK → task_templates/stores/staff/users
  schema.taskTemplates, // FK → stores/staff/users
  /* ---- 补缺大批片 4 新表：子表先父表，先于 users/stores/appointments 清空 ---- */
  schema.invoiceRequests, // FK → users/stores
  schema.supportTickets, // FK → users/stores
  schema.serviceReports, // FK → appointments/users
  schema.serviceCertificates, // FK → appointments/users
  schema.serviceRules, // FK → users
  schema.copyOverrides, // 端口批片 B（FK → users），先于 users 清空
  schema.slotContents, // 端口批片 C（FK → users），先于 users 清空
  /* ---- R11a 会员前置批新表：子表先父表（rebate_logs.settlement_id→rebate_settlements），先于 users/stores 清空 ---- */
  schema.membershipEvents, // 补缺-3（FK → users），先于 users 清空
  schema.rebateLogs, // FK → users/rebate_accounts/rebate_settlements
  schema.rebateAccounts, // FK → users
  schema.rebateSettlements, // 独立（被 rebate_logs 引用）
  schema.memberships, // FK → users/stores
  schema.memberPlans, // FK → users
  /* ---- R12 退款专项新表：子表先父表，先于 cashier 域与 users 清空 ---- */
  schema.refundRequests, // C5 客户退款申请（FK → users/stores），先于父表清空
  schema.refundBillItems, // FK → refund_bills/cashier_bill_items/cashier_payments
  schema.refundBills, // FK → stores/cashier_bills/users
  schema.refundRules, // FK → users
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
  /* ---- 客户端体验大批片 2 新表（迁移 0038）：子表先父表，先于 appointments 清空 ---- */
  schema.appointmentAddons, // FK → appointments/services
  schema.prepaidRecords, // FK → appointments/users/stores
  schema.appointmentRescheduleLogs, // FK → appointments/users
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
        phone: '0571-88886666', // 体验批片 4：电话客服公示种子（联系门店 tel: 透出）
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

    /* ---- 宠物（1 狗 1 猫，含疫苗有效期；体验批片 4：芯片号/花色示范值） ---- */
    const petRows = await tx
      .insert(schema.pets)
      .values([
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
          chipNo: '900118000123456',
          coatColor: '金色',
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
          coatColor: '蓝白',
        },
      ])
      .returning();

    /* ---- 体验批片 4：健康记录/体重记录示范数据（宠物页趋势雏形有真值可看） ---- */
    const wc = petRows.find((p) => p.name === '旺财')!;
    await tx.insert(schema.petHealthRecords).values([
      {
        petId: wc.id,
        type: 'vaccine',
        title: '犬四联疫苗（加强）',
        recordDate: '2026-03-01',
        nextDueDate: '2027-03-01',
        note: '示例宠物医院接种',
        createdBy: customer.id,
      },
      {
        petId: wc.id,
        type: 'deworm',
        title: '体内外同驱（滴剂）',
        recordDate: '2026-09-10',
        nextDueDate: '2026-12-10',
        createdBy: customer.id,
      },
      {
        petId: wc.id,
        type: 'vet_visit',
        title: '年度体检',
        recordDate: '2026-06-18',
        note: '指标正常，注意控制体重',
        createdBy: customer.id,
      },
    ]);
    await tx.insert(schema.petWeightLogs).values([
      { petId: wc.id, weightKg: 27.2, measuredAt: '2026-07-01', createdBy: customer.id },
      { petId: wc.id, weightKg: 27.9, measuredAt: '2026-08-01', createdBy: customer.id },
      { petId: wc.id, weightKg: 28.5, measuredAt: '2026-09-01', createdBy: customer.id, note: '入住前称重同步' },
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
      /* —— 片 4 B3-2 协作拆分缺省建议比（同 0033 迁移种子口径；重置后补种） —— */
      commissionSeed('commission_collab_split_default', '多人协作单拆分缺省建议比例：协作人默认 50%（5000bp；setCollaborators 缺省建议值，页面注记数据源）', { splitBp: 5000 }),
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

    /* ---- R12 退款专项：退款规则配置种子（冻结版 V1.0 §九，version=1） ----
     * 阈值按「原单累计退款额」校验（V1：已退累计+本次申请>阈值即须店主，堵拆分绕过）；
     * 配置端口第四域 domain='refund'，保存即生效+版本化留痕。
     */
    const refundSeed = (ruleKey: string, label: string, valueJson: schema.RuleConfigValue) => ({
      version: 1,
      ruleKey,
      label,
      valueJson,
      effectiveFrom: RULES_EFFECTIVE_FROM,
      active: true,
      createdBy: owner.id,
    });
    await tx.insert(schema.refundRules).values([
      refundSeed('refund_threshold_fen', '退款店长阈值：原单累计退款额超过此额须店主（默认 ¥500，R12 冻结版 V1.0 §九待老板终拍口径）', { threshold_fen: 50000 }),
      // 修复包 PR-1（PD-02 件 6 · CJ-0923-20① 留口）：超阈值落 draft 开关，默认关=维持硬拒
      refundSeed('refund_over_threshold_to_draft', '退款超阈值落 draft 待批（默认关=维持硬拒；开=落申请行，店主重新执行）', { enabled: false }),
      // C5 客户退款申请五键（同 0017 幂等迁移种子；seed 清表重建须保持配置宇宙完整，config.save 只改既有键）
      refundSeed('refund_request_enabled', '客户退款申请开关', { enabled: true }),
      refundSeed('refund_apply_window_days', '退款申请时限（天）', { days: 30 }),
      refundSeed('refund_free_regret_hours', '免费反悔窗口（小时）', { hour: 24 }),
      refundSeed('refund_reason_options', '退款原因枚举', { keywords: ['服务不满意', '商品与描述不符', '拍错/多拍', '未按约定时间服务', '宠物健康原因', '其他（请补充说明）'] }),
      refundSeed('refund_sla_hours', '退款审批 SLA（小时）', { hour: 24 }),
    ]);

    /* ---- R11a 会员前置批：会员档位配置种子（冻结版 V1.0 §二 + CJ-0922-13，version=1） ----
     * 四档数值照 27 号档照转：微光免费（无回馈金无折扣）/萤火 ¥199·2%·88折/烛光 ¥299·5%·85折/
     * 暖阳 ¥599·10%·8折；多宠全档统一：含 3 只、第 4 只起 +¥59/年/只、10 只封顶；
     * 回馈金次月 5 日到账（故障顺延≤3 天页面明示）；回馈金/会员有效期均 365 天。
     * 片 3：四档 value_json 补种 renew_discount_bp=10000（续费优惠端口键，10000=无优惠
     * 缺省口径；存量库同值回挂见迁移 0040 json_set 幂等段）。
     * 配置端口域 domain='member_plans'，保存即生效+版本化留痕，新值只管新单。
     * 既有种子客户「示例客户」不开会员（留 e2e 自造）。
     */
    const planSeed = (ruleKey: string, label: string, valueJson: schema.RuleConfigValue) => ({
      version: 1,
      ruleKey,
      label,
      valueJson,
      effectiveFrom: RULES_EFFECTIVE_FROM,
      active: true,
      createdBy: owner.id,
    });
    await tx.insert(schema.memberPlans).values([
      planSeed('plan_weiguang', '会员档·微光：免费档（手机号即会员）；无回馈金、无服务折扣；安心包全员免费（钩子仅权益表述，微光不设钩子）', { free: true, price_fen: 0, rebate_bp: 0, service_discount_bp: 10000, included_pets: 3, extra_pet_fen: 5900, max_pets: 10, renew_discount_bp: 10000, advance_book_days: 3 }),
      planSeed('plan_yinghuo', '会员档·萤火：¥199/年；商品消费回馈金 2%；服务 88 折；含 3 只宠物，第 4 只起 +¥59/年/只，10 只封顶', { price_fen: 19900, rebate_bp: 200, service_discount_bp: 8800, included_pets: 3, extra_pet_fen: 5900, max_pets: 10, renew_discount_bp: 10000, advance_book_days: 7 }),
      planSeed('plan_zhuguang', '会员档·烛光：¥299/年；商品消费回馈金 5%；服务 85 折；含 3 只宠物，第 4 只起 +¥59/年/只，10 只封顶', { price_fen: 29900, rebate_bp: 500, service_discount_bp: 8500, included_pets: 3, extra_pet_fen: 5900, max_pets: 10, renew_discount_bp: 10000, advance_book_days: 7 }),
      planSeed('plan_nuanyang', '会员档·暖阳：¥599/年；商品消费回馈金 10%；服务 8 折；含 3 只宠物，第 4 只起 +¥59/年/只，10 只封顶', { price_fen: 59900, rebate_bp: 1000, service_discount_bp: 8000, included_pets: 3, extra_pet_fen: 5900, max_pets: 10, renew_discount_bp: 10000, advance_book_days: 14 }),
      planSeed('rebate_settlement_day', '回馈金到账日：次月 5 日统一到账（故障顺延≤3 天，会员页明示口径）', { day: 5 }),
      planSeed('rebate_validity_days', '回馈金有效期：365 天', { days: 365 }),
      planSeed('membership_validity_days', '会员有效期：365 天（到期不续费冻结，余额在不可用；续费解冻；退卡清零）', { days: 365 }),
      // 修复包 PR-4 读侧启用（PD-05 件 2 · CJ-0925-10②）：注册默认档端口化，本批先入种子
      planSeed('default_plan_key', '注册默认会员档（自助开档落档键；端口可改）', { value: 'plan_weiguang' }),
      /* ---- 补缺-3（46 号档+PD-07）会员升级/换档/防滥用端口键（未知 rule_key 配置端口硬拒，
         故必先入种子；存量库同值回挂见迁移 0017 尾部 WHERE NOT EXISTS 幂等段） ---- */
      planSeed('member_change_window_days', '到期换档预约窗口：到期前 N 天开放预约下期档位（任意档；期内只升不降，低档走本预约通道）', { days: 30 }),
      planSeed('member_cancel_cooldown_days', '退会重购留痕窗口：退会后 N 天内重购记 cancel_rebuy_note（只留痕不拦截）', { days: 90 }),
      planSeed('member_cancel_count_threshold', '累计退会次数阈值：累计退会≥N 次再购记 cancel_rebuy_note（只留痕不拦截）', { threshold: 2 }),
    ]);

    /* ---- 补缺大批片 4：服务域规则配置种子（同构 commission_rules，version=1） ----
     * 配置端口第六域 domain='service'；service_hours=客服服务时间公示（客户端读口
     * serviceLoop.serviceHours），0017 迁移同名幂等种子先行入库，本处为重置后补种。
     */
    await tx.insert(schema.serviceRules).values([
      {
        version: 1,
        ruleKey: 'service_hours',
        label: '客服服务时间（客户端公示文案）',
        valueJson: { text: '09:00–21:00' },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      /* 片 2：考勤断网兜底时限+技能标签集（同 0028 迁移种子口径；重置后补种） */
      {
        version: 1,
        ruleKey: 'attendance_offline_stale_hours',
        label: '断网打卡暂存兜底时限（小时）：本地暂存超 N 小时未补传=自动挂考勤异常申诉链',
        valueJson: { hours: 24 },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      {
        version: 1,
        ruleKey: 'staff_skill_tags',
        label: '员工技能标签集（排班技能匹配用；店长在配置端口维护标签集）',
        valueJson: { tags: ['洗护', '寄养', '美容', '造型', '前台'] },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      /* 片 3：自检表项/心声 SLA/PDCA 类目集（同 0031 迁移种子口径；service_rules 在
         CLEAR_ORDER 内会被重置，本处为重置后补种——不补则端口键被种子抹掉） */
      {
        version: 1,
        ruleKey: 'self_check_items',
        label: '门店每日自检表项（员工逐项打点+拍照留证；店长在配置端口维护表项与分值）',
        valueJson: {
          items: [
            { key: 'disinfect', label: '消毒备台完成', score: 25 },
            { key: 'stock', label: '安心包/库存盘点', score: 25 },
            { key: 'device', label: '设备巡检正常', score: 25 },
            { key: 'env', label: '店堂环境整洁', score: 25 },
          ],
        },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      {
        version: 1,
        ruleKey: 'voice_sla_hours',
        label: '员工心声响应时限（小时）：店长须在该时限内回复，页面注记明面',
        valueJson: { hours: 24 },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      {
        version: 1,
        ruleKey: 'pdca_categories',
        label: 'PDCA 问题类目集（巡检排行分组维度；店长在配置端口维护类目集）',
        valueJson: { categories: ['卫生', '设备', '服务', '安全', '其他'] },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      /* 片 4 B3-5/6：薪资异议申诉 SLA（同 0033 迁移种子口径；service_rules 在 CLEAR_ORDER
         内会被重置，本处为重置后补种——不补则端口键被种子抹掉） */
      {
        version: 1,
        ruleKey: 'payroll_appeal_sla_hours',
        label: '薪资异议申诉处理时限（小时）：店长/老板须在该时限内复核，页面注记数据源',
        valueJson: { hours: 24 },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      /* 片 3（迁移 0040 种子口径；service_rules 在 CLEAR_ORDER 内会被重置，本处为重置后
         补种——不补则端口键被种子抹掉，读口回落缺省同帧） */
      {
        version: 1,
        ruleKey: 'coupon_stack_rule',
        label: '优惠券叠加规则公示（与会员折扣是否同享；公示=只读展示，真抵扣结算候线上收单批）',
        valueJson: { rule: 'none', note: '优惠券不与会员折扣叠加；每单限用 1 张（公示口径）' },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      /* 客户端体验大批片 2（迁移 0038 同口径补种——合部缝合找回：service_rules 重置后补种，
         不补则端口键被种子抹掉，config.save 未知键硬拒） */
      {
        version: 1,
        ruleKey: 'cancel_fee_tiers',
        label: '取消/爽约阶梯收费公示档（距开 N 小时→费比 bp；公示口径=只读展示不扣真费，真通道候资质批）',
        valueJson: {
          tiers: [
            { hoursBefore: 24, feeBp: 0, label: '24 小时前免费取消' },
            { hoursBefore: 4, feeBp: 0, label: '4–24 小时免费（需门店审核）' },
            { hoursBefore: 0, feeBp: 3000, label: '4 小时内/爽约 30%（公示口径，暂不扣款）' },
          ],
        },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      /* 客户端体验大批片 4：定时器四参数（同 0042 迁移种子口径；重置后补种） */
      {
        version: 1,
        ruleKey: 'boarding_daynight_push',
        label: '寄养早晚定时推送刻点（门店时区 HH:MM；窗口 30 分钟内扫到即推，当日当槽幂等）',
        valueJson: { morning: '08:30', evening: '20:30' },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      {
        version: 1,
        ruleKey: 'order_auto_receive_days',
        label: '商城订单发货后自动确认收货天数（超时未点=系统确认，台账留痕）',
        valueJson: { days: 7 },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      {
        version: 1,
        ruleKey: 'care_log_remind_hours',
        label: '照护打卡提醒间隔（小时）：在住寄养单距上次打卡超 N 小时→提醒本店员工打卡',
        valueJson: { hours: 4 },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      {
        version: 1,
        ruleKey: 'incident_escalate_minutes',
        label: '异常通报升级时限（分钟）：通报落行超 N 分钟未处置→升级再通知门店与主人一轮',
        valueJson: { minutes: 15 },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      {
        version: 1,
        ruleKey: 'pet_due_remind_days',
        label: '宠物疫苗/驱虫到期提前提醒天数：到期日前 N 天内→通知主人（当日当项幂等）',
        valueJson: { days: 7 },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
      /* 客户端体验大批片 5（迁移 0044 同口径；重置后补种）：D6 退款率环比突增预警阈值 */
      {
        version: 1,
        ruleKey: 'd6_refund_spike_warn_bp',
        label: 'D6 退款率环比突增预警阈值（万分比）：本月退款金额环比增幅超该值→报表预警行（缺省 3000=30%）',
        valueJson: { bp: 3000 },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
    ]);

    /* ---- 端口批片 B：文案端口 copy_overrides 种子（控制台第七域 domain='copy'） ----
     * 三端 copy 键全表落库（单源=copySeedRows.ts 生成件；0024 迁移同名幂等种子先行入库，
     * 本处为重置后补种）。分块 100 行/次（SQLite 绑定变量上限 999 口径）。
     */
    for (let i = 0; i < COPY_SEED_ROWS.length; i += 100) {
      await tx.insert(schema.copyOverrides).values(
        COPY_SEED_ROWS.slice(i, i + 100).map((r) => ({
          version: 1,
          ruleKey: r.key,
          label: r.domain,
          valueJson: { text: r.text },
          effectiveFrom: RULES_EFFECTIVE_FROM,
          active: true,
          createdBy: owner.id,
        })),
      );
    }
    /* 客户端体验大批片 2：满档推荐留口注记 copy 键（server 侧专用键，生成件未含——
       store.fullAlternatives 的 note 读端口；本处补种保端口宇宙完整，56.1 计数断言同步 +1） */
    await tx.insert(schema.copyOverrides).values([
      {
        version: 1,
        ruleKey: 'booking.fullAlternativesNote',
        label: 'booking',
        valueJson: { text: '当前单店在线，满档推荐待连锁批开通' },
        effectiveFrom: RULES_EFFECTIVE_FROM,
        active: true,
        createdBy: owner.id,
      },
    ]);

    /* ---- 端口批片 C：槽位注册表种子（控制台第八域；SLOT_SEED_ROWS 单源，0025 迁移同口径） ---- */
    await tx.insert(schema.slotContents).values(
      SLOT_SEED_ROWS.map((r) => ({
        slotKey: r.key,
        version: 1,
        contentJson: { url: r.url, alt: r.alt },
        status: 'live' as const,
        createdBy: owner.id,
      })),
    );

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
    /* R12 退款专项新表 */
    ['refund_bills', 'refund_bills'],
    ['refund_bill_items', 'refund_bill_items'],
    ['refund_rules', 'refund_rules'],
    /* C5 客户退款申请新表 */
    ['refund_requests', 'refund_requests'],
    /* R11a 会员前置批新表 */
    ['member_plans', 'member_plans'],
    ['memberships', 'memberships'],
    ['rebate_accounts', 'rebate_accounts'],
    ['rebate_logs', 'rebate_logs'],
    ['rebate_settlements', 'rebate_settlements'],
    /* 补缺大批片 4 新表 */
    ['service_certificates', 'service_certificates'],
    ['service_reports', 'service_reports'],
    /* 端口批片 B：文案端口（控制台第七域） */
    ['copy_overrides', 'copy_overrides'],
    /* 端口批片 C：展示槽位（控制台第八域） */
    ['slot_contents', 'slot_contents'],
    ['support_tickets', 'support_tickets'],
    ['invoice_requests', 'invoice_requests'],
    ['service_rules', 'service_rules'],
    /* 补缺-3 新表 */
    ['membership_events', 'membership_events'],
    /* 批次 6 补缺大批新表（pay_rules 种子随 0017 幂等迁移落全库，created_by='system'，
       本脚本不重复插行——防 0016 式双种子重复 active 行） */
    ['pay_orders', 'pay_orders'],
    ['agreements', 'agreements'],
    ['pay_rules', 'pay_rules'],
    /* 片 3（客户端体验大批 · 迁移 0040）新表 */
    ['member_perk_grants', 'member_perk_grants'],
    ['coupons', 'coupons'],
    ['coupon_grants', 'coupon_grants'],
    ['favorites', 'favorites'],
    ['product_reviews', 'product_reviews'],
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
