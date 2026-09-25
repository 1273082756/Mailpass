# Mailpass 离线部署包

适用于 Linux Docker 服务器；`amd64` 对应 Intel/AMD x86_64，`arm64` 对应 ARM64。
包内包含前后端镜像，无需安装 Python、Node.js，也无需构建或从镜像仓库下载。
服务器需要已安装并启动 Docker 和 Docker Compose v2。

## 启动

```bash
cp .env.example .env
# 编辑 .env，将 MAIL_DOMAINS 改为你的收件域名
bash start.sh
```

首次直接运行 `bash start.sh` 也会自动生成 `.env`，提示配置后再次启动。
默认访问 `http://服务器IP:8080`。未指定 ACCESS_KEY 时，通过以下命令查看生成的密钥：

```bash
docker compose logs backend
```

正式接收外部邮件还需要：域名 MX 记录指向服务器，并开放入站 TCP 25 端口。
服务只收邮件；附件内容不保存。

## 日常管理与升级

```bash
docker compose ps          # 状态
docker compose logs -f     # 日志
docker compose down        # 停止，保留邮件
```

升级时先备份 `mailpass_mail_data` 数据卷，再解压相同架构的新版本，将原 `.env`
复制到新目录并运行 `bash start.sh`。固定的 Compose 项目名会复用原有数据卷。
不要执行 `docker compose down --volumes`，该命令会删除邮件数据。

## English

Install Docker with Compose v2, copy `.env.example` to `.env`, set `MAIL_DOMAINS`,
and run `bash start.sh`. The package includes both container images and requires
no build tools or registry access. Open `http://SERVER_IP:8080`; find the generated
access key in `docker compose logs backend`. Public delivery requires MX records
and inbound TCP port 25. Upgrade with the same architecture package and your
existing `.env`; back up the `mailpass_mail_data` volume first.
