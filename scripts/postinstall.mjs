// 批次 7.1 前置项：根 npm install 后自动安装 server 独立依赖（server 不在 workspaces 内，
// 有独立 package-lock），保证「clone → npm install → npm run build」一次通过
// （三端 tsc 以相对路径类型引用 server/src，需 server/node_modules 在场）。
// Docker fe-builder 阶段先拷清单层跑根 npm ci 时 server/package.json 尚未拷贝 → 跳过
// （该阶段随后显式 npm --prefix server ci，行为不变）。
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (!existsSync(join(root, 'server', 'package.json'))) {
  console.log('[postinstall] server/package.json 不在场（Docker 分层构建清单层），跳过 server 依赖安装');
  process.exit(0);
}
const isWin = process.platform === 'win32';
const r = spawnSync(isWin ? 'npm.cmd' : 'npm', ['--prefix', 'server', 'install', '--no-audit', '--no-fund'], {
  stdio: 'inherit',
  shell: isWin, // Windows 下 .cmd 需经 shell 解析
});
process.exit(r.status ?? 1);
