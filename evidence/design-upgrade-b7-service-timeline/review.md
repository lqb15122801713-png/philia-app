# 独立只读评审记录 · PD-40 B7

评审者：agent-28（独立 coder 子代理）。评审过程只读，未修改工作树，未派生其他评审代理。

## 首轮发现与处理

| 项 | 处理 |
|---|---|
| done／完成节点照片不可见 | 放开有照片节点展开；完整照片集进入 PhotoViewer；补前序洗护与完成单 before/after 回归 |
| 显式预览可能命中缓存真单 | 显式 B7 预览强制空 aid，跳过 push.subscribe 与 SSE；补缓存 ID 回归 |
| expanded 与真实照片契约不一致 | 照片数对齐 1/2/3/2/2/0；真实照片与占位共用首屏三格 +N |
| 安全区与安装条遮挡 | live 路由不挂 InstallBanner；压缩节点间距；以 34px safe-area 和真实 beforeinstallprompt 实证 |
| 步骤失败被当正常进度 | 增加独立错误卡与重试；末步中间态计数保持 6，confirm done 同步失效 appointment |
| 洗护绕过 CanvasLayoutLoader | B7 接回 apptLive 六块与发布布局排序／显隐 |
| 完成态评价 cream | ReviewPanel 增加 neutral accent，B7 专用，其他调用方默认不变 |
| 异常副文 11px | 仅 B7 使用 largeText，升到 12px |
| 照片文案与缺图 | 按节点和实际照片数切换；缺 before/after 不复制旧图 |

首轮后复核又发现 only-after 会被错标为服务前。随后按 tag 选真实索引，缺侧占位，补 only-after 回归。

## 后续发现与处理

- 预览点选探针在捕获阶段拦截展开按钮，补 `data-canvas-interactive` 仅用于 B7 时间轴；其他画布点选行为不变。
- 最终浏览器补真实点击：当前步可展开并收起；步骤空态「稍后再看」可收起。

## 最终技术评估

agent-28 对 only-after 修复后的最终结论：**Resolved；其他 Critical/Important 无；Ready to merge = Yes。**

本记录只说明代码审查结果，不替代产品侧后续复核。
