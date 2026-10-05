/**
 * T1.5 冒烟脚本（tsx 直跑）：npx tsx src/storage/__tests__/smoke.ts
 *
 * 验证项（对应任务书）：
 *  1. jimp 现造 3000×2000 图 → processAndStoreImage → 原图最长边 ≤2000、缩略图最长边 400、
 *     文件真实落盘、返回签名 URL
 *  2. 篡改 sig / relPath（..%2F 穿越）→ 403；过期 exp → 410
 *  3. 正确签名 → 200 且字节数与文件一致
 *  4. 上传 >10MB / text/plain → 拒绝；未登录 → 401
 *  5. cleanup：25h 前无引用文件被回收；有引用（step_photos 记录）的保留
 *
 * DB 隔离：PHILIA_DB_URL 指向内存库（:memory:，动态 import 前先设环境变量），
 * 跑真实 drizzle 迁移后插入引用行；存储侧用独立 scope 目录，结束后全部清理。
 */

import { rmSync } from 'node:fs';
import { readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { Jimp } from 'jimp';

/* ---- 在 import 任何依赖 db 的模块之前设定库位置：内存库，零临时文件（Windows 文件占用 EPERM 规避） ---- */
process.env.PHILIA_DB_URL = ':memory:';

import { imagesRoute } from '../../routes/images';
import { uploadRoute } from '../../routes/upload';
import {
  processAndStoreImage,
  UPLOADS_ROOT,
  type UploadedImage,
} from '../images';
import {
  computeImageSignature,
  isSafeImageRelPath,
  signImagePath,
  verifyImageSignature,
} from '../sign';

/* ---------------- 微型断言框架 ---------------- */
let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✘ ${label}`);
  }
}

/** 造一张带噪纹理的测试图（直接写 bitmap.data，6M 像素级循环也足够快），返回 jpeg buffer */
async function makeTestImage(width: number, height: number): Promise<Buffer> {
  const img = new Jimp({ width, height, color: 0xffffffff });
  const data = img.bitmap.data;
  for (let i = 0; i < data.length; i += 4) {
    const p = i / 4;
    data[i] = (p % 251) & 0xff;
    data[i + 1] = ((p / width) | 0) & 0xff;
    data[i + 2] = ((p * 7) % 199) & 0xff;
    data[i + 3] = 0xff;
  }
  return img.getBuffer('image/jpeg', { quality: 90 });
}

function parseSignedUrl(url: string): { relPath: string; sig: string; exp: number } {
  const u = new URL(url, 'http://smoke.local');
  return {
    relPath: decodeURIComponent(u.pathname.slice('/api/img/'.length)),
    sig: u.searchParams.get('sig') ?? '',
    exp: Number(u.searchParams.get('exp')),
  };
}

/* ---------------- 装配测试 App（注入 sessionUser） ---------------- */
type Env = { Variables: { sessionUser?: { id: string; roles?: string[] } | null } };
const app = new Hono<Env>();
app.use('*', async (c, next) => {
  c.set('sessionUser', { id: 'smoke-user-1', roles: ['staff'] });
  await next();
});
app.route('/', uploadRoute);
app.route('/', imagesRoute);

const anonApp = new Hono<Env>(); // 不注入 sessionUser
anonApp.route('/', uploadRoute);

const SCOPE = `smoke-test/${process.pid}`; // uploads/ 下的隔离目录

/** 临时库 client（finally 里先 close 再删库文件，规避 Windows 文件占用 EPERM） */
let dbClient: (typeof import('../../db'))['client'] | null = null;

try {
  /* ================= 1) processAndStoreImage 管线 ================= */
  console.log('\n[1] processAndStoreImage：3000×2000 测试图');
  const bigBuf = await makeTestImage(3000, 2000);
  const relDir = `appointment/smoke-aid/precheck`;
  const stored: UploadedImage = await processAndStoreImage(bigBuf, relDir);

  const urlParsed = parseSignedUrl(stored.url);
  const thumbParsed = parseSignedUrl(stored.thumbUrl);
  assert(
    /^appointment\/smoke-aid\/precheck\/[0-9a-f-]{36}\.jpg$/.test(urlParsed.relPath),
    `原图 relPath 形态正确（${urlParsed.relPath}）`,
  );
  assert(/_thumb\.jpg$/.test(thumbParsed.relPath), `缩略图 relPath 带 _thumb 后缀`);
  assert(/^[0-9a-f]{64}$/.test(urlParsed.sig) && urlParsed.exp > Date.now() / 1000, '返回的是签名 URL');

  const origAbs = join(UPLOADS_ROOT, urlParsed.relPath);
  const thumbAbs = join(UPLOADS_ROOT, thumbParsed.relPath);
  assert((await stat(origAbs)).isFile() && (await stat(thumbAbs)).isFile(), '原图与缩略图真实落盘');

  const origImg = await Jimp.read(origAbs);
  const thumbImg = await Jimp.read(thumbAbs);
  assert(
    Math.max(origImg.width, origImg.height) <= 2000,
    `原图最长边 ≤2000（实际 ${origImg.width}×${origImg.height}）`,
  );
  assert(
    Math.max(thumbImg.width, thumbImg.height) === 400,
    `缩略图最长边 =400（实际 ${thumbImg.width}×${thumbImg.height}）`,
  );
  assert(
    verifyImageSignature(urlParsed.relPath, urlParsed.sig, urlParsed.exp),
    'verifyImageSignature 对返回 URL 验签通过',
  );

  /* ================= 2) 篡改 / 穿越 / 过期 ================= */
  console.log('\n[2] 验签失败场景');
  const tamperedSig = await app.request(
    `http://t${stored.url.replace(urlParsed.sig, '0'.repeat(64))}`,
  );
  assert(tamperedSig.status === 403, `篡改 sig → 403（实际 ${tamperedSig.status}）`);

  const traversal = await app.request(
    `http://t/api/img/..%2F..%2Fpackage.json?sig=${'0'.repeat(64)}&exp=${Math.floor(Date.now() / 1000) + 3600}`,
  );
  assert(traversal.status === 403, `..%2F 路径穿越 → 403（实际 ${traversal.status}）`);
  assert(!isSafeImageRelPath('../../package.json'), 'isSafeImageRelPath 拒绝 .. 路径');

  const relPathTampered = await app.request(
    `http://t/api/img/${urlParsed.relPath.replace('.jpg', '_thumb.jpg')}?sig=${urlParsed.sig}&exp=${urlParsed.exp}`,
  );
  assert(relPathTampered.status === 403, `篡改 relPath（签名不随之变化）→ 403（实际 ${relPathTampered.status}）`);

  const expiredUrl = signImagePath(urlParsed.relPath, -100);
  const expired = await app.request(`http://t${expiredUrl}`);
  assert(expired.status === 410, `过期 exp → 410（实际 ${expired.status}）`);

  /* ================= 3) 正确签名 → 200 且字节一致 ================= */
  console.log('\n[3] 正确签名访问');
  const ok = await app.request(`http://t${stored.url}`);
  assert(ok.status === 200, `正确签名 → 200（实际 ${ok.status}）`);
  assert(ok.headers.get('content-type') === 'image/jpeg', 'Content-Type 为 image/jpeg');
  const bodyBytes = Buffer.from(await ok.arrayBuffer());
  const diskBytes = await readFile(origAbs);
  assert(bodyBytes.length === diskBytes.length, `返回字节数与文件一致（${bodyBytes.length}）`);

  /* ================= 4) 上传端点校验 ================= */
  console.log('\n[4] POST /api/upload 校验');
  // 4a. 正常上传
  const okForm = new FormData();
  okForm.append('relDir', `${SCOPE}/via-route`);
  okForm.append('file', new File([await makeTestImage(800, 600)], 'a.jpg', { type: 'image/jpeg' }));
  const upOk = await app.request('http://t/api/upload', { method: 'POST', body: okForm });
  const upOkJson = (await upOk.json()) as Record<string, unknown>;
  assert(
    upOk.status === 200 && typeof upOkJson.url === 'string' && typeof upOkJson.thumbUrl === 'string',
    `正常上传 → 200 + {url, thumbUrl}（实际 ${upOk.status}）`,
  );

  // 4b. >10MB 拒绝
  const bigFile = Buffer.alloc(11 * 1024 * 1024, 0x61);
  bigFile[0] = 0xff; bigFile[1] = 0xd8; bigFile[2] = 0xff; // 伪装 jpeg 头，确认是大小校验拦截
  const bigForm = new FormData();
  bigForm.append('relDir', `${SCOPE}/via-route`);
  bigForm.append('file', new File([bigFile], 'big.jpg', { type: 'image/jpeg' }));
  const upBig = await app.request('http://t/api/upload', { method: 'POST', body: bigForm });
  assert(upBig.status === 400, `>10MB → 400（实际 ${upBig.status}）`);

  // 4c. text/plain 拒绝
  const txtForm = new FormData();
  txtForm.append('relDir', `${SCOPE}/via-route`);
  txtForm.append('file', new File([Buffer.from('just some text')], 'a.txt', { type: 'text/plain' }));
  const upTxt = await app.request('http://t/api/upload', { method: 'POST', body: txtForm });
  assert(upTxt.status === 400, `text/plain → 400（实际 ${upTxt.status}）`);

  // 4d. 路径穿越 relDir 拒绝
  const evilForm = new FormData();
  evilForm.append('relDir', 'appointment/../../escape');
  evilForm.append('file', new File([await makeTestImage(100, 100)], 'a.jpg', { type: 'image/jpeg' }));
  const upEvil = await app.request('http://t/api/upload', { method: 'POST', body: evilForm });
  assert(upEvil.status === 400, `relDir 含 .. → 400（实际 ${upEvil.status}）`);

  // 4e. 未登录拒绝
  const anonForm = new FormData();
  anonForm.append('relDir', `${SCOPE}/via-route`);
  anonForm.append('file', new File([await makeTestImage(100, 100)], 'a.jpg', { type: 'image/jpeg' }));
  const upAnon = await anonApp.request('http://t/api/upload', { method: 'POST', body: anonForm });
  assert(upAnon.status === 401, `未登录 → 401（实际 ${upAnon.status}）`);

  /* ================= 5) cleanup 孤儿回收 ================= */
  console.log('\n[5] cleanupOrphanImages 孤儿回收');
  // 5.1 临时库跑真实迁移（动态 import 保证 PHILIA_DB_URL 先生效）
  const dbModule = await import('../../db');
  dbClient = dbModule.client;
  const { db, schema } = dbModule;
  const { migrate } = await import('drizzle-orm/libsql/migrator');
  const migrationsFolder = fileURLToPath(new URL('../../../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });
  await dbClient.execute('PRAGMA foreign_keys = OFF');

  // 5.2 造两个 25h 前的文件：孤儿 + 有引用
  const cleanupScope = `${SCOPE}/cleanup`;
  const orphanRel = `${cleanupScope}/orphan.jpg`;
  const keptRel = `${cleanupScope}/kept.jpg`;
  const jpegBytes = await makeTestImage(60, 40);
  const { mkdirSync } = await import('node:fs');
  mkdirSync(join(UPLOADS_ROOT, cleanupScope), { recursive: true });
  await writeFile(join(UPLOADS_ROOT, orphanRel), jpegBytes);
  await writeFile(join(UPLOADS_ROOT, keptRel), jpegBytes);
  const old = new Date(Date.now() - 25 * 3600 * 1000);
  await utimes(join(UPLOADS_ROOT, orphanRel), old, old);
  await utimes(join(UPLOADS_ROOT, keptRel), old, old);

  // 5.3 kept.jpg 在 step_photos 表有引用（存的是带签名 URL，cleanup 只比对路径部分）
  await db.insert(schema.stepPhotos).values({
    stepId: 'smoke-step-1',
    url: signImagePath(keptRel),
    thumbUrl: signImagePath(keptRel.replace('.jpg', '_thumb.jpg')),
  });

  // 5.4 执行回收（限定 scope，不影响 uploads/ 下其他文件）
  const { cleanupOrphanImages } = await import('../cleanup');
  const result = await cleanupOrphanImages({ scopePrefix: cleanupScope });
  assert(result.deleted.includes(orphanRel), `孤儿文件被回收（deleted=${JSON.stringify(result.deleted)}）`);
  assert(result.keptReferenced.includes(keptRel), `有引用文件被保留（kept=${JSON.stringify(result.keptReferenced)}）`);
  assert(
    (await stat(join(UPLOADS_ROOT, orphanRel)).catch(() => null)) === null,
    '孤儿文件已从磁盘删除',
  );
  assert(
    (await stat(join(UPLOADS_ROOT, keptRel)).catch(() => null))?.isFile() === true,
    '有引用文件仍在磁盘上',
  );
  // 5.5 dry-run 不删除
  const dry = await cleanupOrphanImages({ scopePrefix: cleanupScope, dryRun: true });
  assert(dry.deleted.length === 0 && dry.keptReferenced.includes(keptRel), '二次扫描只剩有引用文件（dry-run 正常）');

  // 5.6 computeImageSignature 确定性（同输入同输出）
  assert(
    computeImageSignature('a/b.jpg', 123) === computeImageSignature('a/b.jpg', 123) &&
      computeImageSignature('a/b.jpg', 123) !== computeImageSignature('a/b.jpg', 124),
    'computeImageSignature 确定性且随 exp 变化',
  );
} finally {
  /* ---------------- 清理现场（库为内存库，无需删文件；仅清理 uploads/ 下的测试目录） ---------------- */
  try {
    dbClient?.close();
  } catch {
    /* 忽略关闭异常 */
  }
  rmSync(join(UPLOADS_ROOT, 'appointment', 'smoke-aid'), { recursive: true, force: true });
  rmSync(join(UPLOADS_ROOT, SCOPE), { recursive: true, force: true });
}

console.log(`\n========================================`);
console.log(`冒烟结果：${passed} 通过，${failed} 失败`);
if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log('全部通过 ✅');
}
