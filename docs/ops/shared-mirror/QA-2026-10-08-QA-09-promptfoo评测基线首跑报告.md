# QA-09 · promptfoo 评测基线首跑报告（管线自检版）

> 侧别：QA 协理｜日期：2026-10-08｜依据：任务-QA-1008-2（CJ-1008-08 老板批「全部照办」）

## 一、交付物（全部在共享区）

- `QA-2026-10-08-QA-09-promptfoo基线/`——README + roles/ 五份配置（role-a/role-b/role-pm/role-pmo/role-qa，各 12 题）；
- `QA-2026-10-08-QA-09-promptfoo评测基线考题集.md`——60 条考题+标准答案要点（可读版，卡变题随）。

## 二、首跑结果

1. **安装**：promptfoo 0.124.0（npm 全局，608 包，MIT 开源）✅；
2. **配置验证**：五窗配置逐份 `validate`——**全部 valid** ✅；
3. **管线自检**（echo 提供者，角色卡④ 12 题）：评测引擎+断言引擎端到端跑通（12 题执行完毕，echo 回显下 9 过 3 不过——**不计分**，仅证明管线可用）✅。

## 三、环境坑与解法（重要，给要跑的人）

**Kimi Work 本机「node」实为 Kimi.exe 伪装（process.execPath=Kimi.exe）**——promptfoo CLI 的子命令派发（validate/eval 参数解析）在其下全部报「unknown command main.js」。**解法=独立 Node.js 便携版**：
- 已下载 `node-v24.21.0-win-x64.zip`（37.6MB，nodejs.org 官方）解压在 `D:\KimiData\kimi\Workspaces\pfoo-smoke\node-v24.21.0-win-x64\node.exe`；
- 运行姿势：把要跑的配置复制为工作目录下 `promptfooconfig.yaml`，用该 node 执行
  `<独立node> "D:\KimiData\daimon-share\daimon\npm-global\node_modules\promptfoo\dist\src\main.js" eval`；
- 已用此姿势完成五窗 validate+echo 自检。

## 四、真实首跑（待端点，二选一）

1. **本地 Ollama**（零成本，默认配置）：安装 Ollama → `ollama pull qwen2.5:7b` → 配置里 `ollama:chat:qwen2.5:7b` 直接可用；
2. **API key**：设 `OPENAI_API_KEY`，各 yaml 的 providers 改 `openai:chat:gpt-4o-mini`。

**请老板/PM 定端点**——端点到后 QA 跑五窗首版基线分，报告进共享区（命名 QA-2026-MMDD-QA-09-评测报告-角色卡X）。

## 五、纪律落地（已写入 README）

卡变题随（角色卡每修订→考题集同步改→跑回归）；通过率 <100%=卡与执行有出入，报 PM+老板，不许悄悄改题放水；红队件（promptfoo 自带红队安全测试）随首版后评估启用。

— QA 测试工程师 2026-10-08
