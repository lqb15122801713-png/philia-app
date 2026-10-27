# B-1008-PR-Agent试点评估-一页（监理件）

> 任务卡：任务-B窗-1008-PR-Agent试点.md（CJ-1008-06）｜ 评估人：B 窗监理 ｜ 2026-10-08
> 性质：本件=试点评估+就绪配置草案；**未实测**（本机无 LLM key，不编信噪比——信噪比结论必须真跑 2-3 个 PR 后定，判定标准见 §四）

## 一、是什么 / 现状核实（已查证）

- **pr-agent 已移交社区**：现居 [The-PR-Agent/pr-agent](https://github.com/The-PR-Agent/pr-agent)，Apache 2.0 不变，Qodo 捐赠社区、首位外部 maintainer 已到任；Docker 镜像新空间 `pragent/pr-agent`（0.34.2+），旧 codiumai 空间冻结——**workflow 引用要用新名**
- 部署形态：GitHub Action（推荐）/CLI/Docker 自托管；模型经 LiteLLM 接 **DeepSeek**（OpenAI 兼容）✓；中文输出 `response_language`/指令强制 ✓
- 单工具单次调用（~30s）：/review /describe /improve /ask；PR 压缩策略支持大 diff
- ⚠️ 安全在案：`/help_docs` 自 v0.36.1 起临时禁用（凭据泄漏问题 [#2445](https://github.com/the-pr-agent/pr-agent/issues/2445)）——与本项无关但选型须知

## 二、与 B 窗职责的边界（任务卡口径照转）

它不懂业务口径：**钱红线/裁定口径/冻结值核查仍归 B 窗职责 1-9 不变**。它补的是「逐行评审层」——类型错误边缘/明显 bug/安全风险/可读性，恰好与我职责⑨可维护性评审（可懂/可改/业务对得上）形成机审+人审双轨。

## 三、成本估算（便宜档）

DeepSeek 级模型：单 PR（数千行 diff）约 3-6 万 input token ≈ **¥0.1 级/次**；本项目 PR 节奏（日均 1-3 个）月成本 **¥10 内**。成本留痕：DeepSeek 控制台用量页+我每月核查报告一行。

## 四、信噪比判定标准（试点验收尺，事先冻结）

试点=接入后接下来 3 个真实 PR：
- **留**：有用意见（真问题/真风险）≥30% 且 无误导性错误意见（指错位置/编造 API）
- **不留**：连续 2 个 PR 噪音过半或出现误导性错误
- 误判处置：意见仅供参，不改验收链任何一环权重

## 五、就绪配置包（草案两件，落仓归 A 窗/PM——我不建仓内文件）

随件同区：`B-1008-PR-Agent配置草案/` 两件——
1. `pr-agent.yml`（.github/workflows/ 落点）：the-pr-agent/pr-agent@main + sparse-checkout + Bot 过滤 + synchronize 显式开 + 权限最小化（pull-requests/issues write）
2. `.pr_agent.toml`：deepseek 便宜档 + 中文强制 + ignore 锁文件/生成物 + extra_instructions 按本项目钱域/权限闸/迁移纪律定制

**上线只差一件**：老板/PM 在仓库 Settings→Secrets 配 `DEEPSEEK_API_KEY`（或 Org 级），然后下一个 PR 自动见真章。

## 六、结论（候 PM+老板定）

**建议：留，按试点尺跑 3 个 PR 再正式定。** 理由：成本可忽略、配置全在仓内可控可撤、边界与我的职责不重叠不冲突、信噪比判定标准已事先冻结防扯皮。风险面（密钥管理/#2445 类安全事件盯 release notes）已在案。

— B 窗（监理）2026-10-08
