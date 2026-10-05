/**
 * 生成 10 张商品分类占位图（SVG，800x800），v2.0 淡金谱系
 * 口径：纸白/暖底 + 淡金 #F2DFA6 描边 + 爪印水印，零亮黄（34 号档 §1.5 禁用色清零）
 * 输出到 apps/customer|merchant|staff/public/products/
 * 用法: node scripts/gen-product-placeholders.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 分类配色（v2.0 淡金谱系：纸白/暖底交替，accent 统一淡金，图标主笔用墨/深棕） */
const CATS = {
  staple: { bg: '#F4EDDC', accent: '#F2DFA6', deep: '#6B5636', ink: '#3B2E24', label: '主粮' },
  snack: { bg: '#FAF8F2', accent: '#F2DFA6', deep: '#6B5636', ink: '#3B2E24', label: '零食' },
  toy: { bg: '#F4EDDC', accent: '#F2DFA6', deep: '#3B2E24', ink: '#3B2E24', label: '玩具' },
  clean: { bg: '#FAF8F2', accent: '#F2DFA6', deep: '#6B5636', ink: '#3B2E24', label: '清洁' },
};

/** 分类小图标（居中绘制于 400,340 附近，stroke 风格；stroke=墨色主笔，fill=淡金点缀） */
const ICONS = {
  // 食盆
  staple: (stroke, fill) => `
    <path d="M250 330 h300 l-24 96 a28 28 0 0 1 -27 22 H301 a28 28 0 0 1 -27 -22 z" fill="none" stroke="${stroke}" stroke-width="14" stroke-linejoin="round"/>
    <path d="M310 330 q90 -70 180 0" fill="${fill}" opacity="0.55"/>
    <ellipse cx="400" cy="478" rx="150" ry="14" fill="${fill}" opacity="0.45"/>`,
  // 骨头
  snack: (stroke) => `
    <g fill="none" stroke="${stroke}" stroke-width="14" stroke-linecap="round">
      <path d="M322 372 L478 322"/>
      <circle cx="308" cy="352" r="26"/><circle cx="300" cy="394" r="26"/>
      <circle cx="492" cy="302" r="26"/><circle cx="500" cy="344" r="26"/>
    </g>`,
  // 球
  toy: (stroke, fill) => `
    <circle cx="400" cy="350" r="92" fill="none" stroke="${stroke}" stroke-width="14"/>
    <path d="M312 330 a92 92 0 0 1 60 -64 M488 330 a92 92 0 0 0 -60 -64" fill="none" stroke="${fill}" stroke-width="10" opacity="0.9"/>
    <path d="M322 396 a92 92 0 0 0 156 0" fill="none" stroke="${fill}" stroke-width="10" opacity="0.9"/>`,
  // 泡泡
  clean: (stroke, fill) => `
    <circle cx="370" cy="360" r="70" fill="none" stroke="${stroke}" stroke-width="14"/>
    <circle cx="470" cy="300" r="34" fill="none" stroke="${stroke}" stroke-width="11" opacity="0.75"/>
    <circle cx="462" cy="402" r="22" fill="none" stroke="${stroke}" stroke-width="9" opacity="0.6"/>
    <circle cx="346" cy="336" r="16" fill="${fill}" opacity="0.7"/>`,
};

const PRODUCTS = [
  { file: 'staple-1', cat: 'staple', name: '全价成犬粮 2kg' },
  { file: 'staple-2', cat: 'staple', name: '全价成猫粮 1.5kg' },
  { file: 'staple-3', cat: 'staple', name: '幼犬奶糕粮 1kg' },
  { file: 'snack-1', cat: 'snack', name: '风干鸡肉干 100g' },
  { file: 'snack-2', cat: 'snack', name: '猫条混合装 12 支' },
  { file: 'snack-3', cat: 'snack', name: '洁齿磨牙棒 7 支' },
  { file: 'toy-1', cat: 'toy', name: '发声橡胶球' },
  { file: 'toy-2', cat: 'toy', name: '羽毛逗猫棒' },
  { file: 'clean-1', cat: 'clean', name: '宠物通用香波 500ml' },
  { file: 'clean-2', cat: 'clean', name: '豆腐猫砂 6L' },
];

// 小爪印
const paw = (x, y, s, color, opacity = 1) => `
  <g transform="translate(${x} ${y}) scale(${s})" fill="${color}" opacity="${opacity}">
    <ellipse cx="0" cy="10" rx="16" ry="13"/>
    <circle cx="-17" cy="-6" r="7"/><circle cx="-6" cy="-13" r="7"/>
    <circle cx="6" cy="-13" r="7"/><circle cx="17" cy="-6" r="7"/>
  </g>`;

function svg(p) {
  const c = CATS[p.cat];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <rect width="800" height="800" rx="48" fill="${c.bg}"/>
  <rect x="24" y="24" width="752" height="752" rx="36" fill="none" stroke="${c.accent}" stroke-width="3" opacity="0.8"/>
  ${paw(120, 130, 1.6, c.accent, 0.55)}
  ${paw(660, 640, 2.2, c.accent, 0.45)}
  ${paw(680, 150, 1.2, c.accent, 0.5)}
  ${ICONS[p.cat](c.ink, c.accent)}
  <text x="400" y="560" text-anchor="middle" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="44" font-weight="600" fill="#3B2E24">${p.name}</text>
  <text x="400" y="618" text-anchor="middle" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="26" fill="#8A796B">菲丽亚精选 · ${c.label}</text>
  <text x="400" y="716" text-anchor="middle" font-family="'PingFang SC','Microsoft YaHei',sans-serif" font-size="22" letter-spacing="6" fill="${c.deep}" opacity="0.8">PHILIA PET</text>
</svg>
`;
}

const targets = ['customer', 'merchant', 'staff'].map((app) =>
  join(root, 'apps', app, 'public', 'products')
);
for (const dir of targets) mkdirSync(dir, { recursive: true });
for (const p of PRODUCTS) {
  for (const dir of targets) writeFileSync(join(dir, `${p.file}.svg`), svg(p));
  console.log('generated', p.file);
}
console.log('done ->', targets.join(', '));
