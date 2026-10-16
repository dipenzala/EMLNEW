#!/usr/bin/env python3
"""CertWinX local scheduler — calls /api/cron/process every N seconds."""
import os, sys, time, json, urllib.request, urllib.error, pathlib, signal

ROOT = pathlib.Path(__file__).parent
ENV_FILE = ROOT / ".env.local"
INTERVAL = int(sys.argv[1]) if len(sys.argv) > 1 else 30

def load_env():
    if not ENV_FILE.exists():
        print("ERROR: .env.local not found.")
        sys.exit(1)
    env = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip()
    return env

ENV = load_env()
APP_URL = ENV.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000").rstrip("/")
CRON_SECRET = ENV.get("CRON_SECRET", "")
GLOBAL_ENABLED = ENV.get("GLOBAL_SENDING_ENABLED", "false").lower() == "true"

if not CRON_SECRET:
    print("ERROR: CRON_SECRET missing in .env.local")
    sys.exit(1)

STOP = False
def handle_sigint(sig, frame):
    global STOP
    STOP = True
    print("\nstopping scheduler...")
signal.signal(signal.SIGINT, handle_sigint)

print(f"CertWinX scheduler started")
print(f"  endpoint : {APP_URL}/api/cron/process")
print(f"  interval : {INTERVAL}s")
print(f"  sending  : {'ENABLED' if GLOBAL_ENABLED else 'PAUSED'}")
print(f"  stop     : Ctrl+C\n")

tick = 0
while not STOP:
    tick += 1
    url = f"{APP_URL}/api/cron/process"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {CRON_SECRET}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8", "replace")
            try:
                data = json.loads(body)
                print(f"[{time.strftime('%H:%M:%S')}] tick #{tick}: claimed={data.get('claimed',0)} sent={data.get('sent',0)} failed={data.get('failed',0)}")
            except Exception:
                print(f"[{time.strftime('%H:%M:%S')}] tick #{tick}: {body[:200]}")
    except urllib.error.HTTPError as e:
        print(f"[{time.strftime('%H:%M:%S')}] tick #{tick}: HTTP {e.code} — {e.read().decode('utf-8','replace')[:200]}")
    except Exception as e:
        print(f"[{time.strftime('%H:%M:%S')}] tick #{tick}: error — {e}")
    for _ in range(INTERVAL):
        if STOP: break
        time.sleep(1)
print("done.")
