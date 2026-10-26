#!/usr/bin/env bash
# 远端安装/更新 nx-api 服务本体。将本目录上传到服务器后，
# 在服务器上以 root 执行。幂等：可重复运行，不会覆盖已填好 SMTP 的环境文件。

set -euo pipefail

APP="/srv/nx-api"
DATA="/var/lib/nx-api"

mkdir -p "$APP" "$DATA"

echo "  - 服务账号"
if ! id -u nx-api >/dev/null 2>&1; then
  useradd --system --shell /usr/sbin/nologin nx-api
  echo "    已创建系统用户 nx-api"
else
  echo "    nx-api 已存在"
fi

echo "  - 依赖安装（仅 nodemailer）"
rm -rf "$APP/node_modules"
npm install --omit=dev --no-fund --no-audit --prefix "$APP" 2>&1 | tail -2

echo "  - 环境文件"
if [ ! -f /etc/nx-api.env ]; then
  install -m 600 -o root -g nx-api "$APP/nx-api.env.example" /etc/nx-api.env
  echo "    已从模板生成 /etc/nx-api.env（未配 SMTP，先跳过邮件通知）"
else
  chmod 600 /etc/nx-api.env
  echo "    保留现有 /etc/nx-api.env"
fi

echo "  - systemd 单元与 nginx 片段"
install -m 644 "$APP/nx-leads.service" "$APP/nx-leads-prune.service" "$APP/nx-leads-prune.timer" /etc/systemd/system/
install -m 644 "$APP/nx-api.nginx.conf" /etc/nginx/snippets/nx-api.conf

chown -R nx-api:nx-api "$APP" "$DATA"
chmod 750 "$DATA"
find "$APP" -type d -exec chmod 755 {} \;
find "$APP" -type f -exec chmod 644 {} \;

echo "  - nginx 引入 /api/ 反代"
python3 - <<'PY'
path = "/etc/nginx/sites-enabled/nx-demo"
source = open(path, encoding="utf-8").read()
marker = "include snippets/nx-api.conf;"
if marker in source:
    print("    已存在，跳过")
else:
    needle = "    location / {\n"
    count = source.count(needle)
    if count == 0:
        raise SystemExit("nginx: 找不到可锚定的 'location / {' 块")
    open(path, "w", encoding="utf-8").write(source.replace(needle, marker + "\n\n" + needle))
    print(f"    已在 {count} 个 server 块中加入 {marker}")
PY

nginx -t
systemctl reload nginx
systemctl daemon-reload
systemctl enable --now nx-leads.service nx-leads-prune.timer
systemctl restart nx-leads.service

sleep 2
echo "  - 服务状态"
systemctl is-active nx-leads.service
curl -s -o /dev/null -m 5 -w "    本机 healthz  HTTP %{http_code}\n" http://127.0.0.1:8787/healthz
