/**
 * 任务 C 验收①：时长引擎规则表断言（≥6 组品种/毛长组合 + 回退路径）。
 * 纯函数级断言（resolveServiceDuration，不依赖数据库/服务进程）。
 *
 * 规则表（占位，待老板供给 —— 见 server/src/config/durationEngine.ts 头注）：
 *   基础时长  犬·洗澡60 / 犬·美容90 / 猫·洗澡90 / 猫·美容120
 *   体型系数  小1.0 / 中1.5 / 大2.0（犬 <10/10–25/>25 kg；猫 <5/5–10/>10 kg）
 *   毛长系数  短1.0 / 长1.25（品种关键词推长毛，未命中短毛）
 *   槽位粒度  30min 向上取整
 */
import {
  resolveServiceDuration,
  type PetDurationProfile,
  type ServiceDurationInput,
} from '../../../philia-app/server/src/config/durationEngine';

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}`, extra === undefined ? '' : JSON.stringify(extra));
  }
}

const dog = (breed: string, weightKg: number): PetDurationProfile => ({ species: 'dog', breed, weightKg });
const cat = (breed: string, weightKg: number): PetDurationProfile => ({ species: 'cat', breed, weightKg });
const bathSvc: ServiceDurationInput = { type: 'grooming', name: '基础洗护', durationMin: 60 };
const groomSvc: ServiceDurationInput = { type: 'grooming', name: '造型美容修剪', durationMin: 120 };
const boardingSvc: ServiceDurationInput = { type: 'boarding', name: '标准间寄养（犬）', durationMin: null };

/* ---- 犬 · 洗澡（base 60） ---- */
{
  const r = resolveServiceDuration(bathSvc, dog('柯基', 8)); // 小型短毛犬
  console.log('[犬·洗澡] 小型短毛（柯基 8kg）:', JSON.stringify(r));
  check('1. 小型短毛犬洗澡 = 60×1.0×1.0 = 60min / 2 槽', r.source === 'engine' && r.rawMin === 60 && r.durationMin === 60 && r.slotsNeeded === 2, r);
}
{
  const r = resolveServiceDuration(bathSvc, dog('柴犬', 12)); // 中型短毛犬
  console.log('[犬·洗澡] 中型短毛（柴犬 12kg）:', JSON.stringify(r));
  check('2. 中型短毛犬洗澡 = 60×1.5×1.0 = 90min / 3 槽', r.source === 'engine' && r.rawMin === 90 && r.durationMin === 90 && r.slotsNeeded === 3, r);
}
{
  const r = resolveServiceDuration(bathSvc, dog('金毛寻回犬', 28.5)); // 大型长毛犬（种子·旺财）
  console.log('[犬·洗澡] 大型长毛（金毛 28.5kg）:', JSON.stringify(r));
  check('3. 大型长毛犬洗澡 = 60×2.0×1.25 = 150min / 5 槽', r.source === 'engine' && r.rawMin === 150 && r.durationMin === 150 && r.slotsNeeded === 5, r);
}

/* ---- 犬 · 美容（base 90） ---- */
{
  const r = resolveServiceDuration(groomSvc, dog('泰迪', 6)); // 小型长毛犬（泰迪在长毛词表）
  console.log('[犬·美容] 小型长毛（泰迪 6kg）:', JSON.stringify(r));
  check('4. 小型长毛犬美容 = 90×1.0×1.25 = 112.5 → 取整 120min / 4 槽', r.source === 'engine' && r.rawMin === 112.5 && r.durationMin === 120 && r.slotsNeeded === 4, r);
}
{
  const r = resolveServiceDuration(groomSvc, dog('边境牧羊犬', 20)); // 中型长毛犬
  console.log('[犬·美容] 中型长毛（边牧 20kg）:', JSON.stringify(r));
  check('5. 中型长毛犬美容 = 90×1.5×1.25 = 168.75 → 取整 180min / 6 槽', r.source === 'engine' && r.rawMin === 168.75 && r.durationMin === 180 && r.slotsNeeded === 6, r);
}
{
  const r = resolveServiceDuration(groomSvc, dog('阿拉斯加', 35)); // 大型长毛犬 ★验收锚点
  console.log('[犬·美容] 大型长毛（阿拉斯加 35kg）:', JSON.stringify(r));
  check('6. ★边界：大型长毛犬美容 = 90×2.0×1.25 = 225min → 向上取整 240min / 8 个 30min 槽位块',
    r.source === 'engine' && r.rawMin === 225 && r.durationMin === 240 && r.slotsNeeded === 8, r);
}

/* ---- 猫 · 洗澡/美容（base 90/120） ---- */
{
  const r = resolveServiceDuration(bathSvc, cat('英国短毛猫', 4.2)); // 小型短毛猫（种子·咪咪）
  console.log('[猫·洗澡] 小型短毛（英短 4.2kg）:', JSON.stringify(r));
  check('7. 小型短毛猫洗澡 = 90×1.0×1.0 = 90min / 3 槽', r.source === 'engine' && r.rawMin === 90 && r.durationMin === 90 && r.slotsNeeded === 3, r);
}
{
  const r = resolveServiceDuration(groomSvc, cat('布偶猫', 6)); // 中型长毛猫
  console.log('[猫·美容] 中型长毛（布偶 6kg）:', JSON.stringify(r));
  check('8. 中型长毛猫美容 = 120×1.5×1.25 = 225 → 取整 240min / 8 槽', r.source === 'engine' && r.rawMin === 225 && r.durationMin === 240 && r.slotsNeeded === 8, r);
}
{
  const r = resolveServiceDuration(groomSvc, cat('缅因猫', 11)); // 大型长毛猫
  console.log('[猫·美容] 大型长毛（缅因 11kg）:', JSON.stringify(r));
  check('9. 大型长毛猫美容 = 120×2.0×1.25 = 300min / 10 槽', r.source === 'engine' && r.rawMin === 300 && r.durationMin === 300 && r.slotsNeeded === 10, r);
}

/* ---- 回退路径（source='default'，回退服务默认 durationMin，不阻断下单） ---- */
{
  const r = resolveServiceDuration(bathSvc, { species: 'dog', breed: null, weightKg: 8 });
  console.log('[回退] 缺品种:', JSON.stringify(r));
  check('10. 缺品种 → 回退 durationMin=60 / 2 槽', r.source === 'default' && r.durationMin === 60 && r.slotsNeeded === 2, r);
}
{
  const r = resolveServiceDuration(bathSvc, { species: 'cat', breed: '英短', weightKg: null });
  console.log('[回退] 缺体重:', JSON.stringify(r));
  check('11. 缺体重 → 回退 durationMin=60', r.source === 'default' && r.durationMin === 60, r);
}
{
  const r = resolveServiceDuration(bathSvc, { species: 'other', breed: '龙猫', weightKg: 0.5 });
  console.log('[回退] 物种非犬猫:', JSON.stringify(r));
  check('12. 物种非犬猫 → 回退默认', r.source === 'default' && r.durationMin === 60, r);
}
{
  const r = resolveServiceDuration({ type: 'grooming', name: '神秘定制服务', durationMin: 45 }, dog('柯基', 8));
  console.log('[回退] 服务名未命中关键词:', JSON.stringify(r));
  check('13. 服务名未命中洗澡/美容关键词 → 回退 durationMin=45 / 2 槽（45 向上取整占 2 槽）', r.source === 'default' && r.durationMin === 45 && r.slotsNeeded === 2, r);
}
{
  const r = resolveServiceDuration(bathSvc, null);
  console.log('[回退] 无宠物档案:', JSON.stringify(r));
  check('14. 无宠物档案 → 回退默认', r.source === 'default' && r.durationMin === 60, r);
}
{
  const r = resolveServiceDuration(boardingSvc, dog('金毛寻回犬', 28.5));
  console.log('[回退] 寄养:', JSON.stringify(r));
  check('15. 寄养 → 引擎不介入（durationMin=null，按晚计费口径不动）', r.source === 'default' && r.durationMin === null && r.slotsNeeded === null, r);
}

console.log(failures === 0 ? '\n全部断言通过 ✅（15 组：9 组合规则 + 6 组回退）' : `\n${failures} 组断言失败 ❌`);
process.exit(failures === 0 ? 0 : 1);
