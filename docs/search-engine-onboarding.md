# 搜索引擎收录引导（2026-10-07）

站点技术 SEO 已就位（robots.txt / sitemap.xml / canonical / OG / JSON-LD），
但搜索引擎尚无任何收录。本文记录主动提交流程与当前状态。

## 已完成：IndexNow（自动，无需再操作）

- 密钥：`4e7babb82ba0fd86f9dc9c0c29a0d340`
- 密钥文件：站点根 `/4e7babb82ba0fd86f9dc9c0c29a0d340.txt`（内容即密钥，
  **必须持续可访问**，已入库 `dist/`，随部署常驻）
- 2026-10-07 已推送 3 条 URL（`/`、`/contact/`、`/privacy-policy/`）到
  `api.indexnow.org`，返回 202。
- IndexNow 是 Bing / Yandex / Naver / Seznam 共享协议；**Bing 的索引同时
  供给 ChatGPT 搜索**。

日后新增页面时的推送命令（URL 加进 sitemap.xml 后），用 curl 直接 POST，
不需要额外脚本：

```bash
curl -s -X POST https://api.indexnow.org/indexnow \
  -H 'Content-Type: application/json' \
  -d '{
    "host": "www.nxgrowth.ai",
    "key": "4e7babb82ba0fd86f9dc9c0c29a0d340",
    "keyLocation": "https://www.nxgrowth.ai/4e7babb82ba0fd86f9dc9c0c29a0d340.txt",
    "urlList": [
      "https://www.nxgrowth.ai/",
      "https://www.nxgrowth.ai/contact/",
      "https://www.nxgrowth.ai/privacy-policy/"
    ]
  }'
```

返回 200 或 202 即提交成功。

## 待办：Google Search Console（需账号操作）

Google 不支持 IndexNow，必须走站长平台。

1. 打开 https://search.google.com/search-console ，用 Google 账号登录。
2. 添加资源，二选一：
   - **推荐：网域（Domain）属性**，填 `nxgrowth.ai`，用 DNS TXT 记录验证
     （域名 DNS 面板加一条 TXT，不动站点文件）。
   - 备选：网址前缀 `https://www.nxgrowth.ai/`，选「HTML 文件」验证，
     把下载到的 `googleXXXXXXXX.html` 交给部署方放进 `dist/`
     部署即可。
3. 验证通过后，在「站点地图」提交：`https://www.nxgrowth.ai/sitemap.xml`。

4. **请求编入索引（缩短等待的关键一步）**：GSC 的这个功能没有公开 API。
   Google Indexing API 只对 JobPosting 与 BroadcastEvent 两类富媒体开放，
   提交普通网页会被拒绝；URL Inspection API 是只读诊断接口，同样请求不了
   索引。所以只能走后台界面，三步：

   1. 打开 https://search.google.com/search-console ，左上角属性选择器
      切到 nxgrowth.ai。
   2. 用**顶部的白色输入框**（提示语是 Inspect any URL in nxgrowth.ai），
      粘贴页面完整 URL 后回车，例如 `https://www.nxgrowth.ai/contact/`。
      左侧导航里的「网址检查」入口等价。
   3. 实时检测跑完后点「请求编入索引」。三个页面各一次，每页十秒。

   **踩过的坑**：不要试图手拼 inspect 的直达链接。那个链接里的 `id`
   参数是 Google 给 URL 生成的内部标识（形如 `odaUL5Dqq3q8n0EicQzawg`），
   必须跑过一次检查才能得到，填 URL 本身会返回 404。
   （坑来源：2026-10-07 第一次在这个站上试的时候踩过。）

最后顺手在左侧「站点地图」确认一下 `sitemap.xml` 的状态是「成功」，
这是 Google 发现其余 URL 的主渠道。

## 待办：Bing 站长工具（需账号操作）

1. 打开 https://www.bing.com/webmasters ，登录（支持从 GSC 一键导入站点，
   若已做 GSC 推荐直接导入）。
2. 手动验证的话选「XML 文件」方式，把 `BingSiteAuth.xml` 交给部署方放进
   `dist/` 部署。
3. 提交站点地图：`https://www.nxgrowth.ai/sitemap.xml`。
   IndexNow 通道已打通（上方密钥），站长工具主要用来查看收录报表与
   关键词数据。

## 暂不做：百度

站点为纯英文 B2B 受众，百度优先级最低。需要时再走
https://ziyuan.baidu.com 的链接提交。

## 背景事实（2026-10-07）

- `site:nxgrowth.ai` 搜索结果为零，品牌词 "governed AI growth team"
  也搜不到官网。
- 近似域名 nexgrowth.ai、nexusgrowth.ai 已占住相关搜索结果；
  "Nx" 一词被 nx.dev 等成熟产品占据，品牌词竞争激烈。

## 2026-10-07 夜间核查结果

- Google 的 DNS 验证已生效：`nxgrowth.ai` 的 TXT 记录为
  `google-site-verification=cQvbalHhYFofZtPztz4xBGcPh6LmlfQAUdeTIaTz0Js`。
- 服务器访问日志出现 bingbot 两次：北京时间 15:55 取密钥文件验证所有权
  （IndexNow 推送触发的实时回访），23:32 抓取首页与 robots.txt。
  IndexNow 通道确认生效。
- 同一份日志里**没有 Googlebot 记录**。DNS 验证刚生效几小时，Google
  首次抓取通常要一到七天。想加速就在 GSC 后台用「网址检查」手动请求
  编入索引。
- 站点侧全部正常：robots.txt、sitemap.xml、密钥文件均 200 且内容正确；
  HTTP 全部 301 到 HTTPS。**校验陷阱**：本机有代理，curl 不带
  `--noproxy '*'` 时对 HTTP 会看到假 403。
- TLS 证书 CN=nxgrowth.ai，有效期 2026-10-06 至 2027-01-04，certbot 管理的
  90 天证书，留意自动续期。
- 待定改进已处理（2026-10-19）：裸域原先返回 200，现在 nginx 增加裸域 443
  server 块，`https://nxgrowth.ai/` 与所有路径 301 到 `https://www.nxgrowth.ai/`
  同路径；HTTP 80 的裸域跳转也直接指向 www。规范域名统一为 www。
  配置备份在服务器 `/root/nginx-backups/nx-demo.pre-www-20261019.conf`。
- Bing 侧没有 BingSiteAuth.xml，页面里也没有 msvalidate meta，
  说明是从 GSC 导入的站点属性（Bing 支持并复用 Google 的 DNS 验证）。

## 2026-10-19 域名规范化核查

- robots.txt、sitemap.xml、canonical、og:url 与 JSON-LD 的 url 全部已是
  `https://www.nxgrowth.ai`，线上返回与仓库 `dist/` 一致，无需修改。
- nginx 新增裸域 443 server 块并热加载；`nginx -t` 通过。
- 实测结果：`http://nxgrowth.ai/`、`https://nxgrowth.ai/`、
  `https://nxgrowth.ai/platform/telemetry/` 均 301 到 www 同路径；
  www 主页与 `/platform/telemetry/`、`assets/og-image.png`、
  IndexNow 密钥、robots、sitemap 全部 200。
- 校验提醒：本机存在 IPv6 空路由，`curl` 默认先试 AAAA 会超时，必须加 `-4`
  或 `--resolve`，否则会把正常站点误判为不可达。
