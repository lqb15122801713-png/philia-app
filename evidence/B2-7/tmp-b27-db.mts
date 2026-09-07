// 临时 DB 查询脚本：复制到 server/scripts/ 下用 tsx 执行（@libsql/client 解析约束），用完即删
// 用法：tsx scripts/tmp-b27-db.mts "SELECT ..."
import { client } from '../src/db';

const sql = process.argv.slice(2).join(' ');
const r = await client.execute(sql);
console.log(JSON.stringify(r.rows, null, 1));
client.close();
