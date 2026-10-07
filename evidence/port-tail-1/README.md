# 卷宗 · 端口批收尾 片 1（配置端口增补 7+搜索帮助）

> 令=开工令-产品-1007-端口批收尾片1.md ｜ 任务书=冻结版 V1.0 ｜ 附件=盘点表（片 0，唯一名单口径）+候裁件裁定（回执-产品-1007 §二）｜ 基线=main@5cf674c0 ｜ 分支 `feat/port-tail-1` ｜ 施工=A 窗 2026-10-07 ｜ PR 只开不合。

## 一、施工总账（令 §一 7 件全收+裁定随带照执）

1. **配置回滚**：`config.rollback`——目标版本整行恢复 active（新行 version=域 max+1、effective_from=now、createdBy=操作人，旧 active 行失效）+rule_config_versions 留痕（note=`rollback:vA→vB`）；**回滚≠改历史=只增不改**（历史行零改写，e2e 83.1 四连：恢复/版本递增/历史不动/幂等 400）；UI=规则行「历史」展开时间轴+「回到此版」（截图 03）。
2. **定时生效/定时切换**：`config.save` 加 `effectiveAt`（ISO；晚于当前=定时件：新行 active=0+effectiveFrom=时点+`config_scheduled` 登记 pending，同 key 旧 pending=superseded 顶替；**不晚于当前=400 明文**，默认保存即生效冻结口径不变）+**到点懒切换**=`sweepScheduledConfig`（60s 滴答，激活时落域 max+1 版本+note=`scheduled-applied` 留痕，幂等重扫零增量）+`config.cancelScheduled` 撤销；列表显「待生效」徽+撤销钮（截图 02；e2e 83.2 五连）。
3. **涉钱参数二级审批**：approval_requests 加 kind='config'（**不新建审批表**；载荷单据表=`config_change_proposals`，同 purchase_orders 之 refId 工艺）——`config.proposeChange`（仅受理涉钱键名单内变更，名单外 400 明文引去直存）→值不落库 pending→`config.configApprovalReview`（merchantManagerProcedure=owner/manager 复核；通过=同事务应用：再校验防漂移+版本化+note=`approved-apply` 留痕 changedBy=发起人/复核人落 reviewerId；驳回=双 rejected 不落库）+`config.configApprovals` 队列；UI=涉钱 danger 徽+「审批中」徽+保存流分流「提交审批」+域内审批区（截图 04；e2e 83.3 五连）。**配置行非支付行=留痕不碰真钱照裁**。
4. **kill switch+异常自动回滚**：①service_rules 全局键 `config_kill_switch`（0059 种子）+`config.setKillSwitch`/`config.killStatus`——开=全部可关参数瞬时回落安全值（**v1 可关名单=pay_channel_enabled**：`loadPayChannelEnabled` 首行 kill 闸恒 false=线上通道关）+ConsolePage 大红横幅显著态（截图 05）；②异常自动回滚=`sweepConfigAutoRollback`（60s 同滴答）：指标源=`client_error_events`（POST /api/client-error 在既有 JSONL 之外同事落库，try/catch 不阻断收错=选型口径不变），越 service_rules 键 `client_error_alert_threshold{threshold:20,minutes:10}` 线→**幂等锚=键最新窗口工序**（最新=机器 note 跳过防互滚；最新=人工 note 空/approved-apply 才回滚到该手 before，只撤最新一手不考古）+告警通知（type=`config.autoRollback`，店主+店长+原变更人）+留痕（e2e 83.4/83.5 五连，含幂等重扫零增量）。
5. **参数字典/通用字典表**：`config.dictionary`——参数域（copy 域除外）逐键透出最新行 label+**通用字段字典**（FIELD_NOTE 40+ 字段人话注，写死件）+帮助注+涉钱标+生效版本，q=键/名/注服务端过滤；UI=ConsolePage D3「参数字典」端口 ConfigDictBody（截图 06）。
6. **规则页搜索**：RulesConfigPage SearchInput（testid `rules-search`）按 ruleKey/label/helpText contains 过滤（同文案端口页工艺；截图 01）。
7. **逐参数帮助内嵌**：label 下一行小字=`composeHelpText`（cfghelp.<ruleKey> copy 键覆盖优先，缺省=字段字典逐字段合成；**走 copy 键留口**=0060 注册 8 枚示范键，新键须新迁移同屏名工艺）。

**裁定随带照执**：A5 多环境=本批不收（零代码触及）；A12 文案域不上两步流（保存即生效口径不动）；A35 金额 tier=划出（零代码触及）。

## 二、申报件

1. 迁移 **0059**（config_scheduled+config_change_proposals+client_error_events 三新表+service_rules 三键[config_kill_switch/config_auto_rollback/client_error_alert_threshold]）+**0060**（cfghelp copy 键 8 枚=脚本生成+INSERT 计数断言==8 ✓）；journal idx 59/60；seed.ts 补种三键；dev 库均手工追平（sha256=9b32210f…/56f0e837… 补登，migrows=61）；
2. e2e 族 83 新增（8 组 23 断言；既有断言零删改）；56.1/76.3 计数 **3602→3671**（+60 UI 键+8 cfghelp；域 70 不变）同步；
3. **R11a① 扫描器零触及**（本片无互转类新口）；nav 双表零申报（**本片零新路由**：新增面全部直嵌既有 /settings/rules 与 /console；归屏率 96.8%>90% 军规线，未归屏 116/3671=3.2%<10%）；
4. **口径登记候裁**：①二级审批=新端点流，直存口 config.save **不挂硬闸**（护既有断言+e2e 十个 owner 直存涉钱域调用点；名单内键 UI 只给「提交审批」口，审批应用口=名单内唯一新落库通道）——若产品侧要 save 硬闸须先迁移那十处 e2e 直存；②涉钱键名单 v1（member_plans/pay 全域+commission 费率族+refund 阈值两键+service 现金两键，宁可宽列保守口径）；③killable 键 v1=pay_channel_enabled 一键（全局键架构留口，新可关参数照同族注册）；④自动回滚指标源 v1=client_error_events（闸门键端口可改）；⑤kill switch 目标行 store_id=NULL=全局单份（三店同闸口径）；⑥复核人可与发起人同人（留痕双字段照录，单 owner 店不卡死）；
5. **环境件登记**：①e2e 二/三/四跑三连「fetch failed/ECONNRESET」=静默死环境件（server 日志尾仅预期测试噪音无崩），清 83 个 EPERM 残留临时库后**五跑/六跑两绿采信 884 断言**；②**merchantchain 残留树清场**（批讫环境件：3 vite preview 7110-7112+tsx server 7200+1 tsx，PID 6772/36700/33204/7240/34824 子树 taskkill 实证）——nav 闸门两轨澄清：**截图/smoke-deploy=7130-7132+7201（VITE_API_BASE=7201 build）；nav 闭合/smoke-routes/review-e2e=7100-7102+7200（根目录 npm run build Y1 裁定轨）**；③nav 首二跑空白/超时=端口错轨环境件（自证：探针实测 /settings/rules 渲染 ✓）。

## 三、闸门（2026-10-07 实跑全绿）

| 闸门 | 结果 | 日志 |
|---|---|---|
| 三端 build（7201 轨）+根目录 build（Y1 轨） | 双轨 exit 0 | gate-build.log |
| server typecheck | 0 | （tsc 每改随跑，终态 0） |
| e2e 全量 | **两绿采信 884 断言**（族 83 八组 23 连 ✓；51-82 零回退；56.1/76.3=3671/70；76.1 归屏率 96.8%；76.4 未归屏 3.2%） | gate-e2e-full.log（绿 2）+gate-e2e-green1.log（绿 1） |
| check-nav-closure | **124 路由 · 死 0 · 弱 0 · 豁免 6** | nav-closure.json+gate-nav-closure.log |
| smoke-routes | **108/108** | gate-smoke-routes.log |
| review-e2e | 全绿 🎉 | gate-review-e2e.log |
| smoke-deploy | 全部通过 🎉（held 零新增残留） | gate-smoke-deploy.log |
| 实尺截图 6 帧 | 规则页搜索+涉钱徽+帮助注/待生效徽+撤销/回滚时间轴三版/二级审批 pending 区/kill 大红横幅/参数字典 q=kill——**逐屏目检已做** | 01-06-*.png+probe-result.json（PROBE_ALL_GREEN） |

## 四、红线自查

零新依赖 / 禁令新增行命中=0（cfghelp 文案过禁令闸：无充值/储值/自动续费/返现族词）/ 行尾 LF / 迁移幂等（NOT EXISTS 守卫）/ 多句 INSERT=脚本生成+计数断言（0060=8 ✓）/ 涉钱二级审批=留痕不碰真钱（配置行非支付行）/ 回滚≠改历史（只增不改）/ 定时件默认直存口径不变 / 隔离族不回退（83.7 权限闸+83.8 分层口径）/ 收摊必净（四服务 TaskStop+netstat 复核+taskkill 补刀 PID 36220/15524/41908/5840 子树→残留监听=0）。

## 五、探针备数登记（dev 库明面）

refund_sla_hours 定时件（72h，+1h 生效留 pending 徽）/ member_plans rebate_validity_days 审批 pending 单（days:180）/ refund_apply_window_days 三连版（7→8→9，回滚时间轴备数）/ kill switch 已复原 off。

— A 窗（施工方，角色卡⑧ V2.1）2026-10-07
