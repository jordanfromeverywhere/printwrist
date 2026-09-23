from __future__ import annotations

import hashlib
import time
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .bambu_api import get_username
from .control import send_command
from .errors import AuthError, UpstreamError
from .mqtt_transport import PahoTransport, fetch_report
from .normalize import normalize
from .ratelimit import RateLimiter

SERIAL = r"^[A-Za-z0-9]{8,20}$"
STATIC = Path(__file__).parent / "static"


class StatusRequest(BaseModel):
    serial: str = Field(pattern=SERIAL)


class ControlRequest(BaseModel):
    serial: str = Field(pattern=SERIAL)
    action: str = Field(pattern=r"^(pause|resume|stop)$")


def token_key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer ") or len(authorization) < 27:
        raise HTTPException(401, "missing token")
    return authorization[7:]


def create_app(transport_factory=None, username_resolver=None, now=time.monotonic, control_sender=None) -> FastAPI:
    transport_factory = transport_factory or (lambda user, token: PahoTransport(user, token))
    username_resolver = username_resolver or get_username
    status_limit = RateLimiter(min_interval=2.0)
    control_limit = RateLimiter(min_interval=2.0)
    app = FastAPI(title="PrintWrist relay", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.transport_factory = transport_factory
    app.state.username_resolver = username_resolver
    app.state.now = now
    control_sender = control_sender or unsigned_sender

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    @app.post("/status")
    def status(req: StatusRequest, authorization: str | None = Header(default=None)):
        token = bearer(authorization)
        if not status_limit.allow(token_key(token), now()):
            raise HTTPException(429, "slow down")
        transport = open_transport(app, token)
        try:
            return normalize(fetch_report(transport, req.serial))
        except AuthError:
            raise HTTPException(401, "bambu rejected token")
        except UpstreamError:
            raise HTTPException(502, "bambu unavailable")

    @app.post("/control")
    def control(req: ControlRequest, authorization: str | None = Header(default=None)):
        token = bearer(authorization)
        if not control_limit.allow(token_key(token), now()):
            raise HTTPException(429, "slow down")
        try:
            result = control_sender(app, token, req.serial, req.action)
        except AuthError:
            raise HTTPException(401, "bambu rejected token")
        except UpstreamError:
            raise HTTPException(502, "bambu unavailable")
        if result == "rejected":
            raise HTTPException(409, "rejected")
        return {"result": result}

    if (STATIC / "config").is_dir():
        app.mount("/config", StaticFiles(directory=STATIC / "config", html=True), name="config")
    return app


def open_transport(app: FastAPI, token: str):
    try:
        user = app.state.username_resolver(token)
    except AuthError:
        raise HTTPException(401, "bambu rejected token")
    except UpstreamError:
        raise HTTPException(502, "bambu unavailable")
    return app.state.transport_factory(user, token)


def unsigned_sender(app: FastAPI, token: str, serial: str, action: str) -> str:
    return send_command(open_transport(app, token), serial, action)


app = create_app()
