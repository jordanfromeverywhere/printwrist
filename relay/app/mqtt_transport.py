from __future__ import annotations

import json
import queue
import ssl
import threading
import time
import uuid
from typing import Protocol

import paho.mqtt.client as mqtt

from .errors import AuthError, UpstreamError

BROKER, PORT = "us.mqtt.bambulab.com", 8883
PUSHALL = {"pushing": {"sequence_id": "0", "command": "pushall", "version": 1, "push_target": 1}}


class Transport(Protocol):
    def open(self) -> None: ...
    def subscribe(self, topic: str) -> None: ...
    def publish(self, topic: str, payload: dict) -> None: ...
    def next_message(self, timeout: float) -> dict | None: ...
    def close(self) -> None: ...


def deep_merge(dst: dict, src: dict) -> dict:
    for k, v in src.items():
        if isinstance(v, dict) and isinstance(dst.get(k), dict):
            deep_merge(dst[k], v)
        else:
            dst[k] = v
    return dst


class PahoTransport:
    def __init__(self, username: str, token: str, host: str = BROKER, port: int = PORT,
                 connect_timeout: float = 8.0):
        self.host, self.port, self.connect_timeout = host, port, connect_timeout
        self._q: queue.Queue = queue.Queue()
        self._connected, self._subscribed = threading.Event(), threading.Event()
        self._rc = None
        self._c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2,
                              client_id=f"pw-{uuid.uuid4().hex[:12]}", protocol=mqtt.MQTTv311)
        self._c.username_pw_set(username, token)
        self._c.tls_set(cert_reqs=ssl.CERT_REQUIRED)
        self._c.on_connect = self._on_connect
        self._c.on_subscribe = lambda *a: self._subscribed.set()
        self._c.on_message = self._on_message

    def _on_connect(self, client, userdata, flags, reason_code, properties):
        self._rc = reason_code
        self._connected.set()

    def _on_message(self, client, userdata, msg):
        try:
            self._q.put(json.loads(msg.payload))
        except ValueError:
            pass

    def open(self) -> None:
        try:
            self._c.connect(self.host, self.port, keepalive=30)
        except OSError as e:
            raise UpstreamError(f"broker unreachable: {e}") from e
        self._c.loop_start()
        if not self._connected.wait(self.connect_timeout):
            self.close()
            raise UpstreamError("broker connect timeout")
        if self._rc.is_failure:
            value = self._rc.value
            self.close()
            if value in (134, 135):
                raise AuthError("broker rejected credentials")
            raise UpstreamError(f"broker refused: {self._rc}")

    def subscribe(self, topic: str) -> None:
        self._c.subscribe(topic, qos=0)
        self._subscribed.wait(3.0)

    def publish(self, topic: str, payload: dict) -> None:
        self._c.publish(topic, json.dumps(payload), qos=0)

    def next_message(self, timeout: float) -> dict | None:
        try:
            return self._q.get(timeout=max(timeout, 0.0))
        except queue.Empty:
            return None

    def close(self) -> None:
        self._c.loop_stop()
        self._c.disconnect()


def fetch_report(transport: Transport, serial: str, timeout: float = 8.0, settle: float = 1.0,
                 clock=time.monotonic) -> dict | None:
    transport.open()
    try:
        transport.subscribe(f"device/{serial}/report")
        transport.publish(f"device/{serial}/request", PUSHALL)
        merged: dict = {}
        seen_state = False
        deadline = clock() + timeout
        while (remaining := deadline - clock()) > 0:
            msg = transport.next_message(remaining)
            if msg is None:
                break
            if isinstance(msg.get("print"), dict):
                deep_merge(merged, msg)
                if not seen_state and "gcode_state" in msg["print"]:
                    seen_state = True
                    deadline = min(deadline, clock() + settle)
        return merged if seen_state else None
    finally:
        transport.close()
