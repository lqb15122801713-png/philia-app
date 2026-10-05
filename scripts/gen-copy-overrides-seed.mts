/**
 * 文案端口种子生成器 V2（端口批片 B · CJ-1002-01 → 端口 V2 修正批 · 屏分组）
 *
 * 扫三端 copy 键表（export const *_COPY）→ 键宇宙（键全局唯一硬校验，撞键即报错退出）；
 * V2 追加「键→文件→屏」映射（生成器扫三端调用点自动带出）：
 * - 路由表：解析三端 App.tsx（import + <Route path element>）→ 页面组件→文件；
 * - 屏名字典 SCREEN_DICT：路由→屏中文名，**写死进生成器**（任务书 §三.2；改口径=改本表随批申报）；
 * - 调用点：键字面量 '<key>' 在三端 src 的出现文件（copy 定义目录除外）；
 * - 组件→页：import 闭包（BFS 上溯到页面文件；跨页共用=主屏+「跨屏共用」注记）；
 * - 位置注=调用点文件基名+一句人话模板（端口可人工改=留口件）；
 * - 扫不到=「未归屏」诚实组（screen=NULL，position=未命中注记；未归屏率<10% 军规线）。
 *
 * 产物：
 * 1. server/src/db/copySeedRows.ts —— 种子行（含 screen/position；seed.ts 幂等补种单源）；
 * 2. server/drizzle/0047_copy_port_v2_backfill.sql —— 存量库回填（UPDATE WHERE screen IS NULL 守卫，幂等）。
 *
 * 用法（仓库根）：npx tsx scripts/gen-copy-overrides-seed.mts
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

interface Row { key: string; domain: string; text: string; screen: string | null; position: string }

const ROOT = process.cwd();
const CUSTOMER_COPY = 'apps/customer/src/copy';
const MERCHANT_COPY = 'apps/merchant/src/copy';
const STAFF_COPY = 'apps/staff/src/copy';
const MEMBER_COPY = 'apps/customer/src/components/member/copy.ts';

/* ------------------------------------------------------------------ */
/* 屏名字典（写死；口径=任务书 §三.2 路由级屏，不细到区块）                    */
/* 值=「端·屏名」三端自然分组：客户·/商家·/员工·                                */
/* ------------------------------------------------------------------ */

const SCREEN_DICT: Record<string, string> = {
  /* ---- customer（App.tsx 路由表） ---- */
  'customer:/home': '客户·首页',
  'customer:/mall': '客户·商城',
  'customer:/mall/product/:id': '客户·商品详情',
  'customer:/mall/cart': '客户·购物车',
  'customer:/mall/checkout': '客户·确认订单',
  'customer:/mall/orders': '客户·商品订单',
  'customer:/mall/orders/:id/refund': '客户·申请退款',
  'customer:/appointments/:id/refund': '客户·申请退款',
  'customer:/refunds': '客户·退款/售后',
  'customer:/refunds/:id': '客户·退款详情',
  'customer:/philia': '客户·Philia 爪',
  'customer:/philia/pets': '客户·宠物档案',
  'customer:/philia/pets/:id/health': '客户·健康档案',
  'customer:/philia/moments': '客户·服务相册',
  'customer:/philia/certs': '客户·安心证书',
  'customer:/philia/certs/:appointmentId': '客户·安心证书',
  'customer:/philia/reports/:appointmentId': '客户·美容报告',
  'customer:/support': '客户·小棉花客服',
  'customer:/support/new': '客户·联系小棉花',
  'customer:/support/:id': '客户·工单详情',
  'customer:/invoices': '客户·我的发票',
  'customer:/invoices/:id': '客户·发票详情',
  'customer:/invoice/apply/:kind/:id': '客户·申请发票',
  'customer:/booking': '客户·预约',
  'customer:/booking/grooming': '客户·预约洗护',
  'customer:/booking/grooming/wizard': '客户·预约洗护',
  'customer:/booking/boarding': '客户·预约寄养',
  'customer:/booking/boarding/wizard': '客户·预约寄养',
  'customer:/booking/success': '客户·预约成功',
  'customer:/appointments': '客户·我的预约',
  'customer:/appointments/:id': '客户·预约详情',
  'customer:/appointments/:id/live': '客户·洗护全程',
  'customer:/me': '客户·我的',
  'customer:/me/settings': '客户·设置',
  'customer:/me/settings/deactivate': '客户·注销账号',
  'customer:/me/settings/phone': '客户·换绑手机号',
  'customer:/me/settings/phone/appeal': '客户·换绑申诉',
  'customer:/me/settings/devices': '客户·登录设备',
  'customer:/me/settings/privacy': '客户·权限与隐私',
  'customer:/settings/profile': '客户·编辑资料',
  'customer:/settings/addresses': '客户·收货地址',
  'customer:/settings/about': '客户·关于',
  'customer:/settings/agreements': '客户·协议中心',
  'customer:/settings/invoice-titles': '客户·发票抬头',
  'customer:/records': '客户·消费记录',
  'customer:/me/card': '客户·会员码',
  'customer:/me/coupons': '客户·我的券',
  'customer:/member': '客户·会员中心',
  'customer:/member/open': '客户·开通会员',
  'customer:/member/rebate': '客户·回馈金',
  'customer:/member/upgrade': '客户·升级会员',
  'customer:/member/change': '客户·到期换档',
  'customer:/member/checkout': '客户·会员收银台',
  'customer:/pay/reconcile': '客户·付了没开',
  'customer:/pay/:payNo': '客户·支付状态',
  'customer:/notifications': '客户·消息',
  'customer:/notifications/prefs': '客户·订阅管理',
  'customer:/dev-login': '客户·开发登录',
  /* ---- merchant（App.tsx 路由表） ---- */
  'merchant:/dashboard': '商家·经营总览',
  'merchant:/appointments': '商家·预约',
  'merchant:/appointments/:id': '商家·预约详情',
  'merchant:/monitor': '商家·在店监控',
  'merchant:/monitor/:id': '商家·服务监控',
  'merchant:/appointments/:id/monitor': '商家·服务监控',
  'merchant:/boarding': '商家·寄养',
  'merchant:/cashier': '商家·收银台',
  'merchant:/cashier/records': '商家·收银流水',
  'merchant:/cashier/close': '商家·日结·交接班',
  'merchant:/cashier/refunds': '商家·退款单',
  'merchant:/pass': '商家·会员 · 次卡',
  'merchant:/staff': '商家·员工',
  'merchant:/products': '商家·商品',
  'merchant:/orders': '商家·商城订单',
  'merchant:/finance': '商家·财务',
  'merchant:/finance/report/:key': '商家·经营报表',
  'merchant:/settings': '商家·设置',
  'merchant:/settings/rules': '商家·规则配置管理',
  'merchant:/settings/copy': '商家·文案端口',
  'merchant:/settings/slots': '商家·槽位端口',
  'merchant:/settings/schedules': '商家·排班管理',
  'merchant:/settings/announcements': '商家·公告',
  'merchant:/ops': '商家·运营',
  'merchant:/settings/tasks': '商家·任务模板',
  'merchant:/payroll': '商家·薪资',
  'merchant:/xp-admin': '商家·XP 审核',
  'merchant:/matrix': '商家·权限矩阵',
  'merchant:/console': '商家·开发者管理端',
  'merchant:/dev-login': '商家·开发登录',
  /* ---- staff（App.tsx 路由表） ---- */
  'staff:/today': '员工·工位',
  'staff:/execute/:appointmentId': '员工·服务执行',
  'staff:/schedule': '员工·预约',
  'staff:/me': '员工·我的',
  'staff:/attendance': '员工·打卡',
  'staff:/my-schedule': '员工·我的排班',
  'staff:/notifications': '员工·通知',
  'staff:/notices': '员工·门店公告',
  'staff:/voice': '员工·员工心声',
  'staff:/self-check': '员工·每日自检',
  'staff:/pdca': '员工·问题上报',
  'staff:/boarding/:id/checkin': '员工·寄养打卡',
  'staff:/inventory': '员工·库存',
  'staff:/inventory/:id': '员工·盘点执行',
  'staff:/pay': '员工·我的工资',
  'staff:/xp': '员工·我的 XP',
  'staff:/reviews': '员工·我的评价',
  'staff:/manager': '员工·店长台',
  'staff:/dev-login': '员工·开发登录',
};

/* ------------------------------------------------------------------ */
/* 1. 键宇宙收集（原逻辑不动）                                              */
/* ------------------------------------------------------------------ */

function isCopyTable(v: unknown): v is Record<string, string> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v).every((x) => typeof x === 'string');
}

async function extract(absPath: string, domain: string): Promise<Array<{ key: string; domain: string; text: string }>> {
  const mod = (await import(pathToFileURL(absPath).href)) as Record<string, unknown>;
  const rows: Array<{ key: string; domain: string; text: string }> = [];
  for (const [exportName, value] of Object.entries(mod)) {
    if (!exportName.endsWith('_COPY')) continue;
    if (!isCopyTable(value)) continue;
    for (const [key, text] of Object.entries(value)) rows.push({ key, domain, text });
  }
  if (rows.length === 0) throw new Error(`未取到 copy 表：${absPath}`);
  return rows;
}

const rawRows: Array<{ key: string; domain: string; text: string }> = [];
for (const f of readdirSync(join(ROOT, CUSTOMER_COPY)).filter((x) => x.endsWith('.ts')).sort()) {
  rawRows.push(...(await extract(join(ROOT, CUSTOMER_COPY, f), f.replace(/\.ts$/, ''))));
}
rawRows.push(...(await extract(join(ROOT, MEMBER_COPY), 'member')));
for (const f of readdirSync(join(ROOT, MERCHANT_COPY)).filter((x) => x.endsWith('.ts')).sort()) {
  rawRows.push(...(await extract(join(ROOT, MERCHANT_COPY, f), `merchant:${f.replace(/\.ts$/, '')}`)));
}
for (const f of readdirSync(join(ROOT, STAFF_COPY)).filter((x) => x.endsWith('.ts')).sort()) {
  rawRows.push(...(await extract(join(ROOT, STAFF_COPY, f), `staff:${f.replace(/\.ts$/, '')}`)));
}

const byKey = new Map<string, Array<{ key: string; domain: string; text: string }>>();
for (const r of rawRows) byKey.set(r.key, [...(byKey.get(r.key) ?? []), r]);
const dupSame: string[] = [];
const conflicts: string[] = [];
const keyRows: Array<{ key: string; domain: string; text: string }> = [];
for (const [key, list] of byKey) {
  const texts = new Set(list.map((r) => r.text));
  if (texts.size > 1) {
    conflicts.push(`${key} ← ${list.map((r) => `${r.domain}「${r.text.slice(0, 20)}」`).join(' / ')}`);
    continue;
  }
  if (list.length > 1) dupSame.push(`${key}（${list.map((r) => r.domain).join('/')}）`);
  keyRows.push({ key, domain: list[0]!.domain, text: list[0]!.text });
}
if (conflicts.length > 0) {
  console.error('键冲突（同键异文，须人工裁决）：\n' + conflicts.join('\n'));
  process.exit(1);
}
if (dupSame.length > 0) console.log(`同文去重 ${dupSame.length} 键：${dupSame.slice(0, 8).join('；')}${dupSame.length > 8 ? ' …' : ''}`);
keyRows.sort((a, b) => (a.domain + a.key).localeCompare(b.domain + b.key));

/* ------------------------------------------------------------------ */
/* 2. 路由表解析（App.tsx：import + <Route path element>）                  */
/* ------------------------------------------------------------------ */

interface RouteInfo { app: string; path: string; file: string }

function parseRoutes(app: string, appTsx: string): RouteInfo[] {
  const src = readFileSync(join(ROOT, appTsx), 'utf8');
  const imports = new Map<string, string>();
  for (const m of src.matchAll(/import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g)) {
    if (m[2].startsWith('./pages/')) imports.set(m[1]!, m[2]!);
  }
  const routes: RouteInfo[] = [];
  for (const m of src.matchAll(/<Route\s+path="([^"]+)"[^>]*element=\{<(\w+)/g)) {
    const file = imports.get(m[2]!);
    if (file) routes.push({ app, path: m[1]!, file: `apps/${app}/src/${file.replace(/^\.\//, '')}` });
  }
  return routes;
}

const ROUTES: RouteInfo[] = [
  ...parseRoutes('customer', 'apps/customer/src/App.tsx'),
  ...parseRoutes('merchant', 'apps/merchant/src/App.tsx'),
  ...parseRoutes('staff', 'apps/staff/src/App.tsx'),
];
/** 页面文件（无扩展名）→ 屏名 */
const screenOfPage = new Map<string, string>();
for (const r of ROUTES) {
  const name = SCREEN_DICT[`${r.app}:${r.path}`];
  if (name) screenOfPage.set(r.file, name);
}

/* ------------------------------------------------------------------ */
/* 3. 全 src 扫描：键引用文件 + import 闭包                                  */
/* ------------------------------------------------------------------ */

const SRC_ROOTS = ['apps/customer/src', 'apps/merchant/src', 'apps/staff/src'];
const SKIP_DIRS = new Set(['copy', 'node_modules', '__tests__']);

function walkSrc(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkSrc(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const ALL_FILES = SRC_ROOTS.flatMap((d) => walkSrc(join(ROOT, d)));
/** 去扩展名相对路径（规范化正斜杠） */
const norm = (p: string) => relative(ROOT, p).replaceAll(sep, '/').replace(/\.(ts|tsx)$/, '');
const FILE_SET = new Map(ALL_FILES.map((p) => [norm(p), p]));

/** import 图：file → 它 import 的本仓 src 文件（相对路径无扩展名） */
const importEdges = new Map<string, string[]>();
for (const p of ALL_FILES) {
  const src = readFileSync(p, 'utf8');
  const from = norm(p);
  const targets: string[] = [];
  for (const m of src.matchAll(/import\s+(?:[\w{},*\s]+\s+from\s+)?['"]([^'"]+)['"]/g)) {
    const spec = m[1]!;
    let rel: string | null = null;
    if (spec.startsWith('.')) {
      rel = resolve(join(ROOT, from, '..'), spec).replaceAll(sep, '/');
      rel = relative(ROOT, rel).replaceAll(sep, '/');
    } else if (spec.startsWith('@/')) {
      const appRoot = from.split('/').slice(0, 2).join('/');
      rel = `${appRoot}/src/${spec.slice(2)}`;
    }
    if (rel && FILE_SET.has(rel)) targets.push(rel);
    else if (rel && FILE_SET.has(`${rel}/index`)) targets.push(`${rel}/index`); // 目录导入（../skeleton → ../skeleton/index.tsx）
  }
  importEdges.set(from, targets);
}

/** 反向图：file → 引用它的文件 */
const importedBy = new Map<string, string[]>();
for (const [from, targets] of importEdges) {
  for (const t of targets) importedBy.set(t, [...(importedBy.get(t) ?? []), from]);
}

/** BFS 上溯到页面文件（拿到屏集合） */
function screensOf(file: string): string[] {
  const direct = screenOfPage.get(file);
  if (direct) return [direct];
  const seen = new Set<string>([file]);
  const queue = [file];
  const screens = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    for (const parent of importedBy.get(cur) ?? []) {
      if (seen.has(parent)) continue;
      seen.add(parent);
      const s = screenOfPage.get(parent);
      if (s) screens.add(s);
      else queue.push(parent);
    }
  }
  return [...screens].sort();
}

/** 键 → 引用文件集（字面量命中；含动态前缀命中） */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const keyFileHits = new Map<string, string[]>();
const fileTextCache = new Map<string, string>();
const textOf = (p: string): string => {
  if (!fileTextCache.has(p)) fileTextCache.set(p, readFileSync(p, 'utf8'));
  return fileTextCache.get(p)!;
};
for (const { key } of keyRows) {
  const re = new RegExp(`'${escapeRe(key)}'`);
  const hits: string[] = [];
  for (const p of ALL_FILES) {
    if (re.test(textOf(p))) hits.push(norm(p));
  }
  keyFileHits.set(key, hits);
}
/* 动态前缀特例：`prefix.${` 出现处 → 该前缀全部键挂该文件（如 agreement.${agreementKey}） */
const keyPrefixes = [...new Set(keyRows.map((r) => r.key.split('.')[0]!))];
for (const prefix of keyPrefixes) {
  const dynRe = new RegExp('[`' + "'" + '"' + ']' + escapeRe(prefix) + '[./]?\\$\\{');
  for (const p of ALL_FILES) {
    if (dynRe.test(textOf(p))) {
      const file = norm(p);
      for (const { key } of keyRows) {
        if (key.startsWith(`${prefix}.`)) {
          const hits = keyFileHits.get(key) ?? [];
          if (!hits.includes(file)) keyFileHits.set(key, [...hits, file]);
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 4. 键→屏/位置注                                                         */
/* ------------------------------------------------------------------ */

const rows: Row[] = keyRows.map(({ key, domain, text }) => {
  const hits = keyFileHits.get(key) ?? [];
  const screens = new Set<string>();
  for (const f of hits) for (const s of screensOf(f)) screens.add(s);
  const sorted = [...screens].sort();
  if (sorted.length === 0) {
    return { key, domain, text, screen: null, position: `未在页面调用点命中（${domain} 域键表，端口运营复核挂载屏）` };
  }
  const primaryFile = hits.find((f) => screensOf(f).includes(sorted[0]!)) ?? hits[0]!;
  const isPage = screenOfPage.has(primaryFile);
  /* 组件名=文件基名；目录导入的 index.tsx 取父目录名（skeleton/index.tsx → skeleton） */
  let compName = basename(primaryFile);
  if (compName === 'index') compName = basename(primaryFile.split('/').slice(0, -1).join('/'));
  /* 跨屏共用键=屏名并列（' / ' 连接，字典序稳定）——屏分组时该键在每个屏组下都出现（多归属=诚实口径） */
  return {
    key,
    domain,
    text,
    screen: sorted.join(' / '),
    position: `${compName}${isPage ? ' 页面' : ' 组件'}内文案${sorted.length > 1 ? '（跨屏共用件，各屏组同列）' : ''}`,
  };
});

const mapped = rows.filter((r) => r.screen !== null).length;
const unmapped = rows.length - mapped;
const rate = rows.length > 0 ? ((unmapped / rows.length) * 100).toFixed(1) : '0.0';
console.log(`键总数=${rawRows.length} 去重后=${rows.length} 域数=${new Set(rows.map((r) => r.domain)).size}`);
console.log(`归屏=${mapped} 未归屏=${unmapped}（${rate}%）${Number(rate) < 10 ? '✓ <10% 军规线内' : '✗ 超军规线 10%！'}`);
if (unmapped > 0) {
  console.log('未归屏明细（前 20）：');
  for (const r of rows.filter((x) => x.screen === null).slice(0, 20)) console.log(`  - ${r.key}（${r.domain}）`);
}

/* ------------------------------------------------------------------ */
/* 5. 产物 1：copySeedRows.ts（含 screen/position）                          */
/* ------------------------------------------------------------------ */

const tsOut = `/**
 * 文案端口种子行（端口批片 B → 端口 V2 修正批 · 屏分组）——生成件，勿手改
 * （源=scripts/gen-copy-overrides-seed.mts；copy 键表增删键/屏名字典改口径后须重跑+新迁移落库）。
 * 生成时间口径：${new Date().toISOString()}；键数=${rows.length}；归屏率=${((mapped / rows.length) * 100).toFixed(1)}%（未归屏 ${unmapped}）
 */
export const COPY_SEED_ROWS: Array<{ key: string; domain: string; text: string; screen: string | null; position: string }> = ${JSON.stringify(rows, null, 1)};
`;
writeFileSync(join(ROOT, 'server/src/db/copySeedRows.ts'), tsOut);

/* ------------------------------------------------------------------ */
/* 6. 产物 2：0047 存量回填迁移（UPDATE WHERE screen IS NULL 守卫，幂等）      */
/* ------------------------------------------------------------------ */

const esc = (s: string) => s.replaceAll("'", "''");
const chunks: string[] = [];
for (let i = 0; i < rows.length; i += 300) {
  const slice = rows.slice(i, i + 300);
  const stmts = slice
    .map(
      (r) =>
        `UPDATE \`copy_overrides\` SET \`screen\` = ${r.screen === null ? 'NULL' : `'${esc(r.screen)}'`}, \`position\` = '${esc(r.position)}' WHERE \`rule_key\` = '${esc(r.key)}' AND \`screen\` IS NULL;`,
    )
    .join('\n--> statement-breakpoint\n');
  chunks.push(stmts);
}
const migOut = `-- 端口 V2 修正批：copy_overrides screen/position 存量回填（生成器扫三端调用点产物）
-- 幂等：WHERE screen IS NULL 守卫（重放零副作用；人工端口改过的 position 不被回填覆盖——
-- position 列=留口件，人工值 screen 非空语义下不再回填；screen IS NULL 时 position 一并刷新）。
-- 归屏率=${((mapped / rows.length) * 100).toFixed(1)}%（未归屏 ${unmapped} 键 screen 保持 NULL=「未归屏」诚实组）。
-- 生成件=scripts/gen-copy-overrides-seed.mts 重跑产物（server/src/db/copySeedRows.ts 同帧）。
${chunks.join('\n--> statement-breakpoint\n')}
`;
writeFileSync(join(ROOT, 'server/drizzle/0047_copy_port_v2_backfill.sql'), migOut);
console.log('产物：server/src/db/copySeedRows.ts + server/drizzle/0047_copy_port_v2_backfill.sql');
