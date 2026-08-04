#!/usr/bin/env bash
# Nail Studio 部署脚本（腾讯云轻量服务器）
# 用法：./deploy/deploy.sh <服务器IP> [SSH用户，默认 root]
# 前提：本机已通过 SSH 密钥免密登录服务器（ssh-copy-id 一次性配置）
set -euo pipefail

SERVER_IP="${1:?用法: ./deploy/deploy.sh <服务器IP> [SSH用户]}"
SSH_USER="${2:-root}"
REMOTE_DIR="/var/www/nail-studio"

cd "$(dirname "$0")/.."

echo "==> 1/4 构建生产产物"
npm run build

echo "==> 2/4 上传 dist/ 到 ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}"
ssh "${SSH_USER}@${SERVER_IP}" "mkdir -p ${REMOTE_DIR}"
rsync -avz --delete dist/ "${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/"

echo "==> 3/4 安装 nginx 站点配置"
scp deploy/nginx-nail-studio.conf "${SSH_USER}@${SERVER_IP}:/etc/nginx/conf.d/nail-studio.conf"

echo "==> 4/4 校验并重载 nginx"
ssh "${SSH_USER}@${SERVER_IP}" "nginx -t && systemctl reload nginx"

echo "✅ 部署完成：http://${SERVER_IP}"
