# FlowBack Mini｜R3 WeChat Device Ready

日期：2026-10-30  
结论：**开发环境安全底座完成；微信真机与真实 AI in WeChat 仍为 PENDING。**

## 最终状态

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 真实微信 AppID | **未配置** | `miniapp/project.config.json` 仍是 `touristappid`；没有 FlowBack 所属的 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`。本机开发者工具历史里有其他小程序的 AppID，但无法确认归属，未复用。 |
| HTTPS 接口 | **本地 TLS 已通 / 微信合法域名 PENDING** | 本机 `https://127.0.0.1:8443` 自签 TLS 反向代理验证通过；没有可信公网证书、没有微信 request 合法域名。未把本地服务公开暴露。 |
| 用户身份隔离 | **PASS** | Bearer session + local-only admin cookie；`owner_id` 归属；项目/来源/审核/任务/风险/图片全部校验；14 项新增安全测试。 |
| 真机是否成功运行 | **PENDING** | 无 AppID、无 HTTPS 合法域名；微信开发者工具 CLI 在该沙箱环境无法初始化 `.cli`；未用 H5 截图冒充真机证据。 |
| 真实 AI 在微信内调用 | **PENDING** | 真实 AI 已在 Taro H5 预览 + 现有服务端跑通（3 任务/3 提醒），但未在微信原生环境验证。 |
| 体验版分享条件 | **不具备** | 需 AppID、HTTPS 域名、隐私保护指引、真机通过、版本审核。 |
| 本地 Web 管理端 | **仅本机** | 服务绑定 `127.0.0.1:4317`；外部 Host 页面 404；API 未登录 401。 |

---

## 1. 微信运行环境修复（未改 UI）

- 服务器仍为唯一后端；小程序只调用 `/api/*`，不重复实现 DeepSeek。
- 认证后的 `Taro.request` 统一带 `Authorization: Bearer`；401 自动清 session 并重登一次。
- `Taro.login()` → 服务端 `jscode2session` 换取 openid → 服务端 session；**AppSecret 只在服务端**。
- 无 AppID 的 DevTools/H5：`/api/auth/dev` 仅本机 + `FLOWBACK_DEV_AUTH=1` 时可用；生产必须关闭。
- 原生兼容：
  - 底部弹层 `ScrollView` 固定 58vh 高，微信原生可滚动；
  - 安全区 `env(safe-area-inset-bottom)`；自定义导航预留胶囊高度；
  - 键盘弹起时弹层顶部有“保存”；
  - 图片通过 `Taro.chooseImage` + `compressImage` + base64 `Taro.request` 上传，不使用 `uploadFile`；客户端限制单张 5MB、总计 6MB；
  - 删除项目后清理 source 上传目录；
  - 导入页增加截图隐私告知与首次上传确认（H5 预览保留文字告知，跳过浏览器模态框以保留文件选择手势）。
  - 审核页编辑任务会立即 PATCH 草稿；返回后再进入同一 extraction，草稿字段保留。
  - 网络超时：客户端 `Taro.request` 60s，服务端 DeepSeek 45s；错误进入页面错误态，不静默成功。
- 客户端保持双 tab：**导入 / 任务**；无新增主页面、看板或复杂动效。

## 2. 服务端身份 / 归属 / 删除

新增：

- `users`、`sessions`（token 只存 SHA-256 hash，30 天过期）；
- `projects.owner_id` 幂等迁移；现有 6 个项目归 `usr_local_admin`，未重置/删除；
- `src/lib/auth.ts`：Bearer session、local cookie、local-only dev auth、微信登录配置；
- `src/middleware.ts`：本机 admin cookie；外部页面 404；API 不受页面拦截；
- 所有数据 API 要求身份：projects、analyze、extractions、confirm、tasks、risks、source image；
- `DELETE /api/projects/:id`：校验归属，级联删除项目/任务/风险/审核/来源，并删除 `data/uploads/<sourceId>`；
- 图片读取仍做路径穿越检查，并加归属校验；`Cache-Control: private`；
- `safeError` / `redactForLog`：日志脱敏 key、Bearer、图片 data URL、code/openid。

本机 Web 管理端：`FLOWBACK_LOCAL_TOKEN` → HttpOnly cookie，仅 `127.0.0.1/localhost` 页面注入；服务器绑定 `127.0.0.1:4317`，不再监听所有网卡。

## 3. 验证结果

### 回归与安全测试

```text
npm run check   PASS
lint            PASS
typecheck       PASS
test            11 files / 78 tests PASS
next build      PASS (Middleware 34.4 kB)
```

新增 14 项：
- `tests/auth.test.ts`：hash session、Bearer、local cookie、跨用户读取、跨用户修改/删除、迁移归属；
- `tests/route-auth.test.ts`：匿名 401、只返回自己项目、跨用户项目/图片 404、仅 owner 删除；
- `tests/wechat-auth.test.ts`：mock `jscode2session`、不返回 openid/session_key、未配置 fail closed；
- `tests/delete-upload.test.ts`：删除 owner 项目会删上传目录，其他 owner 文件保留；
- `tests/security.test.ts`：日志脱敏。

### HTTP / 身份边界

```text
匿名 GET /api/projects                 401
本机页面 + cookie GET /api/projects    200，仅本机 6 个项目
本机 admin 读取 dev 用户项目           404
外部 Host 访问页面                     404
外部 Host /api/auth/dev                403
图片无鉴权                              401
图片 cookie 鉴权                        200 image/png
```

### 本地 HTTPS

`scripts/https-test-proxy.mjs` + 自签证书，仅绑定 `127.0.0.1:8443`，未公网暴露：

```text
https://127.0.0.1:8443/api/health           200
https://127.0.0.1:8443/api/projects         401 (anonymous)
本地页面 cookie → /api/projects             200
外部 Host 页面                               404
外部 Host /api/auth/dev                      403
```

生成/启动本机 TLS 测试代理：

```bash
mkdir -p .local-tls
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout .local-tls/key.pem -out .local-tls/cert.pem -days 7 \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
node scripts/https-test-proxy.mjs   # 仅 127.0.0.1:8443
```

该证书是自签的，**微信不会信任**；仅证明本地 TLS 反向代理链路，不等于微信合法域名连通。代理只绑定 `127.0.0.1`，测试结束后已停止，没有公网暴露。

### 真实 AI（H5 预览，不是微信原生）

认证后的 Taro H5 预览完成一次真实截图链路：

- 项目：`prj_4bcba6c8960f4870aad1`「对话整理 10-30」，owner 为开发设备用户；
- 真实截图 `acceptance/images/07-chat-conflict.png` → 3 任务 / 3 提醒；
- 确认 → 勾选 1 个完成 → 刷新保持 1/3；
- 该证据只证明 Taro 客户端 + 服务端链路，**不证明微信内已运行**。
- H5 认证/隐私截图：`miniapp/screenshots/r3-import-auth-375.png`、`r3-import-upload-auth-375.png`；它们是 H5 预览，不是真机证据。

### 审核草稿 / 返回 / 删除

- H5 认证会话内：编辑任务标题为「草稿保留验证」→ 保存 → 返回导入页 → 重新打开同一 extraction，字段仍在。
- 该测试项目随后通过 `DELETE /api/projects/:id` 删除，返回 200，未留下测试项目。
- 任务勾选完成 → 刷新保持 1/3（见真实 AI 链路）。
- 删除项目按钮 → 确认弹层 → 删除成功并回到导入页；截图目录同步清理（单元测试覆盖）。

### 微信开发者工具

- 已安装 `/Applications/wechatwebdevtools.app`。
- 尝试 CLI `open --project miniapp --port 9420`：在沙箱 HOME 下初始化失败（缺少 `.cli` 配置），没有真实 AppID/登录；因此未完成 DevTools 原生编译/预览。未把 Taro 编译结果冒充 DevTools 验证。
- Taro `build:weapp` 成功：`dist/` 约 **432 KB**，包含 `app.json`、3 页 WXML/WXSS/JS、tab 图标；这不替代 DevTools/真机证据。

## 4. 外部步骤（必须由项目所有者完成）

1. **AppID**：微信公众平台创建/提供 FlowBack 小程序 AppID。
2. **AppSecret**：只写入服务端 `.env.local` 或部署环境变量 `WECHAT_APP_SECRET`；绝不进入 `miniapp/src`。
3. **HTTPS**：部署可信证书（TLS 1.2+，443，非 IP/localhost），反向代理只暴露 `/api/*`；加入微信公众平台 → 开发 → 开发设置 → **request 合法域名**。
   - 当前客户端通过 `wx.request` 发送 base64 图片，不使用 `wx.uploadFile`，因此不需要 uploadFile 域名；若改为 uploadFile，需同时配置 uploadFile 合法域名。
4. **构建**：
   ```bash
   cd miniapp
   TARO_APP_API_BASE=https://your-domain.example npm run build:weapp
   ```
   替换 `project.config.json` 的 `appid`，在微信开发者工具导入 `miniapp/`（`miniprogramRoot` 已指向 `dist/`）。
5. **服务端环境**：
   ```dotenv
   WECHAT_APP_ID=wx...
   WECHAT_APP_SECRET=...
   FLOWBACK_DEV_AUTH=0
   FLOWBACK_LOCAL_TOKEN=<随机 32 字节>
   ```
   部署后重启；本地 admin cookie 只用于本机 Web。
6. **隐私**：小程序隐私保护指引、相册/图片用途说明、用户协议；删除项目会删除截图。
7. **真机验收**：微信开发者工具预览/真机调试，测试 320/375/390/430、安全区、键盘、相册、审核、确认、刷新、风险解决/重开、删除项目。
8. **发布**：类目/主体资质、版本审核后，才具备体验版分享/发布条件。

## 5. 残余风险

- 没有接入微信登录前，开发身份只在本机启用；生产未配置 `WECHAT_APP_ID/SECRET` 时小程序会明确报错，不会匿名访问数据。
- 没有做 API 限流/验证码；上线前建议在 HTTPS 网关增加限流。
- 截图文件在本地磁盘明文保存；删除项目会删除文件，但未做静态加密。
- 本地 Web 管理端仍是单管理员模型；不是多用户后台。
- H5 预览截图/Playwright 结果不能替代微信真机。
