# FlowBack（回响）· 黑客松 Pitch

## 一句话

FlowBack 把群聊与聊天截图，变成可审核、可执行、可追溯的任务看板；在开工之前先指出：谁没负责、哪个时间冲突、哪个决策还没确认。

## 市场痛点

团队每天在微信/飞书/Slack 里做决定，但执行发生在另一个地方：

- 决定散落在消息里，没人把它变成任务；
- “谁来负责”靠记忆，出现责任空缺；
- 同一交付物出现多个截止时间，没人发现倒挂；
- 截图里的信息无法搜索、无法追溯；
- 通用 AI 摘要看似聪明，却会编造负责人和日期，且没有审核层。

## 核心创新

1. **聊天/截图 → 任务，而不是聊天机器人**
   每条任务保存 `source_quote`、说话人、置信度；点击可回到原句/原图。
2. **Human-in-the-loop 审核台**
   AI 只产出候选；负责人、日期、完成证据、风险全部可改，确认后才入库。
3. **确定性风险审计**
   责任空缺、截止时间缺失、时间冲突、决策变更四条规则在模型之外再跑一遍，模型漏掉的仍会被标记。
4. **“收到”不是完成**
   完成必须有逐字完成的证据；否则回退为待处理或需人工确认。
5. **诚实双模式**
   有 Key 时真实 DeepSeek Vision + JSON；无 Key 时明确标注“示例模式”，绝不伪造 AI 结果。
6. **本地优先**
   SQLite + 本地文件，单人/单团队即可跑；数据默认不出机器（调用模型时除外）。

## 技术方案

- Next.js 15 App Router + TypeScript + Tailwind + shadcn 风格组件
- DeepSeek `deepseek-flash`：Vision + JSON Output；`thinking.disabled` 保证 JSON 模式生效
- Zod 严格校验，超时/重试/修复，finish_reason 与 usage 可审计
- SQLite 6 张表：projects / sources / extractions / tasks / risks / task_events
- 图片魔数/大小校验，路径穿越防护；Key 仅在服务端，`.env.local` 0600
- 真实验收：7 组夹具（含 2 张 PNG），7/7 PASS，任务 F1 100%，风险召回 100%，引用核验 100%

## 商业价值

- **适用**：创业团队、活动/代理商、运营与项目群、远程协作团队。
- **价值**：把“开会/聊天”到“有人执行”之间缺失的 30 分钟补上；减少漏项、责任真空和返工。
- **模式**：SaaS 按项目/席位；企业私有化本地部署；API/插件嵌入现有 IM。
- **壁垒**：不是再做一个任务管理器，而是“聊天 → 可审核执行层”的数据结构 + 风险规则 + 审核体验。

## 演示

- 真实 AI 项目：<http://127.0.0.1:4317/dashboard/prj_44141e5d3cf5435c8abf>
- 真实验收报告：`acceptance/REPORT.md`
- 真实演示记录：`acceptance/REAL-DEMO-RECORD.md`
- 90 秒脚本：`acceptance/DEMO-90S.md`

**Demo Ready — Real AI.** 当前不是概念稿：真实截图、真实 DeepSeek 调用、真实 SQLite 持久化、真实审核与执行闭环。
