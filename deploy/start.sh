#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo 'Please install and start Docker with the Docker Compose v2 plugin.' >&2
  exit 1
fi

server_arch=$(docker info --format '{{.OSType}}/{{.Architecture}}')
case "$server_arch" in
  linux/x86_64|linux/amd64) server_arch=amd64 ;;
  linux/aarch64|linux/arm64) server_arch=arm64 ;;
  *) echo "Unsupported Docker server: $server_arch. Linux containers are required." >&2; exit 1 ;;
esac
if [ "$server_arch" != "$(cat ARCH)" ]; then
  echo "Download the linux-$server_arch release package for this Docker server." >&2
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo 'Created .env. Set MAIL_DOMAINS to your receiving domains, then run bash start.sh again.'
  exit 0
fi

docker compose config --quiet
docker load --input images.tar.gz
docker compose up -d --wait --wait-timeout 120 --pull never --no-build
echo 'Mailpass is ready. Web: http://SERVER_IP:8080 (or your configured WEB_PORT).'
echo 'View the generated access key with: docker compose logs backend'
