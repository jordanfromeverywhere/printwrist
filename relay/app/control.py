from __future__ import annotations

import time

ACTIONS = ("pause", "resume", "stop")


def build_command(action: str, seq: int) -> dict:
    return {"print": {"sequence_id": str(seq), "command": action, "param": ""}}


def classify_reply(p: dict) -> str:
    if p.get("err_code"):
        return "rejected"
    return "ok" if str(p.get("result", "success")).lower() == "success" else "rejected"


def send_command(transport, serial: str, action: str, timeout: float = 5.0, seq: int | None = None,
                 clock=time.monotonic) -> str:
    seq = seq if seq is not None else int(time.time() * 1000) % 1_000_000
    transport.open()
    try:
        transport.subscribe(f"device/{serial}/report")
        transport.publish(f"device/{serial}/request", build_command(action, seq))
        deadline = clock() + timeout
        while (remaining := deadline - clock()) > 0:
            msg = transport.next_message(remaining)
            if msg is None:
                break
            p = msg.get("print")
            if isinstance(p, dict) and p.get("command") == action and str(p.get("sequence_id")) == str(seq):
                return classify_reply(p)
        return "unconfirmed"
    finally:
        transport.close()
