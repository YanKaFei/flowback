> R3 已加入身份隔离、归属校验与删除机制；当前测试为 78 项。本文件保留 R2 移动端验收快照。

# FlowBack Mini｜移动端 / 微信小程序验收

日期：2026-10-30  
状态：**移动端 UI + 核心闭环已通过；微信小程序开发构建通过；真机预览/发布未完成（无 AppID、无 HTTPS 合法域名）。**

---

## 1. 全部移动端新版页面

独立 Taro 4.3.1 + React 小程序客户端：`miniapp/`

| 页面 | 路径 | 说明 |
| --- | --- | --- |
| 导入 | `src/pages/import/index.tsx` | Logo、标题、截图上传、开始整理、粘贴文字、最近项目 |
| 审核 | `src/pages/review/index.tsx` | 纵向任务列表；默认任务名/负责人/截止；来源与风险展开；底部弹层编辑；固定确认 |
| 任务 | `src/pages/tasks/index.tsx` | 待完成 / 已完成；勾选完成；编辑；来源；风险详情；已解决提醒可重开 |

底部只有“导入 / 任务”两个 tab；风险中心不再作为主导航。任务和风险数据仍由现有 Next.js + SQLite + `/api/*` 提供，DeepSeek 推理服务没有重复实现。

### 移动端交互

- 截图必须由用户点击上传后从相册主动选择；不读取微信群聊。
- 审核任务默认只展示名称、负责人、截止；点击任务打开底部编辑弹层；来源/风险可展开。
- 任务页支持勾选完成、修改任务、查看来源；风险提示直接显示在关联任务下。
- 风险详情支持确认知悉、编辑说明、标记解决；已解决提醒可重新打开。
- 弹层顶部保留“保存”入口，键盘弹起时仍可触达；底部固定操作使用 safe-area padding。
- 动画仅点击反馈、页面轻入、列表展开、完成微动效、AI loading；CSS 160–220ms，未引入大型动效库。

---

## 2. 手机尺寸界面截图

目录：`miniapp/screenshots/`，说明：`miniapp/screenshots/README.md`

- 导入：320/375/390/430，320 top/bottom，选图后。
- 审核：320/375/390/430，320 top/bottom，来源展开，任务编辑弹层。
- 任务：320/375/390/430，320 top/bottom，任务编辑，风险详情，已解决/重开。
- 真实截图导入闭环：`core-image-tasks-375.png`、`core-image-tasks-done-375.png`。

**截图口径**：这些是 Taro H5 预览截图（同一套 Taro 页面），不是微信原生真机截图。原生 `weapp` 构建已通过，但真机截图需 AppID 与 HTTPS 域名。

尺寸检查（Puppeteer 2x）：
- 320/375/390/430 全部 `scrollWidth === innerWidth`，无横向溢出。
- 320px 下内容在 Taro 页面容器纵向滚动；固定底栏保持可见。
- 长任务标题在 320px 正确换行。
- 多图选择最多 4 张，横向滚动缩略图；375px 下内层滚动宽度 344px / 可视 335px，页面 `scrollWidth` 仍为 375。
- 项目级 `decision_unconfirmed` 风险在任务页以“项目提醒”内联展示，点击可打开风险详情并处理。

---

## 3. 原有功能回归测试

在 `flowback/`：

```text
npm test          64 passed / 7 files
npm run typecheck passed
npm run build     passed
```

- 未重置数据库；原有项目与测试数据保留。
- 本轮新增真实项目：
  - `prj_96e4380f524e4ed48b42`「对话整理 10-30」：真实截图导入 → 3 任务 / 3 提醒 → 确认 → 完成 1 → 刷新保持。
  - `prj_b9ac783df8b047528e75`「活动执行」：文字导入 → 4 任务 → 审核改负责人/日期 → 确认 → 完成 1 → 风险解决/重开。
- 微信小程序仅调用现有 API；未新增独立 AI 推理。
- 小程序代码中无 API Key；Key 只在服务端 `.env.local`。

### 真实截图闭环

`prj_96e4380f524e4ed48b42`：
- 从相册主动选择 `acceptance/images/07-chat-conflict.png`；
- 真实 DeepSeek 返回 3 任务 / 3 提醒，审核页标记“真实 AI”；
- 确认后 3 个任务进入清单；
- 勾选第 1 个任务完成，刷新后仍为 1/3 已完成。

---

## 4. 微信小程序项目与构建结果

```bash
cd miniapp
npm run build:weapp
```

结果：
- `dist/`，约 **432 KB**
- `dist/app.json`：3 个页面 + 两个 tab（导入 / 任务），图标在 `dist/assets/`
- `dist/pages/import|review|tasks/index.wxml/.wxss/.js`
- `project.config.json`：`miniprogramRoot: "dist/"`，`appid: "touristappid"`（开发用）
- `npm run build:h5` 也通过，仅作移动端预览

微信开发者工具导入 `miniapp/` 根目录；开发阶段可关闭合法域名校验。当前**没有真实 AppID**，所以不宣称已发布或已完成微信真机验证。

---

## 5. 真机预览步骤与未完成发布条件

### 真机预览步骤

1. 申请微信小程序 AppID，替换 `miniapp/project.config.json` 的 `appid`。
2. 把 Next.js 服务部署到 HTTPS 域名；配置 `TARO_APP_API_BASE=https://...` 后重新 `npm run build:weapp`。
3. 微信公众平台 → 开发 → 开发设置 → 服务器域名 → **request 合法域名** 添加该 HTTPS 域名。
4. 微信开发者工具导入 `miniapp/`，构建后“预览/真机调试”，扫码。
5. 真机检查：相册选择、上传、AI 整理、审核弹层键盘、底部确认 safe area、任务完成、刷新持久化、风险解决/重开。

### 发布前未完成条件

- [ ] 真实 AppID（当前 `touristappid`）
- [ ] HTTPS 合法域名（当前默认 `127.0.0.1`，真机不可用）
- [ ] 小程序隐私保护指引（相册/图片）
- [ ] 真机 320/375/390/430 验证（H5 预览不能替代）
- [ ] 小程序类目、主体资质、版本审核

---

## 结论

**核心验收标准已满足（开发环境）**：用户可在移动端用“选截图 → 整理 → 确认 → 任务完成”完成一次闭环；微信小程序 `weapp` 构建通过。  
**发布状态：未发布**。在 AppID、HTTPS 合法域名和真机验证完成前，不把 H5 预览或 Taro 构建结果称为“已上线的微信小程序”。
