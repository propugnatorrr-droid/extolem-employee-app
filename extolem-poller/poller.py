import os
import time
import requests
import json
from instagrapi import Client
from instagrapi.exceptions import LoginRequired

INSTAGRAM_USER = os.environ.get("INSTAGRAM_USER", "extolem")
INSTAGRAM_PASS = os.environ.get("INSTAGRAM_PASS")
BACKEND_URL = os.environ.get("BACKEND_URL", "https://extolem-employee-app-production.up.railway.app")
APP_TOKEN = os.environ.get("APP_SECRET", "extolem_app_secret_change_this")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))
SESSION_FILE = "session.json"

headers = {"x-app-token": APP_TOKEN, "Content-Type": "application/json"}

cl = Client()
cl.delay_range = [1, 3]

def login():
    print(f"[Extolem Poller] Logging into Instagram as @{INSTAGRAM_USER}...")
    if os.path.exists(SESSION_FILE):
        try:
            cl.load_settings(SESSION_FILE)
            cl.login(INSTAGRAM_USER, INSTAGRAM_PASS)
            print("[Extolem Poller] Logged in via saved session.")
            return
        except Exception:
            print("[Extolem Poller] Saved session expired, re-logging...")

    cl.login(INSTAGRAM_USER, INSTAGRAM_PASS)
    cl.dump_settings(SESSION_FILE)
    print("[Extolem Poller] Logged in fresh.")

def post_message_to_backend(thread_id, sender_username, sender_name, message_id, text):
    """Send a new DM to the backend for storage + AI suggestion."""
    try:
        # Upsert conversation
        requests.post(f"{BACKEND_URL}/poller/message", headers=headers, json={
            "threadId": f"ig_{thread_id}",
            "messageId": message_id,
            "senderUsername": sender_username,
            "senderName": sender_name,
            "text": text
        }, timeout=10)
    except Exception as e:
        print(f"[Extolem Poller] Failed to post message: {e}")

seen_message_ids = set()
initialized = False

def poll():
    global seen_message_ids, initialized

    try:
        threads = cl.direct_threads(amount=20)
    except LoginRequired:
        print("[Extolem Poller] Session expired — re-logging...")
        login()
        threads = cl.direct_threads(amount=20)

    for thread in threads:
        try:
            full_thread = cl.direct_thread(thread.id, amount=10)
            for msg in full_thread.messages:
                if not msg.text:
                    continue
                # Skip our own messages
                if str(msg.user_id) == str(cl.user_id):
                    continue
                msg_key = str(msg.id)
                if msg_key in seen_message_ids:
                    continue
                seen_message_ids.add(msg_key)

                # Skip old messages on first run (only load new ones going forward)
                if not initialized:
                    continue

                sender_username = str(msg.user_id)
                sender_name = "Instagram User"

                # Try to get the sender's username
                try:
                    user_info = cl.user_info(msg.user_id)
                    sender_username = user_info.username
                    sender_name = user_info.full_name or user_info.username
                except Exception:
                    pass

                print(f"[Extolem Poller] New DM from @{sender_username}: {msg.text[:60]}")
                post_message_to_backend(
                    thread_id=str(thread.id),
                    sender_username=sender_username,
                    sender_name=sender_name,
                    message_id=msg_key,
                    text=msg.text
                )
        except Exception as e:
            print(f"[Extolem Poller] Error reading thread {thread.id}: {e}")

    initialized = True
    print(f"[Extolem Poller] Poll done. Tracking {len(seen_message_ids)} messages. Sleeping {POLL_INTERVAL}s...")

if __name__ == "__main__":
    login()
    print(f"[Extolem Poller] Started. Polling every {POLL_INTERVAL} seconds.")
    while True:
        try:
            poll()
        except Exception as e:
            print(f"[Extolem Poller] Unexpected error: {e}")
        time.sleep(POLL_INTERVAL)
