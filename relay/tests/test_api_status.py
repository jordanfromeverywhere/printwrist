from fastapi.testclient import TestClient

from app.errors import AuthError, UpstreamError
from app.main import create_app
from tests.fakes import FakeTransport

TOKEN = "t" * 40
AUTH = {"Authorization": f"Bearer {TOKEN}"}


def client(messages=None, fail_auth=False, fail_upstream=False, resolver=None, clock=None):
    made = []

    def factory(user, token):
        t = FakeTransport(messages or [], fail_auth=fail_auth, fail_upstream=fail_upstream)
        made.append((user, token, t))
        return t

    times = iter(clock or [0.0, 10.0, 20.0, 30.0])
    app = create_app(transport_factory=factory,
                     username_resolver=resolver or (lambda tok: "u_123"),
                     now=lambda: next(times))
    return TestClient(app), made


def test_healthz():
    c, _ = client()
    assert c.get("/healthz").json() == {"ok": True}


def test_status_normalized():
    c, made = client([{"print": {"gcode_state": "RUNNING", "mc_percent": 42}}])
    r = c.post("/status", json={"serial": "ABC12345"}, headers=AUTH)
    assert r.status_code == 200
    assert r.json()["stage"] == "printing" and r.json()["progress"] == 42
    assert made[0][:2] == ("u_123", TOKEN)


def test_status_offline_when_silent():
    c, _ = client([])
    assert c.post("/status", json={"serial": "ABC12345"}, headers=AUTH).json()["stage"] == "offline"


def test_missing_token_401():
    c, _ = client()
    assert c.post("/status", json={"serial": "ABC12345"}).status_code == 401


def test_bad_serial_422():
    c, _ = client()
    assert c.post("/status", json={"serial": "../etc"}, headers=AUTH).status_code == 422


def test_profile_rejects_token_401():
    def resolver(tok):
        raise AuthError("nope")
    c, _ = client(resolver=resolver)
    assert c.post("/status", json={"serial": "ABC12345"}, headers=AUTH).status_code == 401


def test_broker_rejects_token_401():
    c, _ = client(fail_auth=True)
    assert c.post("/status", json={"serial": "ABC12345"}, headers=AUTH).status_code == 401


def test_rate_limited_429():
    c, _ = client([], clock=[0.0, 0.5])
    assert c.post("/status", json={"serial": "ABC12345"}, headers=AUTH).status_code == 200
    assert c.post("/status", json={"serial": "ABC12345"}, headers=AUTH).status_code == 429


def test_profile_unreachable_502():
    def resolver(tok):
        raise UpstreamError("profile service down")
    c, _ = client(resolver=resolver)
    assert c.post("/status", json={"serial": "ABC12345"}, headers=AUTH).status_code == 502


def test_broker_unreachable_502():
    c, made = client(fail_upstream=True)
    assert c.post("/status", json={"serial": "ABC12345"}, headers=AUTH).status_code == 502
    assert not made[0][2].closed
