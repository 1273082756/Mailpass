<div align="center">

<h1>Mailpass</h1>
<p>一个可以自部署的临时邮箱，使用自己的域名收件。</p>
<p><a href="README.md">English</a> · <a href="#快速开始">快速开始</a> · <a href="https://github.com/1273082756/Mailpass/releases/latest">下载最新版本</a> · <a href="docs/RELEASING.md">发布指南</a></p>

<p>
  <a href="https://github.com/1273082756/Mailpass/releases/latest"><img src="https://img.shields.io/github/v/release/1273082756/Mailpass?style=flat-square&amp;color=3375ed" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/React-19-149eca?style=flat-square" alt="React 19">
  <img src="https://img.shields.io/badge/Python-3.11-3776ab?style=flat-square" alt="Python 3.11">
  <img src="https://img.shields.io/badge/Docker-amd64%20%7C%20arm64-2496ed?style=flat-square" alt="Docker amd64 and arm64">
</p>

</div>

配置好域名后，`hello@example.com`、`test@example.com` 这样的地址都能直接收件，不用逐个创建。所有邮件放在同一个收件箱中，保存在你自己的服务器上。

![Mailpass 收件箱，左侧浅色主题，右侧深色主题](img/showcase-desktop.png)

<p align="center"><a href="img/inbox-desktop.png">浅色主题</a> · <a href="img/inbox-dark.png">深色主题</a></p>

> 截图使用演示邮件和示例地址。

## 功能

- **多域名收件**：支持多个域名，任意地址前缀都能收件，无需提前创建邮箱。
- **邮件管理**：支持搜索，按收件地址和未读状态筛选。
- **界面**：支持电脑和手机访问，可切换深浅色主题。
- **访问控制**：使用访问密钥登录。
- **部署**：提供 amd64 / arm64 的 Docker 离线包，邮件存储在 SQLite 中，通过数据卷保存。

只支持收件，不支持发信。附件只记录名称、类型和大小，不保存文件内容，也无法下载。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 后端 | Python 3.11、FastAPI、Uvicorn，使用 uv 管理依赖 |
| SMTP 收件 | aiosmtpd |
| 数据库 | SQLite，使用 Python 内置的 sqlite3 |
| 前端 | React 19、TypeScript 5 |
| 样式与图标 | Tailwind CSS 3.4、Lucide |
| 前端构建 | Bun 1.3、Vite 6 |
| 部署 | Docker Compose、Nginx |

## 界面预览

电脑上可以在邮件列表旁查看正文，手机上则单独打开邮件。点击图片查看原图。

<table>
  <tr><th width="79%">桌面端</th><th width="21%">手机端</th></tr>
  <tr>
    <td valign="top"><a href="img/reader-desktop.png"><img src="img/reader-desktop.png" width="100%" alt="桌面端邮件阅读页面"></a></td>
    <td valign="top"><a href="img/reader-mobile.png"><img src="img/reader-mobile.png" width="100%" alt="手机端邮件阅读页面"></a></td>
  </tr>
</table>

<details>
<summary>更多截图</summary>

<table>
  <tr><th width="79%">桌面收件箱</th><th width="21%">手机收件箱</th></tr>
  <tr>
    <td valign="top"><a href="img/inbox-dark.png"><img src="img/inbox-dark.png" width="100%" alt="深色主题的桌面收件箱"></a></td>
    <td valign="top"><a href="img/inbox-mobile.png"><img src="img/inbox-mobile.png" width="100%" alt="手机收件箱"></a></td>
  </tr>
</table>

![登录页](img/login.png)

</details>

## 快速开始

准备一台安装了 **Docker 和 Docker Compose v2** 的 Linux 服务器，以及可配置 DNS 的收件域名。

### 使用部署包（推荐）

从 [Releases](https://github.com/1273082756/Mailpass/releases/latest) 下载对应架构的部署包和 `.sha256` 校验文件：

| 服务器架构 | 部署包 |
| --- | --- |
| Intel / AMD，`x86_64` / `amd64` | `mailpass-<版本>-linux-amd64.tar.gz` |
| ARM，`aarch64` / `arm64` | `mailpass-<版本>-linux-arm64.tar.gz` |

包内已包含前后端的 Docker 镜像，不需要安装 Python 或 Node.js，也不需要另外拉取镜像。下载时选择上表中的部署包，**Source code** 是 GitHub 自动生成的源码压缩包。

以 `v1.0.0` 的 amd64 包为例：

```bash
sha256sum -c mailpass-v1.0.0-linux-amd64.tar.gz.sha256
tar -xzf mailpass-v1.0.0-linux-amd64.tar.gz
cd mailpass-v1.0.0-linux-amd64
cp .env.example .env
# 编辑 .env，将 MAIL_DOMAINS 改为你的收件域名
bash start.sh
```

启动后打开 **`http://服务器IP:8080`**。如果没有设置 `ACCESS_KEY`，可以在后端日志中找到自动生成的访问密钥：

```bash
docker compose logs backend
```

<details>
<summary>从源码构建</summary>

```bash
git clone https://github.com/1273082756/Mailpass.git
cd Mailpass
cp .env.example .env
# 编辑 MAIL_DOMAINS 和其他配置
docker compose up -d --build
```

</details>

### 接收外部邮件

假设收件地址是 `hello@example.com`，SMTP 主机名是 `mail.example.com`：

```text
mail.example.com.  A    <服务器公网 IPv4>
example.com.       MX   10 mail.example.com.
```

将 `MAIL_DOMAINS` 设为 `example.com`，并在云主机安全组、防火墙和面板中开放**入站 TCP 25 端口**。MX 目标需要直接指向 SMTP 主机，不能只配置普通的 HTTP 反向代理。

## 配置

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MAIL_DOMAINS` | 必填 | 接收域名，多个域名用逗号分隔 |
| `SITE_NAME` | `Mailpass` | 界面和浏览器标题中的站点名称 |
| `ACCESS_KEY` | 自动生成 | Web / API 访问密钥 |
| `WEB_PORT` | `8080` | Web 对外端口 |
| `SMTP_PORT` | `25` | SMTP 对外端口，公网收件通常使用 25 |
| `SMTP_ENABLED` | `true` | 是否启用 SMTP 收件 |
| `MAX_MESSAGE_SIZE` | `15728640` | 单封邮件上限，默认 15 MiB |
| `CORS_ORIGINS` | `*` | API 允许的来源 |

使用 Docker Compose 启动时，需要先创建 `.env` 并填写 `MAIL_DOMAINS`。自动生成的密钥保存在数据卷中的 `/data/.access_key`，重启后仍然有效。不要将 `.env`、密钥或真实邮件数据提交到仓库。通过公网访问网页时，建议配置 HTTPS。

## 数据与维护

邮件保存在 Docker 数据卷 `mail_data` 中，删除容器后仍会保留。

```bash
docker compose ps          # 查看服务状态
docker compose logs -f     # 查看日志
docker compose down        # 停止服务，保留数据卷
```

升级前备份数据卷，并保留原 `.env`。离线包升级步骤见 [部署说明](deploy/README.md)；自动构建和发布步骤见 [发布指南](docs/RELEASING.md)。`docker compose down --volumes` 会删除数据卷及邮件。

## 本地开发

后端使用 Python 3.11 和 uv。只调试界面时可关闭 SMTP，并将开发数据库放在本地目录：

```bash
cd backend
uv sync
DATABASE_PATH=./tempmail.db SMTP_ENABLED=false uv run uvicorn app.main:app --reload
```

前端使用 React、TypeScript、Vite 和 Bun，在另一个终端运行：

```bash
cd frontend
bun install
bun run dev
```

开发服务器将 `/api` 代理到 `http://127.0.0.1:8000`。运行 `bun run typecheck` 和 `bun run build` 检查前端。后端不会自动加载仓库根目录的 `.env`；需要时为 uvicorn 添加 `--env-file ../.env`。

## 项目结构

```text
backend/                  SMTP 收件、邮件解析、SQLite 与 FastAPI
frontend/                 Web 前端（React + TypeScript）
img/                      README 截图
deploy/                   离线部署模板和启动脚本
scripts/                  打包与部署验证脚本
.github/workflows/        GitHub Actions 发布流程
docs/                     维护与发布文档
docker-compose.yml        源码部署配置
```

遇到问题或有功能建议，欢迎提 Issue，也欢迎提交 PR。

## 开源协议

本项目采用 [MIT 许可证](LICENSE)。你可以自由使用、修改、fork 和商用，也可以分发修改后的版本。分发时请保留原版权声明和许可证文本。

## Star 趋势

<a href="https://star-history.com/#1273082756/Mailpass&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=1273082756/Mailpass&amp;type=Date&amp;theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=1273082756/Mailpass&amp;type=Date">
    <img alt="Mailpass GitHub Star 数量历史趋势图" src="https://api.star-history.com/svg?repos=1273082756/Mailpass&amp;type=Date" width="100%">
  </picture>
</a>
