# FlowBack 产品演示视频

## 文件

- 成片：`demo/FlowBack-Product-Demo.mp4`
- 封面：`demo/FlowBack-Product-Demo-Cover.png`
- 字幕：`demo/FlowBack-Product-Demo.srt`
- 规格：**1920×1080 / 30fps / H.264 / AAC 48kHz 立体声 / 52.4 秒 / 约 6.8 MB**

## 内容

这不是 PPT 或截图拼接：录制自真实运行的 FlowBack 生产构建，包含一次**真实 DeepSeek 截图调用**：

1. 首页上传合成聊天截图 `acceptance/images/07-chat-conflict.png`，填写项目名。
2. DeepSeek Vision 真实抽取任务、负责人、截止时间与原文引用。
3. 审核台把“联系场地”负责人补为陈默、截止改为 2026-11-02；草稿自动保存。
4. 确认入库，进入看板；把最终稿改为“进行中”。
5. 风险中心打开 due_conflict，查看原文并标记解决。
6. 解决后仍保留原文与处理记录。

录制产生的真实项目：`prj_8e6c527e7c554101805a`（`FlowBack 视频演示`）。

> 视频不含 API Key、账号凭据或真实客户数据；截图是项目内合成的测试聊天。

## 时间线

| 时间 | 画面 | 旁白 / 字幕 |
| --- | --- | --- |
| 0:00–0:05 | 品牌片头 | 聊天里的决定，常常停在聊天里。FlowBack，让每句话都有着落。 |
| 0:05–0:13 | 首页上传截图 | 上传聊天截图，或直接粘贴文字。AI 只产出候选，不直接改看板。 |
| 0:13–0:19 | DeepSeek 读取中 | DeepSeek 正在读取截图。 |
| 0:19–0:25 | 审核台 | 每个任务都能回到原句；风险被单独标出。 |
| 0:25–0:29 | 人工修改 | 补上负责人和日期；确认之前不写看板。 |
| 0:29–0:39 | 看板 / 状态 | 确认之后任务才进入看板；状态变化留痕。 |
| 0:39–0:45 | 风险中心 | 风险保留原文和处理记录。 |
| 0:45–0:52 | 片尾 | 刷新之后状态仍在。真实 AI，真实持久化。 |

## 真实 AI 数据

来源：`acceptance/REPORT.md`

- 7 组夹具（5 文字 + 2 PNG）：**7/7 PASS**
- 任务 F1：**100%**
- 风险召回：**100%**
- 引用核验：**100%**（21/21）
- 7 次真实调用：**17,304 tokens**，平均 **2.7s**

## 重新录制

依赖：Chrome、`puppeteer-core`、ffmpeg（含 libx264）、macOS `say` 中文语音、运行中的 FlowBack（4317）。

```bash
npm install --no-save puppeteer-core
node demo/record-demo.mjs
```

片头/片尾 HTML 在 `demo/html/`，PNG 在 `demo/assets/`。录制脚本会生成 `demo/frames/` 与 `demo/recording.json`；成片结构为 5s 片头 + 40.4s 实录 + 7s 片尾，30fps 输出。旁白由 macOS `say -v Tingting` 生成，使用 `demo/FlowBack-Product-Demo.srt` 作为字幕。
