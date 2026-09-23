"""Owner-run check of Bambu Cloud behavior. Records sanitized fixtures.

Usage (run in your own terminal, not through Claude, because it asks for your password):
  python tools/verify_cloud.py login
  python tools/verify_cloud.py probe [--serial SERIAL]
  python tools/verify_cloud.py light [--serial SERIAL]
"""
import argparse, getpass, json, pathlib, ssl, sys, threading, time, uuid

import paho.mqtt.client as mqtt
import requests

API = "https://api.bambulab.com"
BROKER, PORT = "us.mqtt.bambulab.com", 8883
HOME = pathlib.Path.home() / ".printwrist"
TOKEN_FILE = HOME / "token.json"
FIX = pathlib.Path(__file__).resolve().parents[1] / "relay" / "tests" / "fixtures"
HEADERS = {"User-Agent": "bambu_network_agent/01.09.05.01", "Content-Type": "application/json"}
SECRET_KEYS = {"dev_access_code", "access_code", "accessToken", "refreshToken", "token", "ip",
               "ipaddr", "ip_addr", "mac", "ttcode", "authkey", "passwd", "password", "email", "wifi_signal",
               "fun", "fun2"}
ALL_SERIALS = []


def show(label, resp):
    print(f"--- {label}: HTTP {resp.status_code}")
    try:
        print(json.dumps(sanitize(resp.json(), []), indent=2)[:2000])
    except ValueError:
        print(resp.text[:500])


def sanitize(obj, serials):
    if isinstance(obj, dict):
        return {k: ("REDACTED" if k in SECRET_KEYS else sanitize(v, serials)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v, serials) for v in obj]
    if isinstance(obj, str):
        for i, serial in enumerate(serials):
            if serial in obj:
                obj = obj.replace(serial, f"SERIAL{i:04d}")
        return obj
    return obj


def save(name, data):
    FIX.mkdir(parents=True, exist_ok=True)
    (FIX / name).write_text(json.dumps(data, indent=2))
    print(f"wrote {FIX / name}")


def cmd_login(_args):
    email = input("Bambu email: ").strip()
    password = getpass.getpass("Bambu password (not echoed, not stored): ")
    r = requests.post(f"{API}/v1/user-service/user/login", headers=HEADERS,
                      json={"account": email, "password": password}, timeout=20)
    show("login", r)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if body.get("loginType") == "verifyCode":
        r2 = requests.post(f"{API}/v1/user-service/user/sendemail/code", headers=HEADERS,
                           json={"email": email, "type": "codeLogin"}, timeout=20)
        show("sendemail/code", r2)
        code = input("Code from Bambu email: ").strip()
        r = requests.post(f"{API}/v1/user-service/user/login", headers=HEADERS,
                          json={"account": email, "code": code}, timeout=20)
        show("login with code", r)
        body = r.json()
    elif body.get("loginType") == "tfa":
        print("Account uses authenticator-app 2FA. v1 does not support this. Record it in CONTRACT.md.")
        return
    if not body.get("accessToken"):
        print("No accessToken. Record the response above in CONTRACT.md and stop.")
        sys.exit(1)
    HOME.mkdir(exist_ok=True)
    TOKEN_FILE.write_text(json.dumps({**{k: body.get(k) for k in ("accessToken", "refreshToken", "expiresIn")},
                                      "email": email, "savedAt": time.time()}))
    print(f"Saved token to {TOKEN_FILE} (keys: {sorted(body.keys())})")


def load_token():
    return json.loads(TOKEN_FILE.read_text())


def auth_headers(tok):
    return {**HEADERS, "Authorization": f"Bearer {tok['accessToken']}"}


def pick_serial(tok, wanted):
    global ALL_SERIALS
    r = requests.get(f"{API}/v1/iot-service/api/user/bind", headers=auth_headers(tok), timeout=20)
    show("devices", r)
    devices = r.json().get("devices", [])
    serial = wanted or (devices[0]["dev_id"] if devices else None)
    all_serials = [d["dev_id"] for d in devices]
    if serial in all_serials:
        all_serials.remove(serial)
    ALL_SERIALS = [serial] + all_serials if serial else all_serials
    save("devices.json", sanitize(r.json(), ALL_SERIALS))
    return serial


def mqtt_username(tok):
    r = requests.get(f"{API}/v1/user-service/my/profile", headers=auth_headers(tok), timeout=20)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    print(f"--- profile: HTTP {r.status_code}, keys: {sorted(body.keys())}")
    return f"u_{body['uid']}"


def mqtt_session(tok, serial, request_payload, seconds):
    msgs, ready = [], threading.Event()
    c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"pw-verify-{uuid.uuid4().hex[:8]}",
                    protocol=mqtt.MQTTv311)
    c.username_pw_set(mqtt_username(tok), tok["accessToken"])
    c.tls_set(cert_reqs=ssl.CERT_REQUIRED)
    c.on_connect = lambda cl, u, f, rc, p: (print(f"connect: {rc}"), ready.set())
    c.on_message = lambda cl, u, m: msgs.append(json.loads(m.payload))
    c.connect(BROKER, PORT, keepalive=30)
    c.loop_start()
    ready.wait(10)
    c.subscribe(f"device/{serial}/report")
    time.sleep(1)
    for payload in request_payload:
        c.publish(f"device/{serial}/request", json.dumps(payload))
        time.sleep(seconds / max(len(request_payload), 1))
    c.loop_stop()
    c.disconnect()
    return msgs


def cmd_probe(args):
    tok = load_token()
    serial = pick_serial(tok, args.serial)
    pushall = {"pushing": {"sequence_id": "0", "command": "pushall", "version": 1, "push_target": 1}}
    msgs = mqtt_session(tok, serial, [pushall], 15)
    print(f"received {len(msgs)} messages")
    merged = {}
    for m in msgs:
        if "print" in m:
            for k, v in m["print"].items():
                merged.setdefault("print", {})[k] = v
    save("report_p2s_messages.json", sanitize(msgs, ALL_SERIALS))
    save("report_p2s.json", sanitize(merged, ALL_SERIALS))
    p = merged.get("print", {})
    print("gcode_state:", p.get("gcode_state"), "| mc_percent:", p.get("mc_percent"))
    print("ipcam (v1.1 camera transport):", json.dumps(p.get("ipcam"), indent=2))
    r = requests.post(f"{API}/v1/user-service/user/refreshtoken", headers=HEADERS,
                      json={"refreshToken": tok.get("refreshToken")}, timeout=20)
    show("refreshtoken", r)
    r = requests.options(f"{API}/v1/user-service/user/login",
                         headers={"Origin": "https://example.com", "Access-Control-Request-Method": "POST"}, timeout=20)
    print("CORS allow-origin:", r.headers.get("access-control-allow-origin"))


def cmd_light(args):
    tok = load_token()
    serial = pick_serial(tok, args.serial)
    def led(mode, seq):
        return {"system": {"sequence_id": str(seq), "command": "ledctrl", "led_node": "chamber_light",
                           "led_mode": mode, "led_on_time": 500, "led_off_time": 500,
                           "loop_times": 0, "interval_time": 0}}
    msgs = mqtt_session(tok, serial, [led("on", 101), led("off", 102)], 12)
    replies = [m for m in msgs if "system" in m or "err_code" in json.dumps(m)]
    save("ledctrl_replies.json", sanitize(replies, ALL_SERIALS))
    print(json.dumps(sanitize(replies, ALL_SERIALS), indent=2))
    print("Did the chamber light visibly turn on then off? Record yes/no in CONTRACT.md.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["login", "probe", "light"])
    ap.add_argument("--serial")
    a = ap.parse_args()
    {"login": cmd_login, "probe": cmd_probe, "light": cmd_light}[a.cmd](a)
