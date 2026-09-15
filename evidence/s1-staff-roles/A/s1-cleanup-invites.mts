import { client } from '../src/db';
await client.execute(`DELETE FROM staff_invites WHERE staff_name IN ('测试前台','测试美容师')`);
const r = await client.execute('SELECT COUNT(*) AS c FROM staff_invites');
console.log(`测试邀请已清理，staff_invites 剩 ${r.rows[0].c} 行`);
client.close();
