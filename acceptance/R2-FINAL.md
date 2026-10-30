# FlowBack R2 · 最终工程与功能验收

日期：2026-10-30  
状态：**DEMO READY — REAL AI**  
运行地址：<http://127.0.0.1:4317>

## 1. API 配置

- 凭据来源：DeepSeek Harness 已保存的 `refs.DEEPSEEK_API_KEY`（官方 API Key，不是 Web Session/OAuth）。
- 配置方式：本机脚本在进程内部读取，写入 `flowback/.env.local`，文件权限 `0600`，`.env.local` 在 `.gitignore` 中。
- Key 未出现在代码、README、报告、截图、终端输出或本文件中。
- `DEEPSEEK_MODEL=deepseek-flash`
- `DEEPSEEK_TIMEOUT_MS=45000`
- 服务端健康检查：`ai.configured=true`，`thinking=disabled`，`maxTokens=8192`，`imageDetail=high`。

## 2. 真实模型调用

| 场景 | 结果 |
| --- | --- |
| 极简文本冒烟 | 1 任务、1 风险，HTTP 201，2048ms，1449 tokens |
| 真实 PNG 截图（首轮） | 2 任务、1 风险，HTTP 201，3302ms，1947 tokens |
| 7 组夹具验收 | 7 个真实请求；6 个 HTTP 201，闲聊用例 422 NO_TASKS 属预期拦截 |

7 组真实验收最终结果（见 `acceptance/REPORT.md`）：

| 指标 | 结果 |
| --- | --- |
| 夹具 | 7（5 文字 + 2 PNG） |
| PASS / PARTIAL / FAIL | **7 / 0 / 0** |
| 任务召回 / 精确率 / F1 | **100% / 100% / 100%**（13/13） |
| 风险召回 | **100%**（7/7） |
| 原文引用核验 | **100%**（21/21） |
| API 调用次数 | 7（无重试/修复额外调用） |
| Token 用量 | prompt 13,956 / completion 3,348 / total **17,304** |
| 平均 / 中位耗时 | 2702ms / 2569ms |

> 样本是人工构造的 7 组夹具，不代表线上分布；这里只证明关键链路真实可用，不承诺模型永远 100%。

## 3. 完整真实 AI 闭环

真实截图 `07-chat-conflict.png` → DeepSeek Vision → 审核台：

- 抽取 3 个任务、3 条风险，`mode=ai`。
- 人工把「联系场地并确认入场时间」负责人改为陈默、截止改为 2026-11-02。
- 确认入库后 3 个任务、1 条 due_conflict 风险（已修复的 owner_gap/due_unclear 不再重复）。
- 看板将「提交主视觉海报最终稿」改为进行中。
- 风险中心将 due_conflict 标记解决，并保留处理说明与原文引用。
- 刷新/重新 GET 后状态仍然存在。

脱敏记录：`acceptance/REAL-DEMO-RECORD.md`  
演示项目：<http://127.0.0.1:4317/dashboard/prj_44141e5d3cf5435c8abf>  
审核存档：<http://127.0.0.1:4317/review/ext_226b83464b0649f5b3df>

另有真实文本演示项目「R2 发布演示」（3 任务：1 个带完成证据的 done、1 个 doing、1 个 todo；3 条开放风险）：  
<http://127.0.0.1:4317/dashboard/prj_5d2229e959ee456eae1a>

## 产品演示视频

- 文件：`demo/FlowBack-Product-Demo.mp4`
- 52.4s / 1920×1080 / 30fps / H.264 + AAC；封面 `demo/FlowBack-Product-Demo-Cover.png`
- 录制自真实生产构建与一次真实 DeepSeek 截图调用；包含上传截图、AI 抽取、审核修改、确认入库、看板状态、风险解决。
- 制作说明：`demo/README.md`

## 4. 本轮修复

P0：

- **思考模式导致 JSON 模式失效**：显式 `thinking: {type:"disabled"}`。
- **图片引用漏字**：提示词要求先逐字转写 transcript，再从 transcript 复制 quote；引用不匹配则降级为待确认；2× 高清截图提升 OCR。
- **时间冲突用例丢初稿任务**：提示词增加里程碑拆分示例，`temperature=0`。
- **负责人编造**：引入原文指派校验；仅说话人出现、没有明确指派的 owner 会被清空并生成 owner_gap。
- **报告状态错误**：修正 overall 统计（原先把所有结果误判为 FAILED）。

P1：

- 删除相对日期导致的重复 due_unclear 噪声。
- 对无决策标记的 decision_unconfirmed 风险做过滤。
- API 响应包含 token/attempt/finish_reason 元数据，验收报告可审计。
- 首页截图入口、真实 AI 审核提示、看板完成证据展示。
- 报告/演示文档自动生成，状态与 N/A 不伪造。

## 5. 工程验证

```bash
npm run lint        ✔
npm run typecheck   ✔
npm test            ✔ 7 files / 64 tests
npm run build       ✔
```

回归：

- 示例模式（无 Key 路径）仍可用；截图无 Key 返回 `NEED_API_KEY`。
- 审核 → 确认 → 看板 → 风险 → 刷新持久化通过。
- 风险路径穿越、客户端密钥边界、analyze/confirm 分离有自动化测试。
- 移动端布局保持响应式。

## 6. 已知风险

- 模型输出存在随机性；本轮 7/7，但换输入/换时间可能波动。生产需持续评测。
- 截图 OCR 仍可能误读；transcript + 引用校验能降低但不能完全消除，最终需人工确认。
- “10月24日”等无年份日期可能按当前年份推断；UI 标记推断/待确认。
- 单机单用户、无账号级鉴权；能访问 4317 端口且知道 source id 的客户端可读取截图。MVP 定位为本地/单团队演示。
- 正式 API 调用会产生费用；未加复杂配额/预算系统。
- Key 保存在本机 `.env.local`（0600）；本机有权限的用户仍可读取。

## 7. 结论

**DEMO READY — REAL AI。** 已满足“至少一次未预置内容的真实 AI 任务提取成功，并走完保存和执行闭环”的门槛；7 组真实验收全通过。
