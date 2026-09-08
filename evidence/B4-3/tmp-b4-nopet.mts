/**
 * 【批次 4 证据辅助 · 用完即删】造一个无宠物的 seed_ 客户（dev-login 仅放行 seed_ 前缀），
 * 用于「新客空宠物先建档卡」边缘态截图。--cleanup 时删除该用户。
 * 运行：cd server && npx tsx scripts/tmp-b4-nopet.mts [--cleanup]
 */
import { eq, like } from 'drizzle-orm';
import { db, schema } from '../src/db';

const KIMI_ID = 'seed_kimi_b4_nopet';

async function main() {
  const cleanup = process.argv.includes('--cleanup');
  const existing = await db.select().from(schema.users).where(eq(schema.users.kimiId, KIMI_ID));
  if (cleanup) {
    for (const u of existing) {
      await db.delete(schema.pets).where(eq(schema.pets.ownerId, u.id));
      await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, u.id));
      await db.delete(schema.users).where(eq(schema.users.id, u.id));
    }
    console.log(`cleanup done, removed ${existing.length} user(s)`);
    return;
  }
  if (existing.length > 0) {
    console.log(JSON.stringify({ id: existing[0]!.id, reused: true }));
    return;
  }
  const [u] = await db
    .insert(schema.users)
    .values({ kimiId: KIMI_ID, nickname: 'B4空宠物客户', phone: '13800000099' })
    .returning();
  await db.insert(schema.userRoles).values({ userId: u!.id, role: 'customer' });
  console.log(JSON.stringify({ id: u!.id, reused: false }));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
