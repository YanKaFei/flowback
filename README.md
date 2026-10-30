<p align="center">
  <img src="docs/assets/hero.png" alt="FlowBack — From Noise to Action" width="100%" />
</p>

<h1 align="center">FlowBack · 回响</h1>

<p align="center">
  <strong>把一段聊天，变成可审核、可执行、可追溯的任务。</strong><br/>
  <sub>From noise to action — with a human in the loop.</sub>
</p>

<p align="center">
  <img alt="DeepSeek" src="https://img.shields.io/badge/DeepSeek-deepseek--flash-1B1F1C?style=flat-square&labelColor=1B1F1C&color=C9F24E" />
  <img alt="DeepSeek Harness" src="https://img.shields.io/badge/DeepSeek%20Harness-integrated-1B1F1C?style=flat-square&labelColor=1B1F1C&color=C9F24E" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15.5-1B1F1C?style=flat-square&labelColor=1B1F1C&color=F5F1E8" />
  <img alt="Taro" src="https://img.shields.io/badge/Taro-4.3-1B1F1C?style=flat-square&labelColor=1B1F1C&color=F5F1E8" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-78%20passing-1B1F1C?style=flat-square&labelColor=1B1F1C&color=C9F24E" />
  <img alt="WeChat native" src="https://img.shields.io/badge/WeChat%20native-PENDING-1B1F1C?style=flat-square&labelColor=1B1F1C&color=D8642F" />
  <img alt="R4" src="https://img.shields.io/badge/R4-45s%20%2B%2015s-1B1F1C?style=flat-square&labelColor=1B1F1C&color=C9F24E" />
</p>

<p align="center">
  <a href="#中文">中文</a> ·
  <a href="#english">English</a> ·
  <a href="#日本語">日本語</a>
</p>

---

<a id="中文"></a>

## 中文

> **聊天结束的地方，就是工作开始的地方。**
>
> FlowBack 读取聊天文字或聊天截图，抽取任务、负责人、截止时间与逐字引用。AI 的产出先进入审核台，**人确认之后才写入数据库**；系统同时指出责任空缺、时间倒挂、截止日期缺失和未确认的决策。

这不是一个“把聊天总结一下”的 Demo。它是一条完整的、可审计的工作流：

```text
CHAT  →  DRAFT  →  HUMAN REVIEW  →  TASKS  →  STATE
         AI only       you decide      SQLite     refresh-safe
```

### 为什么是 FlowBack

| 普通 AI 摘要 | FlowBack |
|---|---|
| 输出一段看起来合理的文字 | 输出带来源引用的任务对象 |
| 直接覆盖或写入数据 | 只生成候选，确认后才入库 |
| 漏掉“没人负责”这类空白 | 把 owner gap、时间冲突、未确认决策变成可见风险 |
| 刷新即消失的演示状态 | SQLite + task events，刷新后状态仍然存在 |
| 只能在一个页面里看 | Next.js 管理端 + Taro 移动端，共用同一套 API |

### 真实证据，而不是状态文案

| 证据 | 结果 |
|---|---|
| DeepSeek 真实调用 | `deepseek-flash`，思考模式关闭，JSON 输出，服务端 Key |
| R2 真实验收 | 7 / 7 fixtures PASS；任务召回、精确率、F1 **100%**；引用核验 **100%** |
| 回归测试 | **11 个测试文件 / 78 tests** 通过 |
| 移动端真实链路 | 截图导入 → DeepSeek → 审核修改 → 确认 → 任务完成 → 刷新持久化 |
| 微信小程序 | `build:weapp` 构建通过；**原生真机仍 PENDING**（AppID / HTTPS 域名未配置） |
| R4 影像 | 45s 主片 + 15s 纯字体片，均已实际渲染并通过 FFprobe |

> [!IMPORTANT]
> **边界必须说清楚：** 视频和 README 中的移动端画面来自 **Taro H5 预览与真实服务链路**，不是微信原生真机录屏。H5 截图不能替代微信真机证据；R3 的微信体验版仍是 PENDING。

### 产品，四个动作

<table>
<tr>
<td width="25%" valign="top"><strong>01 · IMPORT</strong><br/><sub>把混乱带进来</sub><br/><br/>上传最多 4 张截图，或粘贴聊天文字。截图只用于本次整理，删除项目会一起删除。</td>
<td width="25%" valign="top"><strong>02 · DRAFT</strong><br/><sub>让模型先做脏活</sub><br/><br/>DeepSeek 抽取任务、负责人、日期与原文引用；没有原文依据的字段会被降级或标为待确认。</td>
<td width="25%" valign="top"><strong>03 · REVIEW</strong><br/><sub>人保留最后决定权</sub><br/><br/>逐条修改负责人/日期/状态。时间倒挂、无人负责、未确认决策都在这里出现。</td>
<td width="25%" valign="top"><strong>04 · ACT</strong><br/><sub>确认之后才发生</sub><br/><br/>任务进入 SQLite 看板；勾选完成、解决/重开风险，刷新后状态仍在。</td>
</tr>
</table>

### 界面

<p align="center">
  <em>Taro H5 preview · 390px · 真实截图导入与审核数据</em>
</p>

<table align="center">
<tr>
<td align="center"><img src="docs/assets/app-import.png" width="230" alt="FlowBack import screen"><br/><sub><b>导入</b><br/>截图 / 文字</sub></td>
<td align="center"><img src="docs/assets/app-review.png" width="230" alt="FlowBack review screen"><br/><sub><b>审核</b><br/>任务 · 负责人 · 日期</sub></td>
<td align="center"><img src="docs/assets/app-risk.png" width="230" alt="FlowBack risk and source quote"><br/><sub><b>来源与风险</b><br/>逐字引用 · 时间冲突</sub></td>
<td align="center"><img src="docs/assets/app-tasks.png" width="230" alt="FlowBack tasks screen"><br/><sub><b>任务</b><br/>完成 · 持久化</sub></td>
</tr>
</table>

<p align="center"><sub>H5 preview, not a WeChat-native device capture. 真机验证仍需 AppID 与可信 HTTPS 域名。</sub></p>

### R4 Motion Films

**FlowBack — From Noise to Action** · 45s · 1920×1080 · 30fps · H.264/AAC

[![FlowBack 45s film](docs/assets/main-contact-sheet.jpg)](videos/r4/FlowBack_Demo_45s.mp4)

[▶ 播放 / 下载 45s 主片](videos/r4/FlowBack_Demo_45s.mp4) · [完整制作报告](videos/r4/R4-PRODUCTION-REPORT.md) · [分镜表](videos/r4/storyboard/storyboard.md)

**CHAOS → ORDER** · 15s · 纯字体 / 程序化动态图形 · 1920×1080 · 30fps

[![CHAOS → ORDER](docs/assets/typography-cover.png)](videos/r4/FlowBack_Typography_15s.mp4)

[▶ 播放 / 下载 15s 字体片](videos/r4/FlowBack_Typography_15s.mp4)

两条片子使用同一套视觉系统：暖白、石墨黑、信号绿、少量橙色。45s 主片把真实 H5 流程嵌入手机构图；15s 字体片由 RuiC 程序化渲染，中文品牌字与 `FlowBack` 均为精确字体排版，不依赖视频模型猜字形。

### 架构

```mermaid
flowchart LR
      A["Chat text / screenshots"] --> B["Next.js 15 API"]
      B --> C["DeepSeek deepseek-flash"]
      C --> D["Review draft<br/>tasks · owners · dates · quotes"]
      D -->|human confirm| E[("SQLite<br/>projects · tasks · risks · events")]
      E --> F["Task board / risk view"]
      B --> G["Taro 4 mobile client"]
      G --> H["Import / Review / Tasks"]
```

- **后端**：Next.js 15 App Router + TypeScript strict + Zod + `node:sqlite`。
- **移动端**：Taro 4 + React 18 + TypeScript，底部只有 **导入 / 任务** 两个入口。
- **身份**：Bearer session，数据库只存 SHA-256 hash；项目/来源/任务/风险/截图全部做 owner 校验。
- **安全**：DeepSeek Key 只在服务端；`FLOWBACK_LOCAL_TOKEN` HttpOnly cookie；上传截图访问鉴权；日志脱敏 Bearer / code / openid / 图片 data URL。
- **数据**：`projects / sources / extractions / tasks / risks / task_events / users / sessions`；项目删除级联清理数据库和截图目录。

### 快速开始

```bash
git clone https://github.com/YanKaFei/flowback.git
cd flowback
npm install
cp .env.example .env.local
# 在 .env.local 中填写：
# DEEPSEEK_API_KEY=...
# FLOWBACK_LOCAL_TOKEN=<openssl rand -base64 32>
# FLOWBACK_DEV_AUTH=1   # 仅本机开发
npm run dev
```

打开 <http://127.0.0.1:4317>。

```bash
npm run check      # lint + typecheck + 78 tests + production build
```

没有 `DEEPSEEK_API_KEY` 时，应用进入**明确标记的示例模式**，不会把规则结果伪装成 AI 输出。

### 微信小程序

```bash
cd miniapp
npm install
npm run build:weapp     # 生成 dist/，约 432 KB
npm run dev:h5          # 4318，仅移动端浏览器预览
```

当前状态：

| 项 | 状态 |
|---|---|
| 真实 DeepSeek + H5 闭环 | **PASS** |
| 微信 `build:weapp` | **PASS** |
| 微信原生真机 | **PENDING** — 无 AppID / 可信 HTTPS / request 合法域名 |
| 体验版分享 | **NOT READY** |

外部步骤：配置 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`；部署可信 HTTPS；把域名加入微信 request 合法域名；完成隐私保护指引；微信开发者工具真机验收。

### R4 制作说明

| 层 | 使用 |
|---|---|
| 主剪 / 渲染 | **Huashu Motion 0.3.1**：`runtime/om-engine.js` 视频 seek/extract、`OM.music` / `OM.sfx`、`om sound`、`om render` |
| 程序化字体 | **RuiC Motion**：`mg/core.py` 的 `text` / `text_slices` / `text_outline`、`mg/fonts.fit_size`、`mg/dsp` 合成配乐 |
| 动态排版叙事 | **Huashu Art Motion** 的 `y5_kinetic_type` 语法：`slam / rise / marker`、一拍一焦点、色块章节 |
| 素材 | 真实 H5 录屏 + `acceptance/images/07-chat-conflict.png`；无商业音乐、无 H3 生成素材 |
| 许可证 | 三个 Motion 仓库均为 MIT；字体为 OFL 1.1；详见制作报告 |

### 文档

- [R3 微信真机报告](acceptance/R3-WECHAT-DEVICE.md) — 安全、身份隔离、PENDING 项
- [R2 真实验收](acceptance/REPORT.md) — 7/7 fixtures、引用核验、真实调用
- [R4 制作报告](videos/r4/R4-PRODUCTION-REPORT.md) — 工具、代码、FFprobe、QA
- [移动端验收](acceptance/MOBILE-FINAL.md)
- [小程序说明](miniapp/README.md)

### 一句话

**AI 可以提出任务；只有人可以决定它是否成为工作。**

---

<a id="english"></a>

<details>
<summary><strong>English — FlowBack, from noise to action</strong></summary>

<br/>

**FlowBack** turns chat text or screenshots into **reviewable, executable, traceable tasks**. DeepSeek proposes tasks, owners, dates and verbatim source quotes; a human confirms every change before anything is written to SQLite. FlowBack also surfaces the gaps a summary hides: **owner gaps, date conflicts, missing due dates and unconfirmed decisions**.

### The loop

```text
CHAT  →  AI DRAFT  →  HUMAN REVIEW  →  TASK BOARD  →  SQLITE STATE
```

- **Human-in-the-loop by default** — the model only creates a draft.
- **Source-first** — every task carries its quote; unsupported fields are downgraded.
- **Risk-aware** — owner gaps and conflicting deadlines are first-class objects, not warnings buried in prose.
- **Durable** — task state and task events live in SQLite; refresh does not erase the work.
- **Two clients, one API** — Next.js admin + Taro 4 mobile client.

### Real evidence

| Check | Result |
|---|---|
| DeepSeek | `deepseek-flash`, JSON mode, server-side key |
| R2 real fixtures | **7/7 PASS**, task F1 **100%**, quote verification **100%** |
| Tests | **11 files / 78 tests** passing |
| Mobile flow | real screenshot → DeepSeek → review edit → confirm → complete → refresh |
| WeChat native | **PENDING** — no AppID / trusted HTTPS domain yet |
| R4 films | 45s main + 15s typography, both actually rendered |

> **Evidence boundary:** the mobile footage is a real **Taro H5 preview flow**, not a WeChat-native device recording. H5 is not used as a substitute for device evidence.

### Screens

<p align="center">
  <img src="docs/assets/app-import.png" width="210" alt="Import">
  <img src="docs/assets/app-review.png" width="210" alt="Review">
  <img src="docs/assets/app-risk.png" width="210" alt="Risk and source">
  <img src="docs/assets/app-tasks.png" width="210" alt="Tasks">
</p>

### R4 films

- [FlowBack — From Noise to Action · 45s](videos/r4/FlowBack_Demo_45s.mp4)
- [CHAOS → ORDER · 15s](videos/r4/FlowBack_Typography_15s.mp4)
- [Production report](videos/r4/R4-PRODUCTION-REPORT.md)

Made with **Huashu Motion** (edit/render), **RuiC Motion** (programmatic typography/audio) and the **Huashu Art Motion** kinetic-type grammar. All three are MIT; bundled fonts are OFL 1.1. No commercial music.

### Quick start

```bash
npm install
cp .env.example .env.local
# DEEPSEEK_API_KEY=...
# FLOWBACK_LOCAL_TOKEN=<openssl rand -base64 32>
# FLOWBACK_DEV_AUTH=1   # local only
npm run dev
npm run check           # 78 tests + build
```

### Architecture

```text
Next.js 15 API ── DeepSeek deepseek-flash
      │                   │
      │            review draft (tasks, owners, dates, quotes)
      │                   │
      └──────────── human confirm ────────────┐
                                              ▼
                                       SQLite + task events
                                              │
                                     Taro 4 mobile client
```

### Status

- H5 + real DeepSeek chain: **verified**.
- WeChat native device: **PENDING** — AppID, trusted HTTPS, request domain, privacy guide, DevTools real-device run.
- No silent DB writes; no server secret in the mini program.

</details>

---

<a id="日本語"></a>

<details>
<summary><strong>日本語 — FlowBack（回響）</strong></summary>

<br/>

**FlowBack（回響）** は、チャットの文章やスクリーンショットを **レビュー可能・実行可能・追跡可能なタスク** に変えるワークフローです。DeepSeek がタスク、担当者、期限、原文引用の候補を作り、**人が確認した後だけ** SQLite に書き込みます。

単なる要約ツールではありません。**担当者不在、期限の矛盾、期限未定、未確認の決定** を、要約の文章ではなく独立したリスクとして見せます。

### 4つのステップ

| Step | What happens |
|---|---|
| **Import** | スクリーンショット（最大4枚）またはチャット文を投入 |
| **Draft** | DeepSeek がタスク・担当者・日付・引用を抽出。根拠のない項目は保留/要確認に |
| **Review** | 人が担当者・期限・状態を修正。期限逆転や担当者不在をここで確認 |
| **Act** | 確認後に SQLite のタスクボードへ。完了・リスク解決後も状態が残る |

### 実際の検証

- DeepSeek `deepseek-flash`、JSON モード、サーバー側キーのみ。
- R2 実フィクスチャ **7/7 PASS**、タスク F1 **100%**、引用検証 **100%**。
- **11 テストファイル / 78 tests** 成功。
- モバイルは実際の **Taro H5 プレビュー** で、スクリーンショット → AI → レビュー → 確認 → 完了 → 再読み込みまで確認。
- 微信（WeChat）ネイティブ実機は **PENDING**。AppID、信頼された HTTPS、request 合法ドメインが未設定です。H5 画像を実機証拠の代わりにはしません。

### R4 映像

- [FlowBack — From Noise to Action（45秒）](videos/r4/FlowBack_Demo_45s.mp4)
- [CHAOS → ORDER（15秒・純粋なタイポグラフィ）](videos/r4/FlowBack_Typography_15s.mp4)
- [制作レポート](videos/r4/R4-PRODUCTION-REPORT.md)

Huashu Motion（編集・レンダリング）、RuiC Motion（プログラム的タイポグラフィ・音声）、Huashu Art Motion の kinetic-type 文法を使用。3リポジトリとも MIT、同梱フォントは OFL 1.1。商用音楽は不使用です。

### Architecture

```text
Next.js 15 API → DeepSeek deepseek-flash
      ↓
review draft（タスク / 担当者 / 日付 / 引用）
      ↓ 人の確認
SQLite（projects / tasks / risks / task_events）
      ↓
Taro 4 モバイルクライアント
```

### Status

| Item | Status |
|---|---|
| H5 + DeepSeek 実フロー | **PASS** |
| 微信 `build:weapp` | **PASS** |
| 微信ネイティブ実機 | **PENDING** |
| 体験版共有 | **NOT READY** |

```bash
npm install
cp .env.example .env.local
npm run dev
npm run check
```

> **AI はタスクを提案できる。仕事にするかどうかを決めるのは人。**

</details>

---

## Credits & licences

- **Huashu Motion** — MIT · [github.com/alchaincyf/huashu-motion](https://github.com/alchaincyf/huashu-motion)
- **RuiC Motion** — MIT · [github.com/HRuiCcc/RuiC-motion-reel](https://github.com/HRuiCcc/RuiC-motion-reel)
- **Huashu Art Motion** — MIT · [github.com/alchaincyf/huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion)
- Bundled Latin/CJK fonts — SIL OFL 1.1, as listed in each source tree.
- FlowBack product screenshots and H5 footage are from this project; WeChat-native status is stated above.

<p align="center">
  <sub>Built with <strong>DeepSeek Harness</strong> · deepseek-flash · Next.js · Taro · SQLite</sub><br/>
  <sub>NOISE → STRUCTURE → ACTION</sub>
</p>
