import os
import time
import json
import base64
import requests
from instagrapi import Client
from instagrapi.exceptions import LoginRequired, ClientError

INSTAGRAM_USER = os.environ.get("INSTAGRAM_USER", "extolem")
INSTAGRAM_PASS = os.environ.get("INSTAGRAM_PASS")
BACKEND_URL = os.environ.get("BACKEND_URL", "https://extolem-employee-app-production.up.railway.app").rstrip("/")
APP_TOKEN = os.environ.get("APP_SECRET", "extolem_app_secret_change_this")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "15"))
MAX_AGE_HOURS = int(os.environ.get("MAX_AGE_HOURS", "72"))  # how far back to sync
SESSION_FILE = "session.json"

HEADERS = {"x-app-token": APP_TOKEN, "Content-Type": "application/json"}

cl = Client()
cl.delay_range = [1, 3]

# Cache: user_id -> {"username":..., "name":...} so we don't hammer the IG API
USER_CACHE = {}
MY_ID = None


def login():
    global MY_ID
    print(f"[Poller] Logging into Instagram as @{INSTAGRAM_USER}...")

    session_b64 = os.environ.get("INSTAGRAM_SESSION_B64")
    if session_b64 and not os.path.exists(SESSION_FILE):
        try:
            with open(SESSION_FILE, "w") as f:
                f.write(base64.b64decode(session_b64).decode())
            print("[Poller] Wrote session from env variable.")
        except Exception as e:
            print(f"[Poller] Failed to decode session: {e}")

    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            sid = json.load(open(SESSION_FILE)).get("authorization_data", {}).get("sessionid", "")
            cl.login_by_sessionid(sid)
            MY_ID = str(cl.user_id)
            print(f"[Poller] Logged in via saved session (uid={MY_ID}).")
            return
        except Exception as e:
            print(f"[Poller] Session login failed: {e}, trying credentials...")

    cl.login(INSTAGRAM_USER, INSTAGRAM_PASS)
    cl.dump_settings(SESSION_FILE)
    MY_ID = str(cl.user_id)
    print(f"[Poller] Logged in fresh (uid={MY_ID}).")


def resolve_user(user_id):
    """Resolve a user_id to (username, full_name), cached to avoid API spam."""
    uid = str(user_id)
    if uid in USER_CACHE:
        return USER_CACHE[uid]["username"], USER_CACHE[uid]["name"]
    username, name = f"user_{uid[-6:]}", "Instagram User"
    try:
        info = cl.user_info(user_id)
        username = info.username or username
        name = info.full_name or info.username or name
    except Exception:
        pass
    USER_CACHE[uid] = {"username": username, "name": name}
    return username, name


def send_batch(messages):
    """Send a batch of messages to the backend. Backend dedupes by messageId."""
    if not messages:
        return
    try:
        r = requests.post(f"{BACKEND_URL}/poller/sync", headers=HEADERS,
                          json={"messages": messages}, timeout=30)
        if r.ok:
            data = r.json()
            if data.get("new", 0) > 0:
                print(f"[Poller] Backend stored {data['new']} new of {data['received']} sent.")
        else:
            print(f"[Poller] Backend returned {r.status_code}")
    except Exception as e:
        print(f"[Poller] Failed to send batch: {e}")


def poll():
    """Scan recent threads and re-sync all recent messages. Idempotent."""
    try:
        threads = cl.direct_threads(amount=20)
    except (LoginRequired, ClientError):
        print("[Poller] Session expired — re-logging...")
        login()
        threads = cl.direct_threads(amount=20)

    now = time.time()
    batch = []

    for thread in threads:
        try:
            full = cl.direct_thread(thread.id, amount=15)
            tid = f"ig_{thread.id}"

            # Identify the OTHER participant (the client) for this thread
            client_username, client_name = "", ""
            for u in (full.users or []):
                if str(u.pk) != MY_ID:
                    USER_CACHE[str(u.pk)] = {"username": u.username, "name": u.full_name or u.username}
                    client_username, client_name = u.username, (u.full_name or u.username)
                    break

            for msg in full.messages:
                if not msg.text:
                    continue
                try:
                    age_h = (now - msg.timestamp.timestamp()) / 3600
                except Exception:
                    age_h = 0
                if age_h > MAX_AGE_HOURS:
                    continue

                is_me = str(msg.user_id) == MY_ID
                if is_me:
                    sender, uname, nm = "extolem", "", ""
                else:
                    sender = "client"
                    uname, nm = resolve_user(msg.user_id)
                    if not client_username:
                        client_username, client_name = uname, nm

                try:
                    ts = msg.timestamp.strftime("%Y-%m-%d %H:%M:%S")
                except Exception:
                    ts = None

                batch.append({
                    "threadId": tid,
                    "messageId": str(msg.id),
                    "senderUsername": uname or client_username,
                    "senderName": nm or client_name,
                    "text": msg.text,
                    "sender": sender,
                    "timestamp": ts,
                })
        except Exception as e:
            print(f"[Poller] Error reading thread {thread.id}: {e}")

    # Send everything in one batch; backend dedupes.
    send_batch(batch)
    print(f"[Poller] Poll complete — {len(batch)} recent messages synced. Sleeping {POLL_INTERVAL}s...")


if __name__ == "__main__":
    login()
    print(f"[Poller] Started. Polling every {POLL_INTERVAL}s, syncing last {MAX_AGE_HOURS}h.")
    while True:
        try:
            poll()
        except Exception as e:
            print(f"[Poller] Unexpected error: {e}")
        time.sleep(POLL_INTERVAL)
