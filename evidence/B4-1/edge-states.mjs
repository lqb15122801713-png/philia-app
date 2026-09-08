/**
 * B4-1 边缘态证据：
 *  A. 新客空宠物「先建档」岔路卡（临时 seed_ 无宠物客户，脚本结束后由外层清理）
 *  B. 满槽时段灰显（先经 appointment.create 把明日 09:00 两格容量打满 → 栅格灰显，截后取消还原）
 *  C. 换店底部半屏 / 服务 chips 展开 + 折叠区展开 / 整月日历二级 / 提交中态
 * 每屏截图配 DOM 断言 txt。
 */
import { launchEdge, connect, loginAsSeedCustomer, waitFor, sleep, APP, API } from '../cdp-lib.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)));
const lines = [];
const assert = (name, ok, detail = '') => {
  lines.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const cleanup = await launchEdge();
const createdAppts = [];
try {
  const cdp = await connect();
  await cdp.nav(`${APP}/dev-login`);

  /* ============ A. 新客空宠物「先建档」卡 ============ */
  const seeds = await fetch(`${API}/api/auth/dev-seed-users`).then((r) => r.json());
  const nopet = seeds.users.find((u) => u.nickname === 'B4空宠物客户');
  if (!nopet) throw new Error('未找到 B4空宠物客户（先跑 tmp-b4-nopet.mts）');
  const st = await cdp.evalJs(`fetch('${API}/api/auth/dev-login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({userId:'${nopet.id}'}), credentials:'include' }).then(r=>r.status)`);
  assert('A. 空宠物客户 dev-login', st === 200, `HTTP ${st}`);
  await cdp.evalJs(`localStorage.removeItem('philia:lastBooking'); 'ok'`);
  await cdp.nav(`${APP}/booking/grooming`);
  await waitFor(cdp, `!!document.querySelector('[data-testid="gs-no-pet-fork"]')`);
  const forkText = await cdp.evalJs(`document.querySelector('[data-testid="gs-no-pet-fork"]')?.textContent ?? ''`);
  assert('A. 「先建档」岔路卡渲染（还没有宠物档案/先建立宠物档案）',
    forkText.includes('还没有宠物档案') && forkText.includes('先建立宠物档案'), forkText.slice(0, 40));
  const btnA = await cdp.evalJs(`document.querySelector('[data-testid="gs-confirm"]')?.textContent ?? ''`);
  assert('A. 空宠物确认按钮置灰点名「请先建立宠物档案」', btnA.includes('请先建立宠物档案'), btnA);
  await sleep(600);
  await cdp.shot(resolve(OUT, 'edge-A-新客空宠物先建档卡.png'));
  writeFileSync(resolve(OUT, 'edge-A-新客空宠物先建档卡.txt'),
    `gs-no-pet-fork 文本: ${forkText}\ngs-confirm 文本: ${btnA}\n`);

  /* ============ 切回种子客户 ============ */
  await loginAsSeedCustomer(cdp);

  /* ============ B. 满槽时段灰显 ============ */
  // 取门店/服务/宠物（页面上下文内走 tRPC HTTP，复用登录 cookie）
  const ctx = await cdp.evalJs(`(async () => {
    const q = (p, input) => fetch('${API}/trpc/' + p + '?batch=1&input=' + encodeURIComponent(JSON.stringify({0:{json:input}})), {credentials:'include'}).then(r=>r.json()).then(d=>d[0].result.data.json);
    const nearby = await q('store.listNearby', {});
    const storeId = nearby.stores[0].id;
    const sws = await q('store.getWithServices', { storeId });
    const svc = sws.services.find(s => s.type === 'grooming');
    const pets = await q('pet.list', null);
    return { storeId, serviceId: svc.id, petId: pets[0].id };
  })()`);
  // 明日 09:00（本地）打满 capacity=2
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const iso = tomorrow.toISOString();
  for (let i = 0; i < 2; i++) {
    const r = await cdp.evalJs(`fetch('${API}/trpc/appointment.create?batch=1', {
      method: 'POST', headers: {'content-type': 'application/json'}, credentials: 'include',
      body: JSON.stringify({0:{json:{storeId:'${ctx.storeId}',petId:'${ctx.petId}',serviceId:'${ctx.serviceId}',type:'grooming',scheduledStart:'${iso}',paymentMode:'pay_at_store'},meta:{values:{scheduledStart:['Date']}}}})
    }).then(r=>r.json()).then(d=>d[0].result?.data?.json?.id ?? ('ERR:' + JSON.stringify(d[0].error ?? d)))`);
    if (String(r).startsWith('ERR:')) throw new Error('造满槽预约失败: ' + r);
    createdAppts.push(r);
  }
  assert('B. 已建 2 单把明日 09:00 打满（capacity=2）', createdAppts.length === 2, createdAppts.join(','));

  await cdp.nav(`${APP}/booking/grooming`);
  await waitFor(cdp, `!!document.querySelector('[data-testid="gs-time-grid"]')`);
  await sleep(1200);
  // 默认选中日=明天（今天已约满/过点），09:00 应灰显
  const slot900 = await cdp.evalJs(`(() => {
    const b = document.querySelector('[data-testid="gs-slot-09:00"]');
    return b ? { avail: b.getAttribute('data-available'), disabled: b.disabled, cls: b.className } : null;
  })()`);
  assert('B. 满槽 09:00 灰显禁用（data-available=false）', slot900 !== null && slot900.avail === 'false' && slot900.disabled, JSON.stringify(slot900));
  const greyCount = await cdp.evalJs(`document.querySelectorAll('[data-testid^="gs-slot-"][data-available="false"]').length`);
  assert('B. 灰显槽存在（含满槽）', greyCount >= 1, `grey=${greyCount}`);
  await cdp.evalJs(`document.querySelector('[data-testid="gs-time-grid"]').scrollIntoView({ block: 'center' }); 'ok'`);
  await sleep(400);
  await cdp.shot(resolve(OUT, 'edge-B-满槽时段灰显.png'));
  writeFileSync(resolve(OUT, 'edge-B-满槽时段灰显.txt'),
    `明日 09:00 已被 2 单（capacity=2）打满: ${createdAppts.join(', ')}\ngs-slot-09:00: ${JSON.stringify(slot900)}\n灰显槽数量: ${greyCount}\n`);

  /* ============ C1. 换店底部半屏 ============ */
  await cdp.evalJs(`document.querySelector('[data-testid="gs-store-line"]').click()`);
  await sleep(700);
  const storeSheet = await cdp.evalJs(`(() => {
    const s = document.querySelector('[data-testid="gs-store-sheet"]');
    return s ? { shown: true, options: s.querySelectorAll('[data-testid^="gs-store-option-"]').length, text: s.textContent.slice(0, 30) } : { shown: false };
  })()`);
  assert('C1. 换店弹底部半屏（不跳页）', storeSheet.shown === true, JSON.stringify(storeSheet));
  const pathBefore = await cdp.evalJs(`location.pathname`);
  await cdp.shot(resolve(OUT, 'edge-C1-换店底部半屏.png'));
  writeFileSync(resolve(OUT, 'edge-C1-换店底部半屏.txt'),
    `gs-store-sheet: ${JSON.stringify(storeSheet)}\n路径未变（不跳页）: ${pathBefore}\n`);
  await cdp.evalJs(`document.querySelector('[data-testid="gs-store-sheet"] [aria-label="关闭"]').click()`);
  await sleep(400);

  /* ============ C2. 服务 chips 展开 + 折叠区展开 ============ */
  await cdp.evalJs(`document.querySelector('[data-testid="gs-service-more"]').click()`);
  await sleep(400);
  const chipsAll = await cdp.evalJs(`document.querySelectorAll('[data-testid^="gs-service-chip-"]').length`);
  assert('C2. 「更多服务 ▸」展开全部 6 项', chipsAll === 6, `chips=${chipsAll}`);
  for (const t of ['gs-payment-toggle', 'gs-note-toggle', 'gs-staff-toggle']) {
    await cdp.evalJs(`document.querySelector('[data-testid="${t}"]').click()`);
    await sleep(300);
  }
  const extras = await cdp.evalJs(`(() => ({
    payOptions: document.querySelectorAll('[data-testid^="gs-payment-"][data-testid$="pay_at_store"], [data-testid="gs-payment-pass_deduct"]').length,
    passDisabled: document.querySelector('[data-testid="gs-payment-pass_deduct"]')?.getAttribute('data-disabled'),
    passText: document.querySelector('[data-testid="gs-payment-pass_deduct"]')?.textContent ?? '',
    paySummary: document.querySelector('[data-testid="gs-payment-toggle"]')?.textContent ?? '',
    noteShown: !!document.querySelector('[data-testid="gs-note-input"]'),
    staffShown: !!document.querySelector('[data-testid="gs-staff-picker"]'),
    staffFirst: document.querySelector('[data-testid="gs-staff-picker"]')?.textContent?.includes('随缘') ?? false,
  }))()`);
  // 本人次卡实况（断言按数据驱动：有卡→默认次卡+余量；无卡→置灰「暂无可用次卡」）
  const passInfo = await cdp.evalJs(`(async () => {
    const d = await fetch('${API}/trpc/pass.mine?batch=1&input=' + encodeURIComponent(JSON.stringify({0:{json:{}}})), {credentials:'include'}).then(r=>r.json());
    const rows = d[0].result.data.json;
    const u = rows.find(p => p.usable) ?? null;
    return { total: rows.length, usable: u ? u.remainTimes : null };
  })()`);
  if (passInfo.usable !== null) {
    assert('C2. 收款方式展开：两行单选', extras.payOptions === 2, JSON.stringify({ payOptions: extras.payOptions }));
    assert(`C2. 有可用次卡（余 ${passInfo.usable} 次）→ 次卡扣次可选且显示余量`,
      extras.passDisabled === 'false' && extras.passText.includes(`剩余 ${passInfo.usable} 次`), extras.passText);
    assert('C2. 有可用次卡 → 单行选择器默认次卡并显示余量（设计方案）',
      extras.paySummary.includes('次卡扣次') && extras.paySummary.includes(`余 ${passInfo.usable} 次`), extras.paySummary);
  } else {
    assert('C2. 无可用次卡 → 次卡扣次置灰提示「暂无可用次卡」（B2-7 沿用）',
      extras.passDisabled === 'true' && extras.passText.includes('暂无可用次卡'), extras.passText);
  }
  assert('C2. 添加备注展开 textarea', extras.noteShown);
  assert('C2. 指定洗护师展开横滑卡（默认随缘）', extras.staffShown && extras.staffFirst);
  await sleep(300);
  await cdp.evalJs(`document.querySelector('[data-testid="gs-extras"]').scrollIntoView({ block: 'start' }); 'ok'`);
  await sleep(400);
  await cdp.shot(resolve(OUT, 'edge-C2-服务chips与折叠区展开.png'));
  writeFileSync(resolve(OUT, 'edge-C2-服务chips与折叠区展开.txt'),
    `chips 展开后数量: ${chipsAll}\n折叠区: ${JSON.stringify(extras)}\n次卡实况: ${JSON.stringify(passInfo)}\n`);

  /* ============ C3. 整月日历二级 ============ */
  await cdp.evalJs(`document.querySelector('[data-testid="gs-calendar-toggle"]').click()`);
  await sleep(500);
  const cal = await cdp.evalJs(`(() => ({
    shown: !!document.querySelector('[data-testid="gs-month-calendar"]'),
    months: document.querySelectorAll('[data-testid="gs-month-calendar"] > div').length,
    inWindow: document.querySelectorAll('[data-testid^="gs-cal-"][data-in-window="true"]').length,
  }))()`);
  assert('C3. 整月日历展开（7 天窗口内可点）', cal.shown && cal.inWindow === 7, JSON.stringify(cal));
  await cdp.evalJs(`document.querySelector('[data-testid="gs-month-calendar"]').scrollIntoView({ block: 'center' }); 'ok'`);
  await sleep(400);
  await cdp.shot(resolve(OUT, 'edge-C3-整月日历展开.png'));
  writeFileSync(resolve(OUT, 'edge-C3-整月日历展开.txt'), `日历: ${JSON.stringify(cal)}\n`);

  /* ============ C4. 提交中态（网络节流 2.5s 截提交中按钮） ============ */
  await cdp.evalJs(`document.querySelector('[data-testid="gs-calendar-toggle"]').click()`); // 收起日历
  // 选宠物 + 选第一个可约槽
  await cdp.evalJs(`document.querySelector('[data-testid="gs-pet-card"]').click()`);
  await sleep(500);
  await cdp.evalJs(`(() => {
    const sheet = document.querySelector('[data-testid="gs-pet-sheet"]');
    Array.from(sheet.querySelectorAll('button')).find(b => b.textContent.includes('旺财'))?.click();
  })()`);
  await sleep(500);
  await cdp.evalJs(`Array.from(document.querySelectorAll('[data-testid^="gs-slot-"]')).find(b => b.getAttribute('data-available') === 'true')?.click()`);
  await sleep(400);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 2500, downloadThroughput: 5e6, uploadThroughput: 5e6 });
  const ready = await cdp.evalJs(`document.querySelector('[data-testid="gs-confirm"]')?.getAttribute('data-state')`);
  assert('C4. 提交前为可点态', ready === 'ready', String(ready));
  await cdp.evalJs(`document.querySelector('[data-testid="gs-confirm"]').click()`);
  await sleep(600); // 节流 2.5s，600ms 时必在提交中
  const submitting = await cdp.evalJs(`(() => {
    const b = document.querySelector('[data-testid="gs-confirm"]');
    return { state: b?.getAttribute('data-state'), text: b?.textContent, disabled: b?.disabled };
  })()`);
  assert('C4. 提交中态「提交中…」禁用', submitting.state === 'submitting' && submitting.text.includes('提交中') && submitting.disabled === true, JSON.stringify(submitting));
  await cdp.shot(resolve(OUT, 'edge-C4-提交中态.png'));
  writeFileSync(resolve(OUT, 'edge-C4-提交中态.txt'), `提交中按钮: ${JSON.stringify(submitting)}\n（Network 节流 2500ms 截取）\n`);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  // 等成功页（本次提交真实建单，作为全链路佐证之一）
  let landed = '';
  for (let i = 0; i < 20; i++) {
    landed = await cdp.evalJs(`location.pathname + location.search`);
    if (landed.startsWith('/booking/success')) break;
    await sleep(600);
  }
  assert('C4. 提交成功进现有成功页 /booking/success?aid=', landed.startsWith('/booking/success?aid='), landed);
  await sleep(1200);
  await cdp.shot(resolve(OUT, 'edge-C4-成功页.png'));
  const successAid = new URLSearchParams(landed.split('?')[1] ?? '').get('aid');
  if (successAid) createdAppts.push(successAid);

  writeFileSync(resolve(OUT, 'edge-asserts.txt'), lines.join('\n') + '\n');

  /* 还原：取消满槽造数预约（>4h 直消释放槽位；成功页那单保留作真实链路数据） */
  for (const id of createdAppts.slice(0, 2)) {
    const cr = await cdp.evalJs(`fetch('${API}/trpc/appointment.cancel?batch=1', {
      method: 'POST', headers: {'content-type': 'application/json'}, credentials: 'include',
      body: JSON.stringify({0:{json:{appointmentId:'${id}',reason:'B4 证据造数还原'}}})
    }).then(r=>r.status)`);
    console.log(`还原取消 ${id}: HTTP ${cr}`);
  }

  const failed = lines.filter((l) => l.startsWith('FAIL'));
  console.log(`\n===== 边缘态汇总：${lines.length - failed.length}/${lines.length} 通过 =====`);
  cdp.close();
  process.exitCode = failed.length ? 1 : 0;
} finally {
  cleanup();
}
