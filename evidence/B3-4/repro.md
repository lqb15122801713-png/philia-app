# B3-4 寄养改期 · 修复前复现记录

时间：2026-09-07（本地 UTC+8）；环境：server:7200 + customer:7100（dev 种子库）。

## 复现 1：客户端寄养单详情页无改期入口

1. 客户创建寄养单（标准间寄养（犬），2026-09-09 10:00 入住 → 2026-09-11 10:00 退房，2 晚）→ 商家 confirm；
2. CDP 打开 `/appointments/01M1Y1RZV5Z1XDFR8N1FNZRZM1`，DOM 断言全部按钮无「改期」：
   - 输出：`PASS 寄养单详情页无「改期」按钮（修复前复现）`（见 repro-e2e.log）
   - 截图：`repro-detail-no-reschedule.png`（底部仅「取消预约」）
3. 根因定位：`apps/customer/src/pages/AppointmentDetailPage.tsx` 中
   `reschedulable = cancellable && freeCancel && appt.type === 'grooming'`
   —— type 限制把寄养单排除在自助改期入口之外。

## 复现 2：直接调 appointment.reschedule 传 boarding 单 —— scheduledEnd 缺省被静默吞掉

入参 zod schema 为 `scheduledEnd: z.date().optional()`，寄养不传时不报错，服务端按
`start + 24h` 缺省结束时间（`appointment.ts` reschedule 缺省分支）：

```
POST /trpc/appointment.reschedule
{"0":{"json":{"appointmentId":"01M1Y1RZV5Z1XDFR8N1FNZRZM1","scheduledStart":"2026-09-12T02:00:00.000Z"},
 "meta":{"values":{"scheduledStart":["Date"]}}}}     ← 故意不传 scheduledEnd
```

响应（原始输出见 repro-reschedule-no-end.json）：

```json
{"scheduledStart":"2026-09-12T02:00:00.000Z","scheduledEnd":"2026-09-13T02:00:00.000Z",
 "status":"pending","priceFen":39800}
```

查库快照（repro-snapshot-before.txt / repro-snapshot-after.txt 同文件前后对比）：

| 项 | 改期前 | 缺省改期后 |
| --- | --- | --- |
| 区间 | 9/9→9/11（2 晚） | 9/12→9/13（**被压成 1 晚**） |
| priceFen | 39800（2 晚价） | 39800（晚数变了金额没变，口径错位） |
| boarding_slots | 9/9、9/10 各 booked=1 | 9/9、9/10 释放为 0；仅 9/12 booked=1 |

即：寄养改期缺少 scheduledEnd 强校验时，客户无法表达「重选退房日」，多晚单被静默改成
1 晚且金额快照不随之调整 —— 正是 B3-4 要求「寄养必传 scheduledEnd」的原因。
（B3-2 已把 reschedule 事务的 boarding 槽位分支备好，故缺省调用不报错反而放行，更需入口收紧。）

## 结论（修复点）

1. 服务端 reschedule：boarding 必传 scheduledEnd 且须晚于 scheduledStart，否则 BAD_REQUEST；
2. 客户端详情页：reschedulable 去掉 type 限制，寄养改期面板复用 B2-5 两阶段日期组件
   重选入住/退房（预填当前区间），提交带 scheduledStart+scheduledEnd，
   toast 沿用「改期已提交，等待商家重新确认」。
