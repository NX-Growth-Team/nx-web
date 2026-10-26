# Nx Web

按 Nx Figma 设计稿制作的独立前端项目。使用原生 HTML、CSS、JavaScript，无第三方运行时依赖，无构建步骤。代码可直接交给乙方接入自己的后端与部署环境。

## 本地预览

安装 Node.js 20 或以上版本后，在本目录执行：

```sh
npm run dev
```

打开 `http://127.0.0.1:4173/`。也可使用任意静态服务器，将根目录设为 `dist/`。不要直接双击 HTML，因为浏览器会限制本地文件的 JavaScript 模块。

## 页面

- `/`：Home，Dashboard 建设中弹窗、Demo 入口和用户提供的绿色图片。
- `/contact/`：预约演示留资表单，两列桌面布局、单列手机布局。
- `/privacy-policy/`：Privacy Policy，占位正文沿用 Figma，已删除原稿多余勾选框与 Submit。

`dist/` 同时是可修改的前端源文件和静态交付目录。没有生成文件覆盖源文件的问题。链接采用相对路径，支持主域名或子目录部署；API 默认路径独立配置。

## 后端接入

1. 将 `dist/` 作为静态站点根目录部署，无需编译。
2. 在 `dist/assets/js/config.js` 设置实际表单接口地址。
3. 按下方接口文档接收 JSON 并返回明确的成功响应。正式上线前替换隐私政策占位正文。

在 `dist/assets/js/config.js` 配置 `demoEndpoint`，默认 `POST /api/demo-requests`。该项目不提供、模拟或存储后端表单数据。只有收到 `{ "success": true }` 的 JSON 响应才显示提交成功。

详细字段、响应、幂等与跨域约定见 [后端接口说明](docs/backend-integration.md)。请求处理中防止重复提交；超时或网络异常可重试。隐私链接打开新标签页，原表单内容保留在当前页，不写入浏览器持久存储。

必填项有效、来源已选择、同意已勾选时即发起请求，不按公司类型、邮箱域名或资料内容筛选。当前本地预览返回 `backend_not_connected` 时，页面显示中性提示“表单完整，但预览尚未启用提交”，不显示成功、不认为用户资料错误。真实后端接入后，只有后端确认接收才显示成功。

## 字段规则

- First Name、Last Name、Title、Company Name、Company Website、Email Address、来源下拉与同意勾选为必填。
- Phone Number 选填，不填写时发送 `null`；可填写带分机号等格式，不做额外的号码格式拦截。
- Company Website 支持直接填写 `company.com`，发送前补齐 `https://`。
- 来源值：`search_engine`、`social_media`、`referral`、`event`、`other`。

## 页面适配

- 首页桌面比例约 3:1，右侧展示用户最新提供的静态图片，使用 `object-fit: cover` 自适应裁切，保留原始色彩与清晰度。
- 760px 以下首页转为单列，绿色图片成为内容下方横幅；600px 以下表单转为单列；420px 以下首页按钮纵向排列。
- 下拉选择采用与表单同字体、细边框和圆角的菜单，支持键盘、鼠标与触控；底层 native select 仍保存提交值。
- 短屏自然滚动，不固定正文高度；移动端输入文字为 16px，避免 iOS 输入时自动放大。
- 首页同步窗口与可视区域的高度变化，上下留白随高度平滑缩小；连续缩放窗口无需刷新，内容超出极短窗口时可正常滚动。
- Demo 表单页与 Privacy Policy 页的 Logo 固定在顶部，滚动时可随时点击返回首页；手机端已预留顶部空间。

## 资源与检查

首页使用用户最新提供的绿色图片。原始 PNG 附件（4104 × 4104，约 19 MB）仅在本机 `assets-source/` 保留，供日后重新转码，已被 `.gitignore` 排除、不随仓库分发；页面实际加载 `dist/assets/home-green-selected.webp`（q92 转码，约 1.4 MB，PSNR 48.3 dB 视觉无损），避免首页被 19 MB 的 PNG 拖慢。Logo 与版权图标来自 Figma 原始素材。

仓库分发 `dist/`（前端源即交付目录）、`server/`、`docs/` 与检查脚本。`node_modules/`、数据库文件（如 `leads.db`）、日志与真实 `.env` 配置由 `.gitignore` 排除，`server/nx-api.env.example` 作为配置模板保留；部署前按该模板在本机或服务器生成真实配置，不要提交。


Roboto Slab 字体已本地保存，许可文件位于 `dist/assets/fonts/LICENSE.txt`。页面不依赖 Google Fonts 或临时 Figma URL。

```sh
npm run check
npm test
```

Privacy Policy 已于 2026-10-05 换成批准的 NX 正式政策（含 PIPL、CASL 与分地区权利说明），占位阶段的 `noindex` 已移除。当前勾选框按“除电话以外必填”的要求处理，如需更改，修改表单与校验模块中的同意规则。

前端交付包包含当前使用的页面、图片字体、预览与检查脚本，以及后端接口说明。历史图片、素材处理记录与检查截图不纳入交付包。

浏览器支持 WebMCP 时，可用 `stage_demo_request_draft` 填写草稿。此工具不提交请求、不代替用户勾选同意；不支持该 API 的浏览器不受影响。已在支持的预览上下文验证工具注册、草稿回填与非法选项拒绝。
