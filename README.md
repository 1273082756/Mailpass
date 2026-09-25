<div align="center">

<h1>Mailpass</h1>
<p>A self-hosted temporary mailbox for your own domains.</p>
<p><a href="README_CN.md">简体中文</a> · <a href="#quick-start">Quick start</a> · <a href="https://github.com/1273082756/Mailpass/releases/latest">Latest release</a> · <a href="docs/RELEASING.md">Release guide</a></p>

<p>
  <a href="https://github.com/1273082756/Mailpass/releases/latest"><img src="https://img.shields.io/github/v/release/1273082756/Mailpass?style=flat-square&amp;color=3375ed" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/React-19-149eca?style=flat-square" alt="React 19">
  <img src="https://img.shields.io/badge/Python-3.11-3776ab?style=flat-square" alt="Python 3.11">
  <img src="https://img.shields.io/badge/Docker-amd64%20%7C%20arm64-2496ed?style=flat-square" alt="Docker amd64 and arm64">
</p>

</div>

After adding a domain, addresses such as `hello@example.com` and `test@example.com` can receive mail without being created individually. All messages go to one inbox and are stored on your own server.

![Mailpass inbox, with the light theme on the left and dark theme on the right](img/showcase-desktop.png)

<p align="center"><a href="img/inbox-desktop.png">Light theme</a> · <a href="img/inbox-dark.png">Dark theme</a></p>

> Screenshots use sample messages and addresses.

## Features

- **Catch-all mail**: Receive mail at any address across multiple domains without creating individual mailboxes.
- **Mail management**: Search messages and filter by recipient or unread status.
- **Web interface**: Desktop and mobile support, with light and dark themes.
- **Access control**: Sign in with a shared access key.
- **Deployment**: Offline Docker packages for amd64 and arm64, with mail stored in SQLite on a persistent volume.

Mailpass can receive mail but cannot send it. Attachment names, types, and sizes are saved, but the files themselves are not stored and cannot be downloaded.

## Screenshots

On desktop, messages open beside the mail list. On mobile, they open in a separate view. Click an image to see it at full size.

<table>
  <tr><th width="79%">Desktop</th><th width="21%">Mobile</th></tr>
  <tr>
    <td valign="top"><a href="img/reader-desktop.png"><img src="img/reader-desktop.png" width="100%" alt="Desktop message reader"></a></td>
    <td valign="top"><a href="img/reader-mobile.png"><img src="img/reader-mobile.png" width="100%" alt="Mobile message reader"></a></td>
  </tr>
</table>

<details>
<summary>More screenshots</summary>

<table>
  <tr><th width="79%">Desktop inbox</th><th width="21%">Mobile inbox</th></tr>
  <tr>
    <td valign="top"><a href="img/inbox-dark.png"><img src="img/inbox-dark.png" width="100%" alt="Desktop inbox in the dark theme"></a></td>
    <td valign="top"><a href="img/inbox-mobile.png"><img src="img/inbox-mobile.png" width="100%" alt="Mobile inbox"></a></td>
  </tr>
</table>

![Sign-in page](img/login.png)

</details>

## Quick start

You need a Linux server with **Docker and Docker Compose v2**, plus a receiving domain whose DNS you can configure.

### Use a deployment package (recommended)

Download the package for your architecture and its `.sha256` file from [Releases](https://github.com/1273082756/Mailpass/releases/latest):

| Server architecture | Deployment package |
| --- | --- |
| Intel / AMD, `x86_64` / `amd64` | `mailpass-<version>-linux-amd64.tar.gz` |
| ARM, `aarch64` / `arm64` | `mailpass-<version>-linux-arm64.tar.gz` |

The package includes both Docker images, so you don't need to install Python or Node.js, or pull images from a registry. Download a deployment package from the table above; GitHub's **Source code** archives contain only the source files.

For example, with the `v1.0.0` amd64 package:

```bash
sha256sum -c mailpass-v1.0.0-linux-amd64.tar.gz.sha256
tar -xzf mailpass-v1.0.0-linux-amd64.tar.gz
cd mailpass-v1.0.0-linux-amd64
cp .env.example .env
# Edit .env and set MAIL_DOMAINS to your receiving domains
bash start.sh
```

Once the containers are running, open **`http://SERVER_IP:8080`**. If you haven't set `ACCESS_KEY`, you can find the generated key in the backend log:

```bash
docker compose logs backend
```

<details>
<summary>Build from source</summary>

```bash
git clone https://github.com/1273082756/Mailpass.git
cd Mailpass
cp .env.example .env
# Edit MAIL_DOMAINS and other settings
docker compose up -d --build
```

</details>

### Receive external mail

For an address such as `hello@example.com`, with `mail.example.com` as the SMTP host:

```text
mail.example.com.  A    <SERVER_PUBLIC_IPV4>
example.com.       MX   10 mail.example.com.
```

Set `MAIL_DOMAINS=example.com` and allow **inbound TCP port 25** in your cloud security group, firewall, and hosting panel. The MX target must reach the SMTP host directly; an ordinary HTTP reverse proxy is not enough.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `MAIL_DOMAINS` | Required | Comma-separated receiving domains |
| `SITE_NAME` | `Mailpass` | Name displayed in the UI and browser title |
| `ACCESS_KEY` | Generated | Web / API access key |
| `WEB_PORT` | `8080` | Published web port |
| `SMTP_PORT` | `25` | Published SMTP port; public delivery normally uses 25 |
| `SMTP_ENABLED` | `true` | Enable SMTP receiving |
| `MAX_MESSAGE_SIZE` | `15728640` | Maximum message size; 15 MiB by default |
| `CORS_ORIGINS` | `*` | Allowed API origins |

Before starting Docker Compose, create `.env` and set `MAIL_DOMAINS`. Generated keys are saved at `/data/.access_key` in the data volume and remain valid after restarts. Keep `.env`, access keys, and real mail data out of version control. Use HTTPS when accessing the web interface over the internet.

## Data and maintenance

Mail is stored in the Docker volume `mail_data` and survives container removal.

```bash
docker compose ps          # Service status
docker compose logs -f     # Logs
docker compose down        # Stop services and retain the data volume
```

Back up the data volume and keep your existing `.env` before upgrading. See the [deployment guide](deploy/README.md) for offline upgrades and the [release guide](docs/RELEASING.md) for automated builds and publishing (Chinese). `docker compose down --volumes` removes the data volume and its mail.

## Local development

The backend uses Python 3.11 and uv. For UI development, disable SMTP and keep the development database in the local directory:

```bash
cd backend
uv sync
DATABASE_PATH=./tempmail.db SMTP_ENABLED=false uv run uvicorn app.main:app --reload
```

The frontend uses React, TypeScript, Vite, and Bun. In another terminal:

```bash
cd frontend
bun install
bun run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000`. Run `bun run typecheck` and `bun run build` to check the frontend. The backend does not load the repository's root `.env` automatically; add `--env-file ../.env` to uvicorn when needed.

## Project layout

```text
backend/                  SMTP receiving, mail parsing, SQLite, and FastAPI
frontend/                 Web frontend (React + TypeScript)
img/                      README screenshots
deploy/                   Offline deployment templates and startup script
scripts/                  Packaging and deployment checks
.github/workflows/        GitHub Actions release workflow
docs/                     Maintenance and publishing documentation
docker-compose.yml        Docker Compose configuration for source builds
```

Bug reports, feature requests, and pull requests are welcome.

## Star History

<a href="https://star-history.com/#1273082756/Mailpass&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=1273082756/Mailpass&amp;type=Date&amp;theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=1273082756/Mailpass&amp;type=Date">
    <img alt="Mailpass star history chart" src="https://api.star-history.com/svg?repos=1273082756/Mailpass&amp;type=Date" width="100%">
  </picture>
</a>
