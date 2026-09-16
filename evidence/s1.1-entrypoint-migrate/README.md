# 批次 S1.1 验收证据索引
1. migrate-simulation.txt —— 仿真1首装全量应用（7 条）exit=0；仿真2同库重跑 0 pending exit=0
2. bad-migrate-output.txt —— 仿真3坏迁移（0007_broken 指向不存在表）：exit=1（迁移失败）；entrypoint 的 set -e 保证失败即终止、exec 起服务永不执行（fail-fast）
3. 回归：三端 build=0/0/0、server typecheck=0、e2e=0、smoke-routes 30/30=0（本消息同批跑出）
4. VPS 收口：随下一含迁移批次重新部署，产品侧实证「无需手动迁移」
