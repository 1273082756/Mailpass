"""Exercise a packaged deployment using only the Python standard library."""
import json
import os
import smtplib
import sys
import time
from email.message import EmailMessage
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

base = f"http://127.0.0.1:{int(sys.argv[1])}"
smtp_port = int(sys.argv[2])
headers = {"X-Access-Key": os.environ["ACCESS_KEY"]}

for attempt in range(30):
    try:
        with urlopen(f"{base}/api/health", timeout=3) as response:
            assert json.load(response)["status"] == "ok"
        break
    except (URLError, TimeoutError):
        if attempt == 29:
            raise
        time.sleep(1)

with urlopen(base, timeout=5) as response:
    assert 'id="root"' in response.read().decode(), "Frontend is missing"
try:
    urlopen(f"{base}/api/messages", timeout=5)
    raise AssertionError("Inbox is accessible without authentication")
except HTTPError as error:
    assert error.code == 401

message = EmailMessage()
message["From"] = "release-test@example.net"
message["To"] = "smoke@example.com"
message["Subject"] = "Release smoke test"
message.set_content("Packaged SMTP and HTTP services are working.")
with smtplib.SMTP("127.0.0.1", smtp_port, timeout=10) as smtp:
    smtp.send_message(message)
with urlopen(Request(f"{base}/api/messages", headers=headers), timeout=5) as response:
    messages = json.load(response)
assert messages["total"] == 1
item = messages["items"][0]
assert item["subject"] == "Release smoke test"
with urlopen(Request(f"{base}/api/messages/{item['id']}", headers=headers), timeout=5) as response:
    assert "Packaged SMTP" in json.load(response)["text_body"]
print("Packaged frontend, authentication, SMTP delivery, and inbox API: OK")
