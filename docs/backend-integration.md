# Demo 表单后端接口约定

## 配置与请求

前端配置：`dist/assets/js/config.js`。

```js
export const config = Object.freeze({
  demoEndpoint: '/api/demo-requests',
  requestTimeoutMs: 15000,
  credentials: 'same-origin',
});
```

```http
POST /api/demo-requests
Content-Type: application/json
Accept: application/json
Idempotency-Key: <request UUID>
```

```json
{
  "firstName": "Alex",
  "lastName": "Chen",
  "title": "Growth Lead",
  "companyName": "Example Inc.",
  "companyWebsite": "https://example.com/",
  "phoneNumber": null,
  "email": "alex@example.com",
  "referralSource": "referral",
  "communicationConsent": true,
  "privacyPolicyAccepted": true,
  "source": "nx-web"
}
```

所有文本在前端去除首尾空格。未填电话为 `null`；网站网址补齐协议并按 URL 规则标准化。`communicationConsent` 为页面勾选值；`privacyPolicyAccepted` 表示提交时接受当前页展示的隐私条款。正式条款或勾选规则改变时，需同步前后端约定。

必填项通过基础格式校验、来源已选择并勾选同意后，前端即发起请求，不按公司类型或邮箱域名筛选。电话不做额外格式限制，可包含国际区号、括号及分机号。

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| firstName / lastName | string | 必填，最多 100 字符 |
| title | string | 必填，最多 150 字符 |
| companyName | string | 必填，最多 200 字符 |
| companyWebsite | string | 必填，http/https，最多 500 字符 |
| phoneNumber | string / null | 选填，最多 40 字符 |
| email | string | 必填，最多 254 字符 |
| referralSource | string | 必填，限定枚举 |
| communicationConsent | boolean | 当前必须为 true |
| privacyPolicyAccepted | boolean | 当前必须为 true |
| source | string | 固定 nx-web |

来源枚举：`search_engine`（搜索引擎）、`social_media`（社交媒体）、`referral`（朋友或同事推荐）、`event`（活动或会议）、`other`（其他）。

## 响应

成功：HTTP 200、201 或 202，并返回 JSON，`success` 必须为 `true`。前端可接受附加字段。

```json
{ "success": true, "requestId": "demo_123" }
```

字段校验失败：HTTP 422，字段名须与请求一致。前端只展示自己的通用错误文案，不直接插入后端返回的文本。

```json
{
  "success": false,
  "fieldErrors": {
    "email": "Please use a valid email address.",
    "companyWebsite": "Invalid website."
  }
}
```

限流：HTTP 429；其他失败：4xx/5xx。失败、无效响应、15 秒超时均保留用户输入，可重试。HTTP 204 或 HTML 返回不会被识别为成功，避免静态托管回退页面产生假成功。

项目自带的本地预览服务尚未连接后端，POST 返回 HTTP 501 和 `{ "success": false, "code": "backend_not_connected" }`。前端据此显示中性提示，说明表单已完整、资料尚未被 Nx 接收。此状态仅用于区分预览环境与真实提交失败；后端接入后仍须返回上述成功确认，不能用预览提示替代实际接收。

## 幂等、跨域与验证

- 同一份表单内容在重试时复用 `Idempotency-Key`；字段改变后创建新 UUID。后端应识别该请求头，在超时后重试时返回已有结果，避免重复创建请求。
- 默认同源部署。如果后端不同域，配置完整 HTTPS 地址，并允许该前端域名、POST/OPTIONS、`Content-Type`、`Accept` 和 `Idempotency-Key` 请求头。
- 若后端使用跨域 Cookie，将 `credentials` 改为 `include`，后端返回具体允许的 Origin 和 `Access-Control-Allow-Credentials: true`。按后端现有认证/CSRF 方案接入；前端配置文件不能放密钥。
- 后端须独立执行字段校验、限流和同意值验证；前端校验不能替代服务端校验。
- 静态前端不包含数据库、邮件通知、验证码或后端模拟器。接入既有后端时，如字段命名不同，在 `form.js` 的 payload 构建处转换。
- 建议由后端记录实际接收时间与适用条款版本，避免信任浏览器时钟。

## 当前部署状态

2026-10-07 起该接口已在 www.nxgrowth.ai 上线。服务实现位于 `server/`（Node 内置模块加 nodemailer 一个依赖），由 systemd 守护，nginx 把 `/api/` 反代到本机服务。本文约定的字段校验、`Idempotency-Key` 幂等、按 IP 限流与 24 个月保留期清理均已实现；前端与 `config.js` 无需改动。部署时把 `server/` 上传到服务器后执行其中的 `remote-install.sh`（root，可重复执行），环境模板为 `server/nx-api.env.example`，systemd 单元与 nginx 片段同样位于 `server/`。
