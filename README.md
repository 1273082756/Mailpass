# Mailpass

A lightweight, receive-only mailbox for temporary, personal use.

Mailpass accepts messages sent to any address under your configured domains and collects them in one private inbox. No address needs to be created in advance. Message text, HTML, recipients, and attachment metadata are stored in SQLite.

🇨🇳 [中文文档](README_CN.md)

## ✨ Features

- Receive-only SMTP service for multiple domains and arbitrary local parts
- Parsed sender, recipients, subject, plain text, HTML, and attachment metadata
- Inbox search, unread filtering, address aggregation, pagination, and a configurable auto-refresh countdown
- Responsive React workspace with dark mode and mobile mail reading
- Optional remembered access key, stored only in the current browser
- Access-key authentication and sandboxed HTML previews
- SQLite persistence through a Docker volume

## 🚀 Quick start

Download a `linux-amd64` or `linux-arm64` offline deployment package from
[Releases](https://github.com/1273082756/Mailpass/releases), configure it using the bundled README,
and run `bash start.sh`. Images are included; the server only needs Docker and Compose v2.
Maintainer setup and release instructions are in the [release guide](docs/RELEASING.md) (Chinese).

To build from source:

```bash
cp .env.example .env
# Edit MAIL_DOMAINS and other settings as needed
docker compose up -d --build
```

The web UI is available at `http://SERVER_IP:8080` by default.

Point your MX records at the SMTP host before receiving mail:

```text
mail.example.com.  A    <server public IP>
example.com.       MX   10 mail.example.com.
```

The default SMTP port is `25`. Make sure it is allowed by your cloud security group, firewall, and host panel.

## ⚙️ Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `MAIL_DOMAINS` | `mail.example.com,example.com` | Comma-separated receiving domains |
| `SITE_NAME` | `Mailpass` | Name shown in the web UI and browser title; empty values fall back to `Mailpass` |
| `ACCESS_KEY` | generated | Web/API access key; generated when empty |
| `WEB_PORT` | `8080` | Published web port |
| `SMTP_PORT` | `25` | Published SMTP port |
| `SMTP_ENABLED` | `true` | Enable SMTP receiving |
| `MAX_MESSAGE_SIZE` | `15728640` | Maximum message size in bytes |
| `CORS_ORIGINS` | `*` | Allowed API origins |

`.env` is required and `MAIL_DOMAINS` must not be empty. Compose fails before startup when either requirement is not met. If `ACCESS_KEY` is omitted, the backend generates a random key, stores it at `/data/.access_key`, and prints it to the backend log:

```bash
docker compose logs backend
```

Mailpass only receives mail; it does not send messages. Attachment contents are not stored, only their metadata.

## 🧑‍💻 Development

The backend requires Python 3.11 and uses uv:

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

The frontend uses React, TypeScript, Vite, and Bun:

```bash
cd frontend
bun install
bun run dev
bun run typecheck
bun run build
```

The Vite development server proxies `/api` to `http://127.0.0.1:8000`.

## 🗂️ Project layout

```text
backend/
  app/main.py       SMTP receiver, parsing, SQLite, and API
frontend/
  src/              TypeScript + React workspace
docker-compose.yml  Services and persistent volume
```

## 🛡️ Security notes

- Never commit `.env` or an access key.
- Use a long, random access key when configuring one manually.
- Public deployments require correct MX records and an accessible SMTP port.

## 🤝 Contributing

Issues and pull requests are welcome. Keep changes focused and include a short validation note with each contribution.
