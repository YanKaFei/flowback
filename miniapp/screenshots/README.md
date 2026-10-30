# Mobile screenshots

这些截图来自 **Taro H5 预览**（与小程序共用同一套 Taro 页面），用 Puppeteer 在 320 / 375 / 390 / 430px 下渲染。它们用于检查移动端视觉与布局，**不代表微信真机截图**；原生 `weapp` 构建另见 `miniapp/dist/`。

## 导入

| 320 top | 320 bottom | 375 |
| --- | --- | --- |
| ![import 320](mobile-import-320.png) | ![import 320 bottom](mobile-import-320-bottom.png) | ![import 375](mobile-import-375.png) |

| 390 | 430 | 选择截图后 |
| --- | --- | --- |
| ![import 390](mobile-import-390.png) | ![import 430](mobile-import-430.png) | ![import upload](mobile-import-upload-375.png) |

![four images](mobile-import-4images-375.png)

## 审核

| 320 top | 320 bottom | 375 |
| --- | --- | --- |
| ![review 320](mobile-review-320.png) | ![review 320 bottom](mobile-review-320-bottom.png) | ![review 375](mobile-review-375.png) |

| 390 | 430 | 来源与风险展开 |
| --- | --- | --- |
| ![review 390](mobile-review-390.png) | ![review 430](mobile-review-430.png) | ![review expanded](mobile-review-expanded-375.png) |

![review sheet](mobile-review-sheet-375.png)

## 任务

| 320 top | 320 bottom | 375 |
| --- | --- | --- |
| ![tasks 320](mobile-tasks-320.png) | ![tasks 320 bottom](mobile-tasks-320-bottom.png) | ![tasks 375](mobile-tasks-375.png) |

| 390 | 430 |
| --- | --- |
| ![tasks 390](mobile-tasks-390.png) | ![tasks 430](mobile-tasks-430.png) |

| 任务编辑 | 风险详情 | 已解决 / 重开 |
| --- | --- | --- |
| ![task sheet](mobile-task-sheet-375.png) | ![risk sheet](mobile-risk-sheet-375.png) | ![risk reopen](mobile-risk-reopen-375.png) |

项目级风险（非任务关联）同样在任务页内联展示并可打开处理：

![project risk](mobile-project-risk-375.png)

## 真实截图导入闭环

![core image tasks](core-image-tasks-375.png)

![core image tasks done](core-image-tasks-done-375.png)

## 尺寸检查

- 所有页面在 320/375/390/430 下 `scrollWidth === innerWidth`，无横向溢出。
- 320px 下导入、审核、任务内容分别在 Taro 页面容器内纵向滚动；固定底栏保持可见。
- 375/390/430 下当前内容完整呈现在首屏内。
- 320/375/390/430 的主截图均包含底部安全区留白；真机安全区与键盘仍需真机验证。
- 机器可读结果：`viewport-check.json`。


## R3 认证 / 隐私

`r3-import-auth-375.png` 和 `r3-import-upload-auth-375.png` 是加入最小身份与截图隐私提示后的 Taro H5 预览，仍不是微信真机截图。R3 真机状态见 `../../acceptance/R3-WECHAT-DEVICE.md`。
