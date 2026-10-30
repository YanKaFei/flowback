# R2 真实 AI 验收

## 运行

```bash
cd flowback
npm run acceptance
```

- 当前 `.env.local` 已配置服务端 Key（0600，gitignored）；`npm run acceptance` 已真实执行 7 组夹具。
- 7 组夹具（5 文字 + 2 PNG 截图）通过真实 `/api/analyze` 调用，逐项记录任务、风险、引用、误报/漏报、耗时与 Token，写入 `REPORT.md` 和 `results/latest.json`。
- 报告只走审核草稿，不确认入库；每次真实运行后 harness 会删除临时项目。
- 报告不包含完整原始聊天；只保留用于核验的引用片段。

## 夹具

| 文件 | 内容 |
| --- | --- |
| `fixtures.json` | 7 组人工期望：正常分工、时间冲突、无人负责、决策变更、无任务闲聊、截图正常、截图冲突 |
| `images/06-chat-normal.png` | 1440×1040 合成聊天截图（PNG，2×） |
| `images/07-chat-conflict.png` | 1440×1200 合成聊天截图（PNG，2×） |
| `html/*.html` | 截图源 HTML，可重新渲染 |

## 重新生成截图

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=720,520 \
  --screenshot="$PWD/acceptance/images/06-chat-normal.png" \
  "file://$PWD/acceptance/html/06-chat-normal.html"
# 07 使用 --window-size=720,600
```

## 真实 AI 报告应包含

- 运行配置：model、baseURL、thinking=disabled、maxTokens、timeout。
- 汇总：任务召回/精确率/F1、风险召回、引用核验率、平均/中位耗时。
- 逐项：期望任务、实际任务、风险、原文引用、误报、漏报、耗时。
- 典型失败案例与人工复核边界。

## 说明

- 人工期望不是唯一正确答案；关键指标用于发现遗漏/伪造，不替代人工语义审核。
- “无任务闲聊”若被模型返回 0 任务，产品接口返回 `422 NO_TASKS`；harness 视为正确拦截并记录。
