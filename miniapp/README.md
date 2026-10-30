# FlowBack Mini｜微信小程序客户端

这是本轮新增的**独立微信小程序客户端**，使用 **Taro 4.3.1 + React 18 + TypeScript** 构建，面向 375px 左右的手机屏幕。它不是把 Next.js 响应式网页伪装成小程序；Next.js 继续作为唯一服务端与 SQLite 数据层，DeepSeek Key 只在服务端。

## 产品结构

底部只有两个入口：

- **导入**：上传聊天截图 / 粘贴文字 → 开始整理 → 审核确认。
- **任务**：待完成 / 已完成清单，勾选完成、编辑、查看来源。

风险不再是独立导航。风险直接出现在关联任务下方，点击打开详情，可确认知悉、编辑、标记解决；解决后的风险进入“已解决的提醒”，可重新打开。

## 页面

| 文件 | 作用 |
| --- | --- |
| `src/pages/import/index.tsx` | Logo、标题、相册选图、粘贴文字、开始整理、最近项目 |
| `src/pages/review/index.tsx` | 纵向任务列表；默认只显示任务名、负责人、截止；来源/风险展开；点任务打开底部编辑弹层；底部固定确认 |
| `src/pages/tasks/index.tsx` | 待完成 / 已完成清单；勾选完成；任务编辑；来源；风险详情/解决/重开 |
| `src/components/TaskEditor.tsx` | 任务编辑底部弹层，输入时顶部也有“保存”入口 |
| `src/components/RiskSheet.tsx` | 风险编辑、确认知悉、解决、重新打开 |
| `src/components/Sheet.tsx` | 轻量底部弹层，220ms 进入动画 |
| `src/services/api.ts` | 复用现有 `/api/*`，不重复实现 AI |

## 运行与构建

```bash
cd miniapp
npm install
npm run build:weapp     # 输出 dist/，微信小程序构建
npm run dev:weapp       # watch 构建，供微信开发者工具导入
npm run dev:h5          # 仅用于浏览器手机尺寸预览，4318 端口
npm run typecheck
```

构建结果（本机已执行）：

- `npm run build:weapp`：**成功**，`dist/` 约 **432 KB**，生成 `app.json`、3 个页面 WXML/WXSS/JS 与 `assets/` 两个 tab 图标。
- `npm run build:h5`：成功，仅作为视觉预览；H5 预览不能替代小程序真机验证。
- `npm run typecheck`：通过。

## API 地址

`src/services/api.ts`：

- H5 预览：请求 `/api`，由 Taro dev server 代理到 `http://127.0.0.1:4317`。
- 微信开发者工具：默认 `http://127.0.0.1:4317`，需在开发者工具中关闭“合法域名校验”。
- 真机：不能访问 `127.0.0.1`。构建时注入 HTTPS 服务地址：

```bash
TARO_APP_API_BASE=https://api.example.com npm run build:weapp
```

并把这个域名加入微信公众平台 → 开发 → 开发设置 → 服务器域名 → **request 合法域名**。

## R3 身份与隐私

- 所有数据请求带 `Authorization: Bearer <session>`；token 60 秒内自动建立，服务端只存 SHA-256 hash，30 天过期。
- 有 AppID/AppSecret 时：`Taro.login()` → `/api/auth/wechat` → 服务端 `jscode2session` 换 openid → session；**AppSecret 只在服务端**。
- 无 AppID 的 DevTools/H5：仅在 `FLOWBACK_DEV_AUTH=1` 且请求来自本机时使用 `/api/auth/dev`；生产必须设 `FLOWBACK_DEV_AUTH=0`。
- 小程序不直接访问 SQLite，不持有 AppSecret/API Key；所有项目、来源截图、审核、任务、风险均由服务端做 owner 校验。
- 导入页有截图用途说明；微信原生首次上传前弹确认；删除项目会删除任务/风险/审核/截图。
- 后端只绑定 `127.0.0.1:4317`；公网真机必须经过可信 HTTPS 反向代理。

## 微信开发者工具导入

1. 先执行 `npm run build:weapp`。
2. 打开微信开发者工具，导入目录 `miniapp/`（不是 `dist/`；根目录 `project.config.json` 已设置 `miniprogramRoot: "dist/"`）。
3. 当前 `project.config.json` 使用 `touristappid`，仅用于开发构建；没有真实 AppID。
4. 开发阶段可在“详情 → 本地设置”关闭“合法域名校验”，但真机和生产必须使用 HTTPS 合法域名。

## 已完成的验证

- 真实截图导入（`acceptance/images/07-chat-conflict.png`）→ DeepSeek 截图理解 → 3 个任务 / 3 条提醒 → 确认 → 勾选完成 → 刷新保持；项目：`prj_96e4380f524e4ed48b42`。
- 文字草稿 → 4 个任务 → 审核改负责人/日期 → 确认为任务 → 完成 1 个 → 风险解决 → 重开；项目：`prj_b9ac783df8b047528e75`。
- 320 / 375 / 390 / 430px 四档均无横向溢出；320px 下内容在 Taro 页面容器内纵向滚动，底部操作固定。
- 多图（4 张）选择为横向滚动缩略图，页面不溢出；项目级风险在任务页内联显示并可打开。详见 `screenshots/README.md`。
- 原 Next.js：78 个测试通过、typecheck 通过、production build 通过。

## 真机预览 / 发布未完成条件

**当前没有 FlowBack 所属的真实 AppID，也没有可信公网 HTTPS 合法域名，因此没有宣称“已发布微信小程序”，也没有把 H5 截图当成真机截图。R3 状态见 `../acceptance/R3-WECHAT-DEVICE.md`。**

要完成真机预览/发布，还需要：

1. 微信公众平台小程序 AppID，替换 `project.config.json` 的 `appid`。
2. 把 Next.js 服务部署到 HTTPS 域名，并把域名加入 request 合法域名。
3. 相册/隐私接口的小程序隐私保护指引与用户授权说明。
4. 在微信开发者工具“真机调试/预览”扫码验证：
   - 320/375/390/430 真机宽度；
   - 底部安全区；
   - 键盘弹起时任务弹层顶部“保存”可见；
   - 相册选择、上传、确认、刷新持久化。
5. 小程序类目、主体资质、版本审核后才能发布。

## 限制

- 不读取微信群聊；截图必须由用户主动从相册选择。
- DeepSeek Key 不下发；小程序只调用现有服务端 API。
- 当前 H5 预览截图不是微信原生运行截图；原生构建通过不等于真机通过。
