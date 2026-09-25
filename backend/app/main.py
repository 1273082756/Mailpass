from __future__ import annotations

import html
import hashlib
import json
import os
import re
import secrets
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timezone
from email import message_from_bytes
from email.header import decode_header, make_header
from email.policy import default
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path
from typing import Any

from aiosmtpd.controller import Controller
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field


def env_bool(name: str, fallback: bool = False) -> bool:
    return os.getenv(name, str(fallback)).lower() in {"1", "true", "yes", "on"}


configured_domains = os.getenv("MAIL_DOMAINS", "")
if not configured_domains.strip():
    configured_domains = os.getenv("MAIL_DOMAIN", "mail.example.com,example.com")
MAIL_DOMAINS = tuple(
    dict.fromkeys(
        item.strip().lower().lstrip("@").rstrip(".")
        for item in configured_domains.split(",")
        if item.strip()
    )
)
if not MAIL_DOMAINS:
    MAIL_DOMAINS = ("mail.example.com", "example.com")
SITE_NAME = os.getenv("SITE_NAME", "Mailpass").strip() or "Mailpass"
DB_PATH = Path(os.getenv("DATABASE_PATH", "/data/tempmail.db"))
SMTP_HOST = os.getenv("SMTP_HOST", "0.0.0.0")
SMTP_PORT = int(os.getenv("SMTP_PORT", "2525"))
MAX_MESSAGE_SIZE = int(os.getenv("MAX_MESSAGE_SIZE", str(15 * 1024 * 1024)))
SMTP_ENABLED = env_bool("SMTP_ENABLED", True)
ACCESS_KEY = os.getenv("ACCESS_KEY", "").strip()


def ensure_access_key() -> None:
    """Use the configured key or create one that survives container restarts."""
    global ACCESS_KEY
    if ACCESS_KEY:
        return

    key_path = DB_PATH.parent / ".access_key"
    try:
        ACCESS_KEY = key_path.read_text(encoding="utf-8").strip()
    except (FileNotFoundError, OSError):
        ACCESS_KEY = ""

    if ACCESS_KEY:
        print(f"[startup] ACCESS_KEY was not configured; using persisted generated key: {ACCESS_KEY}", flush=True)
        return

    ACCESS_KEY = secrets.token_urlsafe(32)
    try:
        key_path.parent.mkdir(parents=True, exist_ok=True)
        key_path.write_text(ACCESS_KEY + "\n", encoding="utf-8")
        key_path.chmod(0o600)
    except OSError as error:
        print(f"[startup] Warning: could not persist generated ACCESS_KEY: {error}", flush=True)
    print(f"[startup] ACCESS_KEY was not configured; generated random key: {ACCESS_KEY}", flush=True)


def is_domain_recipient(address: str) -> bool:
    normalized = address.strip().lower()
    return any(normalized.endswith(f"@{domain}") for domain in MAIL_DOMAINS)


def domain_label() -> str:
    return ", ".join(MAIL_DOMAINS)


SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL UNIQUE,
  sender TEXT NOT NULL DEFAULT '',
  recipients TEXT NOT NULL DEFAULT '[]',
  subject TEXT NOT NULL DEFAULT '(无主题)',
  text_body TEXT NOT NULL DEFAULT '',
  html_body TEXT NOT NULL DEFAULT '',
  attachments TEXT NOT NULL DEFAULT '[]',
  received_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  raw_size INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def init_db() -> None:
    with db() as connection:
        connection.executescript(SCHEMA)


def decode_header_value(value: str | None, fallback: str = "") -> str:
    if not value:
        return fallback
    try:
        return str(make_header(decode_header(value))).strip()
    except (LookupError, UnicodeError):
        return value.strip()


def decode_part(part: Any) -> str:
    payload = part.get_payload(decode=True)
    if payload is None:
        raw = part.get_payload()
        return raw if isinstance(raw, str) else ""
    charset = part.get_content_charset() or "utf-8"
    try:
        return payload.decode(charset, errors="replace")
    except (LookupError, UnicodeError):
        return payload.decode("utf-8", errors="replace")


def parse_date(value: str | None) -> str:
    if value:
        try:
            date = parsedate_to_datetime(value)
            if date.tzinfo is None:
                date = date.replace(tzinfo=timezone.utc)
            return date.astimezone(timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            pass
    return utc_now()


def parse_message(raw: bytes, envelope_recipients: list[str]) -> dict[str, Any]:
    message = message_from_bytes(raw, policy=default)
    sender_parts = getaddresses([message.get("From", "")])
    sender_value = sender_parts[0][1] if sender_parts else ""
    if sender_parts and sender_parts[0][0]:
        sender_value = f"{sender_parts[0][0]} <{sender_parts[0][1]}>"

    header_recipients = [
        address.strip().lower()
        for _, address in getaddresses(message.get_all("To", []) + message.get_all("Cc", []))
        if address and is_domain_recipient(address)
    ]
    recipients = list(dict.fromkeys(envelope_recipients + header_recipients))
    text_body = ""
    html_body = ""
    attachments: list[dict[str, Any]] = []

    parts = message.walk() if message.is_multipart() else [message]
    for part in parts:
        if part.is_multipart():
            continue
        disposition = (part.get_content_disposition() or "").lower()
        filename = part.get_filename()
        content_type = part.get_content_type()
        if disposition == "attachment" or filename:
            payload = part.get_payload(decode=True) or b""
            attachments.append({
                "name": decode_header_value(filename, "附件"),
                "type": content_type,
                "size": len(payload),
            })
            continue
        value = decode_part(part)
        if content_type == "text/plain" and not text_body:
            text_body = value
        elif content_type == "text/html" and not html_body:
            html_body = value

    if not text_body and html_body:
        text_body = re.sub(r"<[^>]+>", " ", html.unescape(html_body))
        text_body = re.sub(r"\s+", " ", text_body).strip()

    return {
        "message_id": message.get("Message-ID") or f"local-{hashlib.sha256(raw).hexdigest()}",
        "sender": sender_value or decode_header_value(message.get("From"), "未知发件人"),
        "recipients": recipients,
        "subject": decode_header_value(message.get("Subject"), "(无主题)"),
        "text_body": text_body,
        "html_body": html_body,
        "attachments": attachments,
        "received_at": parse_date(message.get("Date")),
        "raw_size": len(raw),
    }


def save_message(raw: bytes, envelope_recipients: list[str]) -> int:
    parsed = parse_message(raw, envelope_recipients)
    with db() as connection:
        existing = connection.execute("SELECT id FROM messages WHERE message_id = ?", (parsed["message_id"],)).fetchone()
        if existing:
            return int(existing["id"])
        cursor = connection.execute(
            """INSERT INTO messages
            (message_id, sender, recipients, subject, text_body, html_body, attachments, received_at, raw_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                parsed["message_id"],
                parsed["sender"],
                json.dumps(parsed["recipients"], ensure_ascii=False),
                parsed["subject"],
                parsed["text_body"],
                parsed["html_body"],
                json.dumps(parsed["attachments"], ensure_ascii=False),
                parsed["received_at"],
                parsed["raw_size"],
            ),
        )
        return int(cursor.lastrowid)


class SMTPHandler:
    async def handle_DATA(self, server: Any, session: Any, envelope: Any) -> str:
        content = envelope.content
        if len(content) > MAX_MESSAGE_SIZE:
            return "552 Message exceeds configured size limit"
        recipients = [item.strip().lower() for item in envelope.rcpt_tos if item]
        accepted = [item for item in recipients if is_domain_recipient(item)]
        if not accepted:
            return f"550 Recipient must belong to one of: {domain_label()}"
        try:
            save_message(content, accepted)
        except Exception as error:  # pragma: no cover - SMTP clients only need a stable response
            print(f"Failed to save incoming message: {error}")
            return "451 Temporary local error"
        return "250 Message accepted for delivery"


smtp_controller: Controller | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global smtp_controller
    init_db()
    ensure_access_key()
    if SMTP_ENABLED:
        smtp_controller = Controller(SMTPHandler(), hostname=SMTP_HOST, port=SMTP_PORT, decode_data=False)
        smtp_controller.start()
    try:
        yield
    finally:
        if smtp_controller:
            smtp_controller.stop()
            smtp_controller = None


app = FastAPI(title="Mailpass", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",")],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def access_key_middleware(request: Request, call_next: Any):
    public_paths = {"/api/health", "/api/auth/verify"}
    if request.method != "OPTIONS" and request.url.path.startswith("/api/") and request.url.path not in public_paths:
        if not ACCESS_KEY:
            return JSONResponse(status_code=503, content={"detail": "ACCESS_KEY is not configured"})
        provided_key = request.headers.get("X-Access-Key", "")
        if not secrets.compare_digest(provided_key, ACCESS_KEY):
            return JSONResponse(status_code=401, content={"detail": "Invalid access key"})
    return await call_next(request)


def row_to_dict(row: sqlite3.Row, detail: bool = False) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": row["id"],
        "sender": row["sender"],
        "recipients": json.loads(row["recipients"] or "[]"),
        "subject": row["subject"],
        "received_at": row["received_at"],
        "is_read": bool(row["is_read"]),
        "attachments": json.loads(row["attachments"] or "[]"),
        "raw_size": row["raw_size"],
    }
    if detail:
        payload.update({"text_body": row["text_body"], "html_body": row["html_body"]})
    return payload


class ReadUpdate(BaseModel):
    is_read: bool = Field(default=True)


class AccessKeyRequest(BaseModel):
    key: str


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "site_name": SITE_NAME, "domain": MAIL_DOMAINS[0], "domains": list(MAIL_DOMAINS), "smtp_enabled": SMTP_ENABLED, "access_key_configured": bool(ACCESS_KEY)}


@app.post("/api/auth/verify")
def verify_access_key(payload: AccessKeyRequest) -> dict[str, bool]:
    if not ACCESS_KEY:
        raise HTTPException(status_code=503, detail="ACCESS_KEY is not configured")
    if not secrets.compare_digest(payload.key, ACCESS_KEY):
        raise HTTPException(status_code=401, detail="Invalid access key")
    return {"ok": True}


@app.get("/api/config")
def config() -> dict[str, Any]:
    return {"site_name": SITE_NAME, "domain": MAIL_DOMAINS[0], "domains": list(MAIL_DOMAINS), "smtp_port": SMTP_PORT, "smtp_enabled": SMTP_ENABLED}


@app.get("/api/messages")
def list_messages(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    unread: bool = False,
    address: str | None = None,
    q: str | None = None,
) -> dict[str, Any]:
    clauses: list[str] = []
    params: list[Any] = []
    if unread:
        clauses.append("is_read = 0")
    if address:
        clauses.append("recipients LIKE ?")
        params.append(f'%"{address.lower()}"%')
    if q:
        clauses.append("(subject LIKE ? OR sender LIKE ? OR text_body LIKE ?)")
        needle = f"%{q}%"
        params.extend([needle, needle, needle])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with db() as connection:
        total = connection.execute(f"SELECT COUNT(*) AS total FROM messages {where}", params).fetchone()["total"]
        rows = connection.execute(
            f"SELECT * FROM messages {where} ORDER BY datetime(received_at) DESC, id DESC LIMIT ? OFFSET ?",
            [*params, limit, offset],
        ).fetchall()
        unread_count = connection.execute("SELECT COUNT(*) AS total FROM messages WHERE is_read = 0").fetchone()["total"]
    return {"items": [row_to_dict(row) for row in rows], "total": total, "unread": unread_count}


@app.get("/api/addresses")
def list_addresses() -> list[dict[str, Any]]:
    with db() as connection:
        rows = connection.execute("SELECT recipients, is_read FROM messages ORDER BY datetime(received_at) DESC").fetchall()
    counts: dict[str, dict[str, int]] = {}
    for row in rows:
        for address in json.loads(row["recipients"] or "[]"):
            item = counts.setdefault(address, {"total": 0, "unread": 0})
            item["total"] += 1
            item["unread"] += int(not row["is_read"])
    return [{"address": address, **values} for address, values in sorted(counts.items())]


@app.get("/api/messages/{message_id}")
def get_message(message_id: int) -> dict[str, Any]:
    with db() as connection:
        row = connection.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="消息不存在")
    return row_to_dict(row, detail=True)


@app.patch("/api/messages/{message_id}/read")
def mark_message(message_id: int, update: ReadUpdate) -> dict[str, Any]:
    with db() as connection:
        cursor = connection.execute("UPDATE messages SET is_read = ? WHERE id = ?", (int(update.is_read), message_id))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="消息不存在")
    return {"ok": True}


@app.delete("/api/messages/{message_id}")
def delete_message(message_id: int) -> dict[str, Any]:
    with db() as connection:
        cursor = connection.execute("DELETE FROM messages WHERE id = ?", (message_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="消息不存在")
    return {"ok": True}


@app.delete("/api/messages")
def delete_all_messages() -> dict[str, Any]:
    with db() as connection:
        cursor = connection.execute("DELETE FROM messages")
    return {"ok": True, "deleted": cursor.rowcount}
