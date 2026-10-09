# 卷宗 · 微光正名批 片 2（末片 · A 股预览身份+C 股 3/4）

> 令=开工令-产品-1009-微光正名批片2.md ｜ 任务书=冻结版 V1.0 ｜ 片 0/1 复核全过（意见书在区）｜ 冲刺模式照授权-1004 ｜ 纪律-PM-1008+红区补丁照走 ｜ 档位=K3·High ｜ 基线=叠片 1 尖 b82189ae（codeload 钉 sha）｜ 分支 `feat/rename-pool-2` ｜ 卷宗 `evidence/rename-pool2` ｜ PR 只开不合（base=feat/rename-pool-1）｜ 施工=A 窗 2026-10-09。

## 一、施工总账（A 股+C 股 3/4 全收）

### A 股 · 画布预览身份（CJ-1009-02 裁①）

- `canvasPreview=1` 探针模式下会员态页（memberCenter 单页，片 0 收窄在案）渲染**示例客户视图**：MemberCenterPage 新增探针参识别——membership.my 401/403 且探针模式 → A3Body 示例数据（`exampleMyOf`：示例档=萤火读 member_plans 端口取档名/权益；回馈金挂零（balanceFen/pendingFen=0 同既有口径）；有效期=开通日+365 天示例；upgradeAvailable=真值透出升级入口）——**零真会话零写库**；**「预览示例 · 示例客户视图（非真实数据）」水印角标**（军规一②，copy 键 mc.canvasExampleNote 入端口）；
- 落点=画布 iframe 内（探针参识别）；真用户页零改动（非探针模式照旧 ErrorState）；点选反查/改文案/发布链路不动；
- 实尺=画布三页签全渲染（memberCenter 不再「加载失败」：帧 2 iframe 200 真页+帧 4 示例视图直开帧=水印+萤火身份大卡+三格账+权益墙全渲染，逐屏目检在卷）。

### C 股 3/4

- **栅格窗口随档放宽**（观察台账销项）：server `getWithServices` 栅格合成窗口 for i<7 固定 → **读档口径**（客户访客=其档 advance_book_days 天[注册用户 7/付费档 14]，管理视角 7 天不动；窗口上限 31 防呆）+透出 `advanceDays` 字段（客户端同源读）；客户端 `buildWeekGrid` dayCount 参数化（缺省 7=旧调用方不动）+GroomingSinglePage 读 servicesQ.data.advanceDays+DateStripBlock 注记改端口件（booking.advanceNote=「可约期为未来 {days} 天（按档）」）——server/页读/注记三同源；e2e 67.5 随改（栅格档差恢复：暖阳 >now+7d 槽出现+注册用户 ≤7d 不变；boardingAvailability 8/10 晚不动）；
- **轮询膨胀补采**：`createPhiliaClient` httpBatchLink fetch 统一收口加**URL 长度哨兵**（>4KB=console.warn 带路径指纹，零行为改动；BATCH_URL_WARN_LEN 导出可测）——捕不到=挂账不遮（观察台账挂着：生产亲见一次 528 段未复现，哨兵上线后捕现场）。

## 二、申报件

1. 迁移 **0072**（copy 键 2 增：mc.canvasExampleNote 示例水印+booking.advanceNote 档口径注记；幂等守卫；生成器直出；**同号补充=未推未部署前 append**，journal idx 72；dev 库已落+手补登记在案）——**部署时须随码落库**；
2. e2e 全量两绿采信 **957/958 断言**（67.5 随改=栅格档差恢复；90 族不动零回退；55-89 零回退；56.1/76.3=3892/72 随键同步）；
3. **nav 双表零申报**（零新路由；124 路由 0 死 0 弱）；
4. **CJ-1008-01 六条自过**+红区硬句照走。

## 三、闸门（2026-10-09 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build / server typecheck | 0 / 0 | gate-build.log（typecheck 随改随跑终态 0） |
| e2e 全量 | **两绿采信**（g2=957+g3=958；g1=7200 占用拒跑环境件清场后补绿） | gate-e2e-green1/green2.log |
| check-nav-closure | 124 路由 · 死 0 · 弱 0 · 豁免 6 | gate-nav.log + nav-closure.json |
| smoke-routes | 108/108 | gate-routes.log |
| review-e2e | 全绿 ✅ | gate-review.log |
| smoke-deploy | 全部通过 🎉 | gate-deploy.log |
| 实尺截图 6 帧 | 画布三页签全渲染（home/memberCenter 示例视图/cashier）+示例视图直开帧（水印+萤火大卡）+栅格档对照（暖阳 14 天日历 in-window 注记/注册用户 7 天）——逐屏目检（PROBE_ALL_GREEN，8 断言全 ok） | 01-06-*.png + probe-result.json |

## 四、红线自查

零新依赖 / 禁令零命中 / 行尾 LF / 迁移幂等（0072 守卫）/ 多句 INSERT=脚本生成（0072 INSERT=2）/ 栅格窗口=读档口径三同源（server 透出+页读+注记端口件）/ 收摊必净（7100-7102/7200 零监听+uploads/staging 清零）/ CJ-1008-01 六条自过。

## 五、登记候知会

1. **e2e g1=7200 占用拒跑**（环境件：闸门栈未收摊即跑 e2e=自检拒跑，清场后补绿）——纪律注记：e2e 前先清 7200；
2. **轮询膨胀补采挂账不遮**：哨兵已上线（>4KB warn 带指纹），生产捕到现场即销项，捕不到=台账挂着（不遮）；
3. 探针备数=19900000992/19900000993（暖阳档直插库 plan_key 换档）明面登记；
4. 生产亲验候产品侧：画布三页签全渲染（memberCenter 示例视图）+付费档栅格 14 天。

— A 窗（施工方，角色卡⑧ V2.2+红区补丁）2026-10-09
