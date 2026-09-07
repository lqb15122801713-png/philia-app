// 按昵称从 dev-seed-users JSON 取用户 id（禁止硬编码 ULID）
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const u = d.users.find((x) => x.nickname === process.argv[3]);
if (!u) {
  console.error('seed user not found: ' + process.argv[3]);
  process.exit(1);
}
console.log(u.id);
