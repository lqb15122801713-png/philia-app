/** 批次 S1 任务 C 临时夹具（不入库）：建/删「有 staff 角色但无 staff 记录」的用户 */
import { client } from '../src/db';

const mode = process.argv[2] ?? 'up';
if (mode === 'up') {
  await client.execute(`DELETE FROM user_roles WHERE user_id = 'u_s1_nostaff'`);
  await client.execute(`DELETE FROM users WHERE id = 'u_s1_nostaff'`);
  await client.execute(
    `INSERT INTO users (id, kimi_id, nickname) VALUES ('u_s1_nostaff', 'seed_s1_nostaff', 'S1临时无档')`,
  );
  await client.execute(`INSERT INTO user_roles (id, user_id, role) VALUES ('ur_s1_nostaff', 'u_s1_nostaff', 'staff')`);
  console.log('已建临时用户 u_s1_nostaff（staff 角色，无 staff 记录）');
} else {
  await client.execute(`DELETE FROM user_roles WHERE user_id = 'u_s1_nostaff'`);
  await client.execute(`DELETE FROM users WHERE id = 'u_s1_nostaff'`);
  console.log('已删临时用户 u_s1_nostaff');
}
client.close();
