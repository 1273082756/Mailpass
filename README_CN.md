# Mailpass

一个轻量、只收件的个人临时邮箱。

Mailpass 会接收配置域名下任意地址的邮件，并统一收录到一个私密收件箱中，无需提前创建地址。邮件正文、HTML、收件地址和附件信息持久化到 SQLite。

🇬🇧 [English README](README.md)

## ✨ 特性

- 只收件 SMTP 服务，支持多个域名和任意前缀地址
- 解析发件人、收件人、主题、纯文本、HTML 和附件信息
- 支持搜索、未读筛选、地址聚合、分页和可设置频率的自动刷新倒计时
- 响应式 React 工作台、深色模式和移动端阅读
- 可选记住访问密钥，仅保存在当前浏览器
- 访问密钥鉴权，HTML 邮件使用 sandbox iframe 隔离预览
- SQLite 数据通过 Docker volume 持久化

## 🚀 快速开始

可从 [Releases](https://github.com/1273082756/Mailpass/releases) 下载 `linux-amd64` 或
`linux-arm64` 离线部署包，按包内 README 配置后运行 `bash start.sh`。包内包含已构建镜像，
服务器只需 Docker 和 Compose v2。维护者的 Actions 配置与发布点击步骤见 [发布指南](docs/RELEASING.md)。

从源码构建：

```bash
cp .env.example .env
# 按需修改 MAIL_DOMAINS 和其他配置
docker compose up -d --build
```

Web 界面默认访问 `http://服务器IP:8080`。

正式收件前，请将 MX 记录指向 SMTP 主机：

```text
mail.example.com.  A    <服务器公网 IP>
example.com.       MX   10 mail.example.com.
```

默认 SMTP 端口是 `25`，请确保云主机安全组、防火墙和面板都已放行。

## ⚙️ 配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MAIL_DOMAINS` | `mail.example.com,example.com` | 接收域名，逗号分隔 |
| `SITE_NAME` | `Mailpass` | Web 界面和浏览器标题显示的站点名称，留空时默认使用 `Mailpass` |
| `ACCESS_KEY` | 自动生成 | Web/API 访问密钥，留空时自动生成 |
| `WEB_PORT` | `8080` | Web 映射端口 |
| `SMTP_PORT` | `25` | SMTP 映射端口 |
| `SMTP_ENABLED` | `true` | 是否启用 SMTP 收件 |
| `MAX_MESSAGE_SIZE` | `15728640` | 单封邮件大小上限（字节） |
| `CORS_ORIGINS` | `*` | API 允许的来源 |

`.env` 是必需文件，`MAIL_DOMAINS` 不能为空；缺少任一项时 Compose 会在启动前直接报错。未配置 `ACCESS_KEY` 时，后端会生成随机密钥，保存到 `/data/.access_key`，并输出到日志：

```bash
docker compose logs backend
```

Mailpass 只收件，不提供发信能力。附件只保存名称、类型和大小，不保存附件内容。

## 🧑‍💻 本地开发

后端要求 Python 3.11，使用 uv 管理依赖：

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

前端使用 React、TypeScript、Vite 和 Bun：

```bash
cd frontend
bun install
bun run dev
bun run typecheck
bun run build
```

Vite 开发服务器已将 `/api` 代理到 `http://127.0.0.1:8000`。

## 🗂️ 项目结构

```text
backend/
  app/main.py       SMTP 收件、邮件解析、SQLite 和 API
frontend/
  src/              TypeScript + React 工作台
docker-compose.yml  服务和持久化数据卷
```

## 🛡️ 安全提示

- 不要提交 `.env` 或访问密钥。
- 手动配置访问密钥时，请使用足够长的随机字符串。
- 公网部署前请配置正确的 MX 记录并放行 SMTP 端口。

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request。请保持改动聚焦，并在贡献中附上简短的验证说明。
